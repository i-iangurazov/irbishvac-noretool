"use client";
import { useEffect, useState } from "react";
import type { NewsletterInfo } from "../lib/kitchen-newsletter";
const readImage = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
export function KitchenInsiderUpload({
  initialMonth,
}: {
  initialMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth),
    [pages, setPages] = useState<string[]>([]),
    [sourceName, setSourceName] = useState("");
  const [existing, setExisting] = useState<NewsletterInfo | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [canUpload, setCanUpload] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setExisting(null);
    setPages([]);
    setMessage("");
    setError("");
    fetch(`/api/kitchen/insider?month=${month}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this issue.");
        return response.json();
      })
      .then((body) => {
        setExisting(body.issue);
        setCanUpload(body.canUpload);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => controller.abort();
  }, [month]);
  async function choose(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    setMessage("");
    setPages([]);
    try {
      const selected = Array.from(files);
      if (selected.some((file) => file.size > 12 * 1024 * 1024))
        throw new Error("Each file must be 12 MB or smaller.");
      if (
        selected.length === 1 &&
        (/\.pdf$/i.test(selected[0]!.name) ||
          selected[0]!.type === "application/pdf")
      ) {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/kitchen/pdf.worker.min.mjs";
        const document = await pdfjs.getDocument({
          data: new Uint8Array(await selected[0]!.arrayBuffer()),
        }).promise;
        try {
          if (document.numPages !== 2)
            throw new Error("The Insider PDF must contain exactly two pages.");
          const images: string[] = [];
          for (let number = 1; number <= 2; number++) {
            const page = await document.getPage(number),
              natural = page.getViewport({ scale: 1 });
            if (natural.width > natural.height)
              throw new Error("Use a PDF with two portrait pages.");
            const viewport = page.getViewport({
              scale: Math.min(1600 / natural.width, 2200 / natural.height),
            });
            const canvas = window.document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({
              canvas,
              canvasContext: canvas.getContext("2d")!,
              viewport,
              background: "#ffffff",
            }).promise;
            images.push(canvas.toDataURL("image/png"));
            canvas.width = 0;
            canvas.height = 0;
          }
          setPages(images);
        } finally {
          await document.destroy();
        }
      } else {
        if (
          selected.length !== 2 ||
          selected.some((file) => !/^image\/(png|jpeg|webp)$/.test(file.type))
        )
          throw new Error(
            "Choose one two-page PDF, or exactly two PNG, JPEG or WebP images.",
          );
        setPages(await Promise.all(selected.map(readImage)));
      }
      setSourceName(selected.map((file) => file.name).join(", "));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not prepare these files.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/kitchen/insider", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kitchen-upload": "1",
        },
        body: JSON.stringify({ month, pages, sourceName }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Could not publish this issue.");
      setExisting(result.issue);
      setPages([]);
      setMessage(
        "Published. The kitchen TV will show this issue within one minute.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not publish this issue.",
      );
    } finally {
      setBusy(false);
    }
  }
  const preview = pages.length ? pages : (existing?.pages ?? []);
  return (
    <main className="insider-editor">
      <header>
        <a href="/kitchen">← Kitchen board</a>
        <span>IRBIS · MONTHLY NEWSLETTER</span>
        <h1>Publish the IRBIS Insider</h1>
        <p>
          Choose the month, upload two pages, check the preview, then publish.
          The TV displays both pages side by side for 45 seconds.
        </p>
      </header>
      <section className="insider-form">
        <label>
          Issue month
          <input
            type="month"
            min="2020-01"
            max="2099-12"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            disabled={busy}
          />
        </label>
        {canUpload ? (
          <label className="insider-file">
            Newsletter file
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              multiple
              disabled={busy}
              onChange={(event) => void choose(event.target.files)}
            />
            <small>
              One two-page PDF or two portrait images. Maximum 12 MB per file.
            </small>
          </label>
        ) : (
          <p>
            Sign in with your individual IRBIS account to publish. The shared TV
            account can view issues.
          </p>
        )}
        <div className="insider-actions">
          {pages.length === 2 && (
            <button
              disabled={busy}
              onClick={() => setPages((value) => [value[1]!, value[0]!])}
            >
              Swap page order
            </button>
          )}
          <button
            className="insider-publish"
            disabled={busy || pages.length !== 2 || !canUpload}
            onClick={() => void publish()}
          >
            {busy
              ? "Preparing…"
              : existing
                ? "Publish replacement"
                : "Publish issue"}
          </button>
        </div>
        {busy && <p role="status">Preparing the two newsletter pages…</p>}
        {message && (
          <p className="insider-success" role="status">
            {message}
          </p>
        )}
        {error && (
          <p className="insider-error" role="alert">
            {error}
          </p>
        )}
      </section>
      <section className="insider-preview" aria-label="Newsletter preview">
        {preview.length ? (
          preview.map((src, index) => (
            <figure key={`${index}-${src.slice(-32)}`}>
              <img src={src} alt={`Newsletter preview page ${index + 1}`} />
              <figcaption>Page {index + 1}</figcaption>
            </figure>
          ))
        ) : (
          <p>Choose a newsletter to preview both pages here.</p>
        )}
      </section>
      {existing && (
        <p className="insider-current">
          Published issue: {existing.sourceName}
        </p>
      )}
    </main>
  );
}
