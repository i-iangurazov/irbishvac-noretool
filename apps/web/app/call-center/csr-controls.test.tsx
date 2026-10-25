import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CsrAvatar, CsrPeriodPicker } from "./csr-controls";
import { staffPortraitUrl } from "../../lib/staff-portrait-url";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

describe("Membership date selection", () => {
  it("accepts typed September dates when moving backwards from October", async () => {
    await act(async () =>
      root.render(
        <CsrPeriodPicker
          from="2026-10-01"
          to="2026-10-25"
          label="October"
          query="preset=mtd"
          allowSingleDate
        />,
      ),
    );
    const start = host.querySelector<HTMLInputElement>('[name="from"]')!;
    const end = host.querySelector<HTMLInputElement>('[name="to"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(start, "2026-09-01");
      start.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(end.min).toBe("2026-09-01");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!.call(end, "2026-09-30");
      end.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(start.max).toBe("2026-09-30");
    expect(host.querySelector("form")!.checkValidity()).toBe(true);
    expect(
      Array.from(new FormData(host.querySelector("form")!).entries()),
    ).toContainEqual(["from", "2026-09-01"]);
  });

  it("updates the editable dates when navigation changes the selected range", async () => {
    const render = (from: string, to: string) =>
      root.render(
        <CsrPeriodPicker
          from={from}
          to={to}
          label="Period"
          query=""
          allowSingleDate
        />,
      );
    await act(async () => render("2026-09-01", "2026-09-30"));
    await act(async () => render("2026-10-01", "2026-10-25"));
    expect(host.querySelector<HTMLInputElement>('[name="from"]')!.value).toBe(
      "2026-10-01",
    );
    expect(host.querySelector<HTMLInputElement>('[name="to"]')!.value).toBe(
      "2026-10-25",
    );
  });
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
