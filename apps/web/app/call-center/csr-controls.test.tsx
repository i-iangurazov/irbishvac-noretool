import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CsrAvatar } from "./csr-controls";
import { staffPortraitUrl } from "../../lib/staff-portrait-url";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("shared CSR and Memberships portrait rendering", () => {
  it("prefers the protected prepared portrait and falls back without leaving a broken image", async () => {
    await act(async () => {
      root.render(
        <CsrAvatar
          name="Test Person"
          src="https://photos.example.com/old.jpg"
        />,
      );
    });
    let image = host.querySelector("img")!;
    expect(image.getAttribute("src")).toBe(staffPortraitUrl("Test Person"));
    expect(
      image.parentElement?.classList.contains("csr-avatar--prepared"),
    ).toBe(true);
    await act(async () => image.dispatchEvent(new Event("load")));
    expect(image.style.opacity).toBe("1");
    await act(async () => image.dispatchEvent(new Event("error")));
    image = host.querySelector("img")!;
    expect(image.getAttribute("src")).toBe(
      "https://photos.example.com/old.jpg",
    );
    expect(image.style.opacity).toBe("0");
    await act(async () => image.dispatchEvent(new Event("error")));
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toBe("TP");
  });

  it("does not reuse a previous employee's loaded or failed state after a name change", async () => {
    await act(async () =>
      root.render(<CsrAvatar name="First Person" src={null} />),
    );
    await act(async () =>
      host.querySelector("img")!.dispatchEvent(new Event("error")),
    );
    expect(host.querySelector("img")).toBeNull();
    await act(async () =>
      root.render(<CsrAvatar name="Second Person" src={null} />),
    );
    expect(host.querySelector("img")?.getAttribute("src")).toBe(
      staffPortraitUrl("Second Person"),
    );
  });
});
