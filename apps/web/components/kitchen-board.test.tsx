import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KitchenBoard,
  buildKitchenSlides,
  nextKitchenSlide,
} from "./kitchen-board";
import {
  normalizeKitchenDirectory,
  type KitchenBoardData,
} from "../../../packages/domain/src/kitchen-board";

const makeData = (): KitchenBoardData => ({
  directory: normalizeKitchenDirectory(
    [
      {
        id: "a",
        user_id: "a",
        status: "ACTIVE",
        date_of_birth: "1980-09-23",
        original_start_date: "2020-09-23",
      },
      {
        id: "b",
        user_id: "b",
        status: "ACTIVE",
        manager_id: "a",
        date_of_birth: "1990-09-24",
        original_start_date: "2021-09-24",
      },
    ],
    [
      { id: "a", display_name: "Manager Example" },
      { id: "b", display_name: "Employee Example" },
    ],
    [],
  ),
  syncedAt: "2026-09-23T12:00:00Z",
  lastAttemptAt: null,
  stale: false,
  status: "ready",
  timezone: "America/Los_Angeles",
  news: [],
});
let host: HTMLDivElement;
let root: Root;
const button = (label: string) =>
  host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
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

describe("kitchen TV", () => {
  it("skips empty sections during unattended rotation while keeping them available manually", () => {
    const now = new Date("2026-09-22T12:00:00Z");
    const slides = buildKitchenSlides(makeData(), now);
    const anniversary = slides.findIndex(
      (slide) => slide.kind === "anniversaries",
    );
    expect(slides[nextKitchenSlide(slides, anniversary)]?.kind).toBe("org");
    expect(slides.some((slide) => slide.kind === "news")).toBe(true);
    const withNews = makeData();
    withNews.news = [
      {
        id: "one",
        title: "Office update",
        body: "A real update.",
        startsOn: null,
        endsOn: null,
      },
    ];
    const published = buildKitchenSlides(withNews, now);
    expect(published[nextKitchenSlide(published, anniversary)]?.kind).toBe(
      "news",
    );
  });

  it("falls back from Cloudflare to Rippling before displaying initials", () => {
    const data = makeData();
    const employee = data.directory.employees.find(
      (person) => person.id === "a",
    )!;
    employee.photoUrl = "https://assets.example.com/headshot.png";
    employee.photoSource = "cloudflare";
    employee.photoFallbackUrl = "https://rippling.example.com/photo.jpg";
    act(() =>
      root.render(<KitchenBoard tvMode autoplay={false} initialData={data} />),
    );
    const photo = () =>
      host.querySelector<HTMLImageElement>(".kitchen-portrait img");
    expect(photo()?.getAttribute("src")).toBe(
      `/_next/image?url=${encodeURIComponent(employee.photoUrl)}&w=1200&q=82`,
    );
    act(() => photo()!.dispatchEvent(new Event("error")));
    expect(photo()?.src).toBe(employee.photoUrl);
    act(() => photo()!.dispatchEvent(new Event("error")));
    expect(photo()?.src).toBe(employee.photoFallbackUrl);
    act(() => photo()!.dispatchEvent(new Event("error")));
    expect(photo()).toBeNull();
    expect(host.querySelector(".kitchen-portrait-fallback")?.textContent).toBe(
      "ME",
    );
  });

  it("retains the employee name and initials when a photo fails to load", () => {
    const data = makeData();
    data.directory.employees.find((person) => person.id === "a")!.photoUrl =
      "https://example.com/photo.jpg";
    act(() =>
      root.render(<KitchenBoard tvMode autoplay={false} initialData={data} />),
    );
    act(() =>
      host
        .querySelector(".kitchen-portrait img")!
        .dispatchEvent(new Event("error")),
    );
    expect(host.querySelector(".kitchen-portrait img")).toBeNull();
    expect(host.querySelector(".kitchen-portrait-fallback")?.textContent).toBe(
      "ME",
    );
    expect(host.textContent).toContain("Manager Example");
  });
  it("shows today's celebrations first and rotates every five seconds through the complete board", () => {
    const data = makeData();
    data.news = [
      {
        id: "one",
        title: "Office update",
        body: "A real update.",
        startsOn: null,
        endsOn: null,
      },
    ];
    act(() => root.render(<KitchenBoard tvMode autoplay initialData={data} />));
    const kind = () =>
      host.querySelector("[data-slide-kind]")?.getAttribute("data-slide-kind");
    expect(kind()).toBe("birthdays");
    expect(host.textContent).toContain("Today’s birthdays");
    expect(host.textContent).toContain("5s per screen");
    expect(host.textContent).toContain("Manager Example");
    expect(host.textContent).not.toContain("Employee Example");
    act(() => vi.advanceTimersByTime(4_999));
    expect(kind()).toBe("birthdays");
    act(() => vi.advanceTimersByTime(1));
    expect(kind()).toBe("anniversaries");
    expect(host.textContent).toContain("Today’s work anniversaries");
    expect(host.textContent).toContain("6");
    for (const expected of [
      "org",
      "org",
      "birthdays",
      "anniversaries",
      "news",
      "birthdays",
    ]) {
      act(() => vi.advanceTimersByTime(5_000));
      expect(kind()).toBe(expected);
    }
    act(() => button("Pause rotation").click());
    act(() => vi.advanceTimersByTime(80_000));
    expect(kind()).toBe("birthdays");
    expect(host.textContent).toContain("Paused");
    act(() => button("Next screen").click());
    expect(kind()).toBe("anniversaries");
  });

  it("starts desktop Play with today's celebrations even after manually browsing the org chart", () => {
    act(() =>
      root.render(
        <KitchenBoard
          tvMode={false}
          autoplay={false}
          initialData={makeData()}
        />,
      ),
    );
    const peopleTab = Array.from(host.querySelectorAll("button")).find(
      (item) => item.textContent === "Our people",
    )!;
    act(() => peopleTab.click());
    expect(
      host.querySelector("[data-slide-kind]")?.getAttribute("data-slide-kind"),
    ).toBe("org");
    act(() => button("Start rotation").click());
    expect(host.querySelector("h1")?.textContent).toBe("Today’s birthdays");
    expect(host.textContent).toContain("5s per screen");
    act(() => vi.advanceTimersByTime(5_000));
    expect(host.querySelector("h1")?.textContent).toBe(
      "Today’s work anniversaries",
    );
  });

  it("prioritizes a new company day's celebrations without a reload and gives them a full five seconds", () => {
    // Still September 23 at IRBIS, although the browser's UTC date is September 24.
    vi.setSystemTime(new Date("2026-09-24T06:59:50Z"));
    act(() =>
      root.render(<KitchenBoard tvMode autoplay initialData={makeData()} />),
    );
    expect(host.querySelector("h1")?.textContent).toBe("Today’s birthdays");
    expect(host.querySelector(".kitchen-stage")?.textContent).toContain(
      "Manager Example",
    );
    act(() => vi.advanceTimersByTime(30_000));
    expect(host.querySelector("h1")?.textContent).toBe("Today’s birthdays");
    expect(host.querySelector(".kitchen-stage")?.textContent).toContain(
      "Employee Example",
    );
    expect(host.querySelector(".kitchen-stage")?.textContent).not.toContain(
      "Manager Example",
    );
    act(() => vi.advanceTimersByTime(4_999));
    expect(host.querySelector("h1")?.textContent).toBe("Today’s birthdays");
    act(() => vi.advanceTimersByTime(1));
    expect(host.querySelector("h1")?.textContent).toBe(
      "Today’s work anniversaries",
    );
  });

  it("keeps every celebration visible when a month needs multiple screens", () => {
    const data = makeData();
    data.directory.employees = Array.from({ length: 19 }, (_, i) => ({
      ...data.directory.employees[0]!,
      id: String(i),
      managerId: null,
    }));
    const slides = buildKitchenSlides(data, new Date(), 6);
    const birthdays = slides.filter((slide) => slide.kind === "birthdays");
    expect(birthdays).toHaveLength(4);
    expect(birthdays.flatMap((slide) => slide.events ?? [])).toHaveLength(19);
  });

  it("places all of today's pages ahead of the org chart without duplicating or dropping monthly events", () => {
    const data = makeData();
    const today = data.directory.employees.find((person) => person.id === "a")!;
    const otherDay = data.directory.employees.find(
      (person) => person.id === "b",
    )!;
    data.directory.employees = [
      ...Array.from({ length: 7 }, (_, i) => ({
        ...today,
        id: `today-${i}`,
        managerId: null,
      })),
      otherDay,
    ];
    const slides = buildKitchenSlides(data, new Date(), 3);
    expect(slides.slice(0, 6).map((slide) => slide.kind)).toEqual([
      "birthdays",
      "birthdays",
      "birthdays",
      "anniversaries",
      "anniversaries",
      "anniversaries",
    ]);
    expect(
      slides
        .slice(0, 6)
        .every((slide) => slide.events?.every((event) => event.isToday)),
    ).toBe(true);
    expect(slides[6]?.kind).toBe("org");
    for (const kind of ["birthdays", "anniversaries"]) {
      const events = slides
        .filter((slide) => slide.kind === kind)
        .flatMap((slide) => slide.events ?? []);
      expect(events).toHaveLength(8);
      expect(new Set(events.map((event) => event.employee.id)).size).toBe(8);
      expect(events.at(-1)?.isToday).toBe(false);
    }
  });

  it("keeps the org chart first when there are no celebrations today", () => {
    vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));
    act(() =>
      root.render(<KitchenBoard tvMode autoplay initialData={makeData()} />),
    );
    expect(
      host.querySelector("[data-slide-kind]")?.getAttribute("data-slide-kind"),
    ).toBe("org");
    act(() => vi.advanceTimersByTime(5_000));
    expect(
      host.querySelector("[data-slide-kind]")?.getAttribute("data-slide-kind"),
    ).toBe("org");
    act(() => vi.advanceTimersByTime(5_000));
    expect(host.querySelector("h1")?.textContent).toBe("September birthdays");
  });

  it("continues through routine refreshes and prioritizes a newly synced birthday once", async () => {
    const data = makeData();
    data.news = [
      {
        id: "one",
        title: "Office update",
        body: "A real update.",
        startsOn: null,
        endsOn: null,
      },
    ];
    const updated = structuredClone(data);
    updated.directory.employees.push({
      ...data.directory.employees.find((person) => person.id === "a")!,
      id: "new",
      name: "Late Sync Example",
      managerId: null,
      originalHireDate: null,
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => data })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => structuredClone(data),
        })
        .mockResolvedValue({ ok: true, json: async () => updated }),
    );
    await act(async () => root.render(<KitchenBoard tvMode autoplay />));
    await act(async () => vi.advanceTimersByTimeAsync(60_000));
    expect(host.querySelector("h1")?.textContent).toBe("Work anniversaries");
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(host.querySelector("h1")?.textContent).toBe("Company news");
    await act(async () => vi.advanceTimersByTimeAsync(55_000));
    expect(host.querySelector("h1")?.textContent).toBe("Today’s birthdays");
    expect(host.querySelector(".kitchen-stage")?.textContent).toContain(
      "Late Sync Example",
    );
    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(host.querySelector("h1")?.textContent).toBe(
      "Today’s work anniversaries",
    );
  });

  it("rolls over the celebration month without a page reload", () => {
    vi.setSystemTime(new Date("2026-10-01T06:59:50Z"));
    act(() =>
      root.render(
        <KitchenBoard tvMode autoplay={false} initialData={makeData()} />,
      ),
    );
    const birthdaysTab = Array.from(host.querySelectorAll("button")).find(
      (item) => item.textContent?.includes("Birthdays"),
    )!;
    act(() => birthdaysTab.click());
    expect(host.textContent).toContain("September birthdays");
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(host.textContent).toContain("October birthdays");
  });

  it("splits long news into readable screens without dropping words", () => {
    const data = makeData();
    const body = "A company update for our team. ".repeat(28).trim();
    data.news = [
      { id: "news", title: "Team update", body, startsOn: null, endsOn: null },
    ];
    const news = buildKitchenSlides(data, new Date()).filter(
      (slide) => slide.kind === "news",
    );
    expect(news.length).toBeGreaterThan(1);
    expect(news.every((slide) => slide.news!.body.length <= 350)).toBe(true);
    expect(news.map((slide) => slide.news!.body).join(" ")).toBe(body);
  });

  it("shows a recoverable error instead of a fabricated roster", () => {
    act(() =>
      root.render(
        <KitchenBoard
          tvMode
          autoplay
          initialData={{ ...makeData(), status: "unavailable" }}
        />,
      ),
    );
    expect(host.textContent).toContain("temporarily unavailable");
    expect(host.textContent).not.toContain("Manager Example");
  });
});
