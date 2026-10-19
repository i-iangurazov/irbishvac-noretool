const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_NEWSLETTER_BODY_BYTES = 16 * 1024 * 1024;

function pageCanvas(width: number, height: number) {
  if (width < 300 || height < 400 || width / height > 1 || width / height < 0.4)
    throw new Error(
      "Each newsletter page must be a portrait image, at least 300 × 400 pixels.",
    );
  const scale = Math.min(1, 1600 / width, 2200 / height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error(
      "Your browser could not prepare these pages. Please try again.",
    );
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

function encodedPage(canvas: HTMLCanvasElement) {
  const data = canvas.toDataURL("image/webp", 0.94);
  canvas.width = 0;
  canvas.height = 0;
  return data;
}

async function imagePage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(
          new Error(
            "Could not read the selected image. Use PNG, JPEG or WebP.",
          ),
        );
      image.src = url;
    });
    const { canvas, context } = pageCanvas(
      image.naturalWidth,
      image.naturalHeight,
    );
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return encodedPage(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function prepareNewsletterFiles(selected: File[]) {
  if (selected.some((file) => file.size > MAX_FILE_BYTES))
    throw new Error("Each file must be 12 MB or smaller.");
  let pages: string[];
  if (
    selected.length === 1 &&
    (/\.pdf$/i.test(selected[0]!.name) ||
      selected[0]!.type === "application/pdf")
  ) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/kitchen/pdf.worker.min.mjs";
    const loading = pdfjs.getDocument({
      data: new Uint8Array(await selected[0]!.arrayBuffer()),
    });
    try {
      const pdf = await loading.promise;
      if (pdf.numPages !== 2)
        throw new Error("The Insider PDF must contain exactly two pages.");
      pages = [];
      for (let number = 1; number <= 2; number++) {
        const page = await pdf.getPage(number);
        const natural = page.getViewport({ scale: 1 });
        // PDF points are resolution independent; render every valid portrait at TV resolution.
        if (
          natural.width / natural.height > 1 ||
          natural.width / natural.height < 0.4
        )
          throw new Error("Use a PDF with two portrait pages.");
        const scale = Math.min(1600 / natural.width, 2200 / natural.height);
        const viewport = page.getViewport({ scale });
        const { canvas, context } = pageCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        try {
          await page.render({
            canvas,
            canvasContext: context,
            viewport,
            background: "#ffffff",
          }).promise;
          pages.push(encodedPage(canvas));
        } finally {
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "PasswordException")
        throw new Error(
          "This PDF is password protected. Upload an unlocked two-page PDF.",
        );
      throw error;
    } finally {
      await loading.destroy();
    }
  } else {
    if (
      selected.length !== 2 ||
      selected.some((file) => !/^image\/(png|jpeg|webp)$/.test(file.type))
    )
      throw new Error(
        "Choose one two-page PDF, or exactly two PNG, JPEG or WebP images.",
      );
    // Decode sequentially so two full-resolution images do not occupy memory together.
    pages = [];
    for (const file of selected) pages.push(await imagePage(file));
  }
  return { pages, sourceName: selected.map((file) => file.name).join(", ") };
}
