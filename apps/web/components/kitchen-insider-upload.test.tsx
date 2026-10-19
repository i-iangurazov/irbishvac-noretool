import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { KitchenInsiderUpload } from "./kitchen-insider-upload";
const prepare = vi.hoisted(() => vi.fn());
vi.mock("../lib/kitchen-upload", () => ({
  prepareNewsletterFiles: prepare,
  MAX_NEWSLETTER_BODY_BYTES: 16 * 1024 * 1024,
}));
let host: HTMLDivElement, root: Root, fetcher: ReturnType<typeof vi.fn>;
const saved = {
  month: "2026-10",
  sourceName: "October.pdf",
  version: "1",
  pages: ["/saved/1", "/saved/2"],
};
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  fetcher = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ issue: saved, canUpload: true }),
  });
  vi.stubGlobal("fetch", fetcher);
  prepare.mockReset().mockResolvedValue({
    pages: ["data:image/webp;base64,YQ==", "data:image/webp;base64,Yg=="],
    sourceName: "new.pdf",
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
const render = () =>
  act(async () => {
    root.render(<KitchenInsiderUpload initialMonth="2026-10" />);
  });
const click = (text: string) =>
  act(async () => {
    [...host.querySelectorAll("button")]
      .find((button) => button.textContent === text)!
      .click();
  });
async function select() {
  await act(async () => {
    const input = host.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [new File(["artwork"], "new.pdf", { type: "application/pdf" })],
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
describe("Insider publishing workflow", () => {
  it("previews, swaps, publishes and shows saved page URLs", async () => {
    await render();
    expect(host.querySelector("img")?.getAttribute("src")).toBe("/saved/1");
    await select();
    expect(host.textContent).toContain("Selected: new.pdf");
    await click("Swap page order");
    await click("Publish replacement");
    const payload = JSON.parse(
      fetcher.mock.calls.find((call) => call[1]?.method === "POST")![1].body,
    );
    expect(payload.pages).toEqual([
      "data:image/webp;base64,Yg==",
      "data:image/webp;base64,YQ==",
    ]);
    expect(payload.month).toBe("2026-10");
    expect(payload.sourceName).toBe("new.pdf");
    expect(host.textContent).toContain("Published. The kitchen TV");
    expect(host.querySelector("img")?.getAttribute("src")).toBe("/saved/1");
  });
  it("keeps prepared pages after a failed publish so the user can retry", async () => {
    await render();
    await select();
    fetcher.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Please try again." }),
    });
    await click("Publish replacement");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "Please try again.",
    );
    expect(host.querySelector("img")?.getAttribute("src")).toContain(
      "data:image/webp",
    );
    await click("Publish replacement");
    expect(host.textContent).toContain("Published. The kitchen TV");
  });
  it("preserves the published preview if a selected file is invalid", async () => {
    await render();
    prepare.mockRejectedValueOnce(new Error("Use two portrait pages."));
    await select();
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(
      "Use two portrait pages.",
    );
    expect(host.querySelector("img")?.getAttribute("src")).toBe("/saved/1");
    expect(
      host.querySelector<HTMLButtonElement>(".insider-publish")!.disabled,
    ).toBe(true);
  });
  it("keeps the shared TV account read-only", async () => {
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({ issue: saved, canUpload: false }),
    });
    await render();
    expect(host.querySelector('input[type="file"]')).toBeNull();
    expect(
      host.querySelector<HTMLButtonElement>(".insider-publish")!.disabled,
    ).toBe(true);
    expect(host.querySelectorAll("img")).toHaveLength(2);
  });
});
