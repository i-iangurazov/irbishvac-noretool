import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prepareNewsletterFiles } from "./kitchen-upload";
const pdf = vi.hoisted(() => ({ getDocument: vi.fn(), worker: {} }));
vi.mock("pdfjs-dist", () => ({
  getDocument: pdf.getDocument,
  GlobalWorkerOptions: pdf.worker,
}));
const file = (name = "issue.pdf", type = "application/pdf") => {
  const value = new File(["artwork"], name, { type });
  Object.defineProperty(value, "arrayBuffer", {
    value: async () => new ArrayBuffer(10),
  });
  return value;
};
let size: [number, number], canvases: HTMLCanvasElement[];
let revoke: ReturnType<typeof vi.fn>, draw: ReturnType<typeof vi.fn>;
beforeEach(() => {
  size = [4000, 5200];
  canvases = [];
  draw = vi.fn();
  revoke = vi.fn();
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = size[0];
      naturalHeight = size[1];
      onload?: () => void;
      set src(_url: string) {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.stubGlobal(
    "URL",
    class extends URL {
      static override createObjectURL = vi.fn(() => "blob:test");
      static override revokeObjectURL = revoke;
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      canvases.push(this as HTMLCanvasElement);
      return {
        fillRect: vi.fn(),
        drawImage: draw,
      } as unknown as CanvasRenderingContext2D;
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(
    function (this: HTMLCanvasElement, type, quality) {
      expect(type).toBe("image/webp");
      expect(quality).toBe(0.94);
      expect(this.width).toBeLessThanOrEqual(1600);
      expect(this.height).toBeLessThanOrEqual(2200);
      return "data:image/webp;base64,YQ==";
    },
  );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("newsletter file preparation", () => {
  it("resizes two large portrait images, compresses them and releases resources", async () => {
    const result = await prepareNewsletterFiles([
      file("1.png", "image/png"),
      file("2.jpg", "image/jpeg"),
    ]);
    expect(result.pages).toHaveLength(2);
    expect(result.sourceName).toBe("1.png, 2.jpg");
    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw.mock.calls[0]!.slice(3)).toEqual([1600, 2080]);
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(
      canvases.every((canvas) => canvas.width === 0 && canvas.height === 0),
    ).toBe(true);
  });
  it.each([
    [900, 600],
    [200, 300],
    [300, 2000],
  ])("rejects unsupported image dimensions %s × %s", async (w, h) => {
    size = [w, h];
    await expect(
      prepareNewsletterFiles([
        file("1.png", "image/png"),
        file("2.png", "image/png"),
      ]),
    ).rejects.toThrow("portrait image");
    expect(revoke).toHaveBeenCalledOnce();
  });
  it("rejects unsupported selections and oversized files before decoding", async () => {
    await expect(
      prepareNewsletterFiles([file("one.png", "image/png")]),
    ).rejects.toThrow("exactly two");
    const oversized = file();
    Object.defineProperty(oversized, "size", { value: 13 * 1024 * 1024 });
    await expect(prepareNewsletterFiles([oversized])).rejects.toThrow("12 MB");
  });
  it("renders both PDF pages at TV resolution and releases the PDF worker", async () => {
    const cleanup = vi.fn(),
      destroy = vi.fn(),
      render = vi.fn(() => ({ promise: Promise.resolve() }));
    const getPage = vi.fn(async (number: number) => {
      expect(number).toBeGreaterThan(0);
      return {
        getViewport: ({ scale }: { scale: number }) => ({
          width: 717 * scale,
          height: 930 * scale,
        }),
        render,
        cleanup,
      };
    });
    pdf.getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 2, getPage }),
      destroy,
    });
    expect((await prepareNewsletterFiles([file()])).pages).toHaveLength(2);
    expect(getPage.mock.calls.map((call) => call[0])).toEqual([1, 2]);
    expect(render).toHaveBeenCalledTimes(2);
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledOnce();
  });
  it("rejects extra PDF pages and password-protected PDFs with a useful message", async () => {
    const destroy = vi.fn();
    pdf.getDocument.mockReturnValue({
      promise: Promise.resolve({ numPages: 8 }),
      destroy,
    });
    await expect(prepareNewsletterFiles([file()])).rejects.toThrow(
      "exactly two pages",
    );
    const locked = new Error("locked");
    locked.name = "PasswordException";
    pdf.getDocument.mockReturnValue({
      promise: Promise.reject(locked),
      destroy,
    });
    await expect(prepareNewsletterFiles([file()])).rejects.toThrow("unlocked");
    expect(destroy).toHaveBeenCalledTimes(2);
  });
});
