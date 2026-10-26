import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipPeriodPicker } from "./membership-period-picker";
import { membershipPeriods, periodDays } from "./membership-period";

let host: HTMLDivElement, root: Root;
const button = (name: string) =>
  [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (element) =>
      element.textContent === name ||
      element.getAttribute("aria-label") === name,
  )!;
const click = (name: string) => act(() => button(name).click());
const data = () =>
  Object.fromEntries(new FormData(document.querySelector("form")!).entries());
function typeDate(label: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  )!;
  act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
beforeEach(() => {
  vi.stubGlobal("React", React);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
      },
    },
    close: {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = false;
      },
    },
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <MembershipPeriodPicker
        from="2026-10-01"
        to="2026-10-26"
        today="2026-10-26"
        label="October MTD"
        query="preset=mtd&tv=1&page=3"
      />,
    ),
  );
  click("Reporting period: October MTD");
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Membership reporting period", () => {
  it("selects last month in one step and preserves display settings without pagination", () => {
    click("Last month");
    expect(data()).toEqual({
      preset: "mtd",
      tv: "1",
      from: "2026-09-01",
      to: "2026-09-30",
      range: "fixed",
    });
    expect(document.querySelector("footer")!.textContent).toContain(
      "30 days selected",
    );
  });
  it("keeps MTD and YTD rolling while custom dates remain fixed", () => {
    click("Year to date");
    expect(data()).toEqual({ preset: "ytd", tv: "1" });
    click("Month to date");
    expect(data()).toEqual({ preset: "mtd", tv: "1" });
    expect(
      document.querySelectorAll('aside button[aria-pressed="true"]'),
    ).toHaveLength(1);
    typeDate("Start date", "2026-10-05");
    expect(data()).toMatchObject({
      from: "2026-10-05",
      to: "2026-10-26",
      range: "fixed",
    });
  });
  it("requires both calendar endpoints and orders a backwards selection", () => {
    click("Tuesday, Oct 20, 2026");
    expect(button("Apply period").disabled).toBe(true);
    click("Monday, Oct 5, 2026");
    expect(data()).toMatchObject({ from: "2026-10-05", to: "2026-10-20" });
    expect(button("Apply period").disabled).toBe(false);
    expect(
      document
        .querySelector('[data-date="2026-10-10"]')
        ?.getAttribute("data-in-range"),
    ).toBe("true");
  });
  it("validates typed dates in either direction without trapping the user in an old month", () => {
    typeDate("Start date", "2026-11-01");
    expect(button("Apply period").disabled).toBe(true);
    expect(document.querySelector('[role="status"]')!.textContent).toContain(
      "End date must",
    );
    typeDate("End date", "2026-11-30");
    expect(button("Apply period").disabled).toBe(false);
    expect(data()).toMatchObject({ from: "2026-11-01", to: "2026-11-30" });
    typeDate("Start date", "2026-09-01");
    typeDate("End date", "2026-09-30");
    expect(data()).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
  });
  it("submits the same date for both endpoints in single-day mode", () => {
    click("Single date");
    click("Monday, Oct 12, 2026");
    expect(data()).toMatchObject({ from: "2026-10-12", to: "2026-10-12" });
    expect(document.querySelector('[aria-label="End date"]')).toBeNull();
    expect(document.querySelector("footer")!.textContent).toContain(
      "1 day selected",
    );
  });
  it("discards draft changes on cancel and restores trigger focus", () => {
    click("Last month");
    click("Cancel");
    expect(document.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(
      button("Reporting period: October MTD"),
    );
    click("Reporting period: October MTD");
    expect(
      document.querySelector<HTMLInputElement>('[aria-label="Start date"]')!
        .value,
    ).toBe("2026-10-01");
    expect(data()).toEqual({ preset: "mtd", tv: "1" });
  });
  it("closes on native Escape cancel without navigating", () => {
    act(() =>
      document
        .querySelector("dialog")!
        .dispatchEvent(new Event("cancel", { cancelable: true })),
    );
    expect(document.querySelector("dialog")).toBeNull();
    expect(
      button("Reporting period: October MTD").getAttribute("aria-expanded"),
    ).toBe("false");
  });
  it("handles leap years and year boundaries using business dates", () => {
    const periods = membershipPeriods("2024-03-01");
    expect(periods.find((period) => period.id === "lastMonth")).toMatchObject({
      from: "2024-02-01",
      to: "2024-02-29",
    });
    expect(periodDays("2024-03-01", "2024-03-31")).toBe(31);
    expect(
      membershipPeriods("2027-01-01").find((period) => period.id === "last7"),
    ).toMatchObject({ from: "2026-12-26", to: "2027-01-01" });
  });
});
