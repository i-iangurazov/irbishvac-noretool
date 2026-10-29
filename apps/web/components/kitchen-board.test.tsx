import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KitchenBoard } from "./kitchen-board";
import {
  buildKitchenSlides,
  kitchenLeadership,
  kitchenCrewGroups,
  kitchenCrewColumns,
} from "../lib/kitchen-layout";
import type {
  KitchenBoardData,
  KitchenEmployee,
} from "../../../packages/domain/src/kitchen-board";
import { staffPortraitUrl } from "../lib/staff-portrait-url";
import { saveKitchenPlayback } from "../lib/kitchen-playback";
const employee = (
  id: string,
  title: string,
  managerId: string | null = null,
): KitchenEmployee => ({
  id,
  name: `Person ${id}`,
  title,
  managerId,
  department: "IRBIS",
  photoUrl: null,
  birthday: null,
  originalHireDate: null,
});
const data = (): KitchenBoardData => ({
  directory: {
    employees: [
      employee("ceo", "CEO"),
      employee("coo", "Chief Operating Officer"),
      employee("cfo", "Chief Financial Officer"),
      employee("installation", "Installation Manager", "ceo"),
      employee("hr", "Human Resources Manager", "ceo"),
      employee("service", "HVAC Service Technician", "ceo"),
      employee("installer", "HVAC Lead Installer", "installation"),
      {
        ...employee("birthday", "Office Assistant", "hr"),
        birthday: { month: 10, day: 10 },
        originalHireDate: "2024-10-09",
      },
    ],
    quality: {
      missingNames: 0,
      missingPhotos: 0,
      missingBirthdays: 0,
      missingHireDates: 0,
      restrictedBirthdays: 0,
      restrictedHireDates: 0,
      missingDepartments: 0,
      unresolvedManagers: 0,
    },
  },
  syncedAt: "2026-10-19T00:00:00Z",
  lastAttemptAt: null,
  stale: false,
  status: "ready",
  timezone: "America/Los_Angeles",
  news: [],
});
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.useFakeTimers();
  window.sessionStorage.clear();
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ issue: null, canUpload: false }),
    }),
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe("October kitchen TV requirements", () => {
  it("resumes the selected screen and rotation after a release reload in ordinary mode", async () => {
    saveKitchenPlayback({ index: 4, running: true });
    await act(async () =>
      root.render(
        <KitchenBoard tvMode={false} autoplay={false} initialData={data()} />,
      ),
    );
    expect(host.querySelector('[data-slide-kind="news"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Pause rotation"]')).not.toBeNull();
    await act(async () => vi.advanceTimersByTime(45_000));
    expect(host.querySelector('[data-slide-kind="org"]')).not.toBeNull();
  });
  it("prefers the reviewed portrait, then falls back to Rippling and initials", async () => {
    const fixture = data();
    const ceo = fixture.directory.employees[0]!;
    ceo.photoSource = "cloudflare";
    ceo.photoUrl = "https://library.example.com/ceo.png";
    ceo.photoFallbackUrl = "https://rippling.example.com/ceo.jpg";
    await act(async () => {
      root.render(
        <KitchenBoard tvMode autoplay={false} initialData={fixture} />,
      );
    });
    let image = host.querySelector<HTMLImageElement>('img[alt="Person ceo"]')!;
    expect(image.getAttribute("src")).toBe(staffPortraitUrl(ceo.name, ceo.id));
    const avatar = image.parentElement!;
    expect(avatar.classList.contains("kitchen-avatar--prepared")).toBe(true);
    await act(async () => image.dispatchEvent(new Event("load")));
    expect(image.style.width).toBe("");
    await act(async () => {
      image.dispatchEvent(new Event("error"));
    });
    image = avatar.querySelector("img")!;
    expect(image.getAttribute("src")).toBe(ceo.photoFallbackUrl);
    await act(async () => image.dispatchEvent(new Event("error")));
    expect(avatar.querySelector("img")).toBeNull();
    expect(avatar.textContent).toBe("PC");
  });

  it("builds the required five screens in order, keeping the installation team separate", () => {
    const slides = buildKitchenSlides(data(), new Date());
    expect(slides.map((slide) => slide.kind)).toEqual([
      "org",
      "crew",
      "birthdays",
      "anniversaries",
      "news",
    ]);
    expect(
      slides[0]!
        .branches!.find((branch) => branch.installation)
        ?.people.map((person) => person.id),
    ).toEqual(["installer"]);
  });
  it("uses roles and reporting IDs after people are renamed, with executive and branch order", () => {
    const people = data().directory.employees.map((person) => ({
      ...person,
      name: `Renamed ${person.id}`,
    }));
    const tree = kitchenLeadership(people);
    expect(tree.totalReports("ceo")).toBe(5);
    expect(tree.totalReports("hr")).toBe(1);
    expect(tree.totalReports("installation")).toBe(1);
    expect(tree.roots.map((person) => person.id)).toEqual([
      "ceo",
      "coo",
      "cfo",
    ]);
    expect(
      tree.branches
        .filter((branch) => branch.executive.id === "ceo")
        .map((branch) => branch.leader?.id ?? branch.label),
    ).toEqual(["hr", "installation", "HVAC Service"]);
  });
  it("connects the lower department row to its executive while preserving the main column widths and report counts", async () => {
    const fixture = data();
    fixture.directory.employees.push(
      employee("sales", "Sales Manager", "coo"),
      {
        ...employee("marketing", "Marketing", "coo"),
        orgDepartmentLabel: "Marketing",
        orgSecondary: true,
      },
      {
        ...employee("customer-service", "Customer Service", "coo"),
        orgDepartmentLabel: "Customer Service",
        orgSecondary: true,
      },
    );
    const tree = kitchenLeadership(fixture.directory.employees);
    expect(tree.reports("coo")).toHaveLength(3);
    expect(tree.branches.filter((branch) => branch.secondary)).toHaveLength(2);
    await act(async () =>
      root.render(
        <KitchenBoard tvMode autoplay={false} initialData={fixture} />,
      ),
    );
    const group = host.querySelector(
      'aside[aria-label="Departments reporting to Person coo"]',
    )!;
    expect(group.querySelectorAll(".kitchen-leader")).toHaveLength(2);
    expect(group.textContent).toContain("Marketing");
    expect(group.textContent).toContain("Customer Service");
    expect(
      host.querySelector('.kitchen-secondary-connectors[data-executive="coo"]'),
    ).not.toBeNull();
    expect(host.querySelectorAll(".kitchen-branches > section")).toHaveLength(
      tree.branches.filter((branch) => !branch.secondary).length,
    );
    expect(host.querySelector(".kitchen-independent-departments")).toBeNull();
    fixture.directory.employees.push(
      ...Array.from({ length: 5 }, (_, index) =>
        employee(`advisor-${index}`, "Comfort Advisor", "sales"),
      ),
    );
    const pages = buildKitchenSlides(fixture, new Date()).filter(
      (slide) => slide.kind === "org",
    );
    expect(pages).toHaveLength(2);
    expect(
      pages.map(
        (page) =>
          page.branches!.find((branch) => branch.leader?.id === "sales")!.people
            .length,
      ),
    ).toEqual([4, 1]);
    expect(
      pages.every(
        (page) =>
          page.branches!.filter((branch) => branch.secondary).length === 2,
      ),
    ).toBe(true);
  });
  it("places all 37 crew members in five columns, including two helper columns", () => {
    const people = [
      ...Array.from({ length: 7 }, (_, i) =>
        employee(`l${i}`, "HVAC Lead Installer"),
      ),
      ...Array.from({ length: 18 }, (_, i) =>
        employee(`h${i}`, "HVAC Installation Helper"),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        employee(`p${i}`, "Plumbing Installation Helper"),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        employee(`e${i}`, "Electrician Installer"),
      ),
      ...Array.from({ length: 4 }, (_, i) =>
        employee(`w${i}`, "Permits/Inspections Coordinator"),
      ),
    ];
    const columns = kitchenCrewColumns(kitchenCrewGroups(people));
    expect(columns).toHaveLength(5);
    expect(columns.flat().flatMap((group) => group.people)).toHaveLength(37);
    expect(
      new Set(
        columns
          .flat()
          .flatMap((group) => group.people.map((person) => person.id)),
      ).size,
    ).toBe(37);
    expect(columns.at(-1)).toHaveLength(2);
  });
  it("paginates crew overflow without omitting employees", () => {
    const people = Array.from({ length: 70 }, (_, i) =>
      employee(`h${i}`, "HVAC Installation Helper", "installation"),
    );
    const value = data();
    value.directory.employees.push(...people);
    const slides = buildKitchenSlides(value, new Date()).filter(
      (slide) => slide.kind === "crew",
    );
    expect(slides.length).toBeGreaterThan(1);
    expect(
      slides.flatMap((slide) =>
        slide.columns!.flat().flatMap((group) => group.people),
      ).length,
    ).toBe(71);
  });
  it("sorts birthdays by date, uses eight per page, and skips empty monthly celebrations", () => {
    const value = data();
    value.directory.employees = value.directory.employees.map((person) => ({
      ...person,
      birthday: null,
      originalHireDate: null,
    }));
    expect(
      buildKitchenSlides(value, new Date()).map((slide) => slide.kind),
    ).toEqual(["org", "crew", "news"]);
    value.directory.employees.push(
      ...Array.from({ length: 10 }, (_, i) => ({
        ...employee(`b${i}`, "Office Assistant"),
        birthday: { month: 10, day: 20 - i },
      })),
    );
    const pages = buildKitchenSlides(value, new Date()).filter(
      (slide) => slide.kind === "birthdays",
    );
    expect(pages.map((page) => page.events!.length)).toEqual([8, 2]);
    expect(
      pages.flatMap((page) => page.events!.map((event) => event.day)),
    ).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });
  it("rotates ordinary screens at 20 seconds and the Insider at 45 seconds", async () => {
    await act(async () =>
      root.render(<KitchenBoard tvMode autoplay initialData={data()} />),
    );
    const kind = () =>
      host
        .querySelector("[data-kitchen-board]")
        ?.getAttribute("data-slide-kind");
    expect(kind()).toBe("org");
    await act(async () => vi.advanceTimersByTime(19_999));
    expect(kind()).toBe("org");
    await act(async () => vi.advanceTimersByTime(1));
    expect(kind()).toBe("crew");
    for (let i = 0; i < 3; i++)
      await act(async () => vi.advanceTimersByTime(20_000));
    expect(kind()).toBe("news");
    await act(async () => vi.advanceTimersByTime(44_999));
    expect(kind()).toBe("news");
    await act(async () => vi.advanceTimersByTime(1));
    expect(kind()).toBe("org");
  });
  it("shows the milestone reached this month and marks past dates", async () => {
    await act(async () =>
      root.render(
        <KitchenBoard tvMode={false} autoplay={false} initialData={data()} />,
      ),
    );
    const control = Array.from(host.querySelectorAll("nav button")).find(
      (button) => button.textContent === "Anniversaries",
    )!;
    act(() => (control as HTMLButtonElement).click());
    expect(host.querySelector(".kitchen-years>strong")?.textContent).toBe("2");
    expect(host.querySelector(".kitchen-event--passed")).not.toBeNull();
  });
});
