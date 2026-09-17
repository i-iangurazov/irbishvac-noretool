import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignPeriodSelect } from "./campaign-period-select";

vi.mock("./marketing-icon", () => ({ MarketingIcon: () => null }));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<CampaignPeriodSelect activeLabel="September 2026" options={[
    { id: "2025-12", active: false, href: "/campaigns?month=2025-12&view=revenue", label: "December 2025" },
    { id: "2026-08", active: false, href: "/campaigns?month=2026-08&view=revenue", label: "August 2026" },
    { id: "2026-09", active: true, href: "/campaigns?month=2026-09&view=revenue", label: "September 2026" },
  ]} />));
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const button = (label: string) => container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const open = () => act(() => button("Reporting month: September 2026").click());

describe("reporting month calendar", () => {
  it("shows the whole year, disables unavailable months, and preserves the selected view in links", () => {
    open();
    expect(container.querySelectorAll(".campaign-calendar-months > *")).toHaveLength(12);
    expect(container.querySelectorAll(".campaign-calendar-months button:disabled")).toHaveLength(10);
    expect(container.querySelector('a[aria-label="August 2026"]')?.getAttribute("href")).toBe("/campaigns?month=2026-08&view=revenue");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("September 2026");
    expect(button("Next year").disabled).toBe(true);
  });
  it("switches between available years and prevents navigation beyond them", () => {
    open();
    act(() => button("Previous year").click());
    expect(container.querySelector(".campaign-calendar-heading strong")?.textContent).toBe("2025");
    expect(button("Previous year").disabled).toBe(true);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("December 2025");
    act(() => button("Next year").click());
    expect(container.querySelector(".campaign-calendar-heading strong")?.textContent).toBe("2026");
  });
  it("supports keyboard month navigation and restores focus on Escape", () => {
    open();
    act(() => document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(document.activeElement?.getAttribute("aria-label")).toBe("August 2026");
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(button("Reporting month: September 2026"));
  });
});
