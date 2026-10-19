"use client";
import React, { useEffect, useState } from "react";
import type { NewsletterInfo } from "../lib/kitchen-newsletter";
import {
  prepareNewsletterFiles,
  MAX_NEWSLETTER_BODY_BYTES,
} from "../lib/kitchen-upload";
export function KitchenInsiderUpload({
  initialMonth,
}: {
  initialMonth: string;
}) {
  const [month, setMonth] = useState(initialMonth),
    [pages, setPages] = useState<string[]>([]),
    [sourceName, setSourceName] = useState("");
  const [existing, setExisting] = useState<NewsletterInfo | null>(null),
    [phase, setPhase] = useState<"preparing" | "publishing" | null>(null),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [canUpload, setCanUpload] = useState(false);
  const busy = phase !== null;
  const validMonth = /^20\d{2}-(0[1-9]|1[0-2])$/.test(month);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setExisting(null);
    setPages([]);
    setMessage("");
    setError("");
    if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) {
      setLoading(false);
      return () => controller.abort();
    }
    fetch(`/api/kitchen/insider?month=${month}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load this issue.");
        return response.json();
      })
      .then((body) => {
        if (controller.signal.aborted) return;
        setExisting(body.issue);
        setCanUpload(body.canUpload);
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month]);
  async function choose(files: File[]) {
    if (!files?.length) return;
    setPhase("preparing");
    setError("");
    setMessage("");
    setPages([]);
    try {
      const prepared = await prepareNewsletterFiles(files);
      const body = JSON.stringify({ month, ...prepared });
      if (new Blob([body]).size > MAX_NEWSLETTER_BODY_BYTES)
        throw new Error(
          "These pages are too large to publish. Choose smaller page images.",
        );
      setPages(prepared.pages);
      setSourceName(prepared.sourceName);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not prepare these files.",
      );
    } finally {
      setPhase(null);
    }
  }
  async function publish() {
    setPhase("publishing");
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
      setPhase(null);
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
        {loading ? (
          <p role="status">Loading the selected issue…</p>
        ) : canUpload ? (
          <label className="insider-file">
            Newsletter file
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              multiple
              disabled={busy || !validMonth}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void choose(files);
              }}
            />
            <small>
              One two-page PDF or two portrait images. Maximum 12 MB per file.
            </small>
            {pages.length === 2 && sourceName && (
              <small className="insider-selected">Selected: {sourceName}</small>
            )}
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
            disabled={
              busy || loading || !validMonth || pages.length !== 2 || !canUpload
            }
            onClick={() => void publish()}
          >
            {phase
              ? phase === "publishing"
                ? "Publishing…"
                : "Preparing…"
              : existing
                ? "Publish replacement"
                : "Publish issue"}
          </button>
        </div>
        {busy && (
          <p role="status">
            {phase === "publishing"
              ? "Publishing this issue…"
              : "Preparing the two newsletter pages…"}
          </p>
        )}
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
