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
    const slides = buildKitchenSlides(makeData(), new Date());
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
    const published = buildKitchenSlides(withNews, new Date());
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
  it("rotates through the complete org chart and celebration/news sections, and pauses on request", () => {
    act(() =>
      root.render(<KitchenBoard tvMode autoplay initialData={makeData()} />),
    );
    const kind = () =>
      host.querySelector("[data-slide-kind]")?.getAttribute("data-slide-kind");
    expect(kind()).toBe("org");
    act(() => {
      vi.advanceTimersByTime(40_000);
    });
    expect(kind()).toBe("birthdays");
    expect(host.textContent).toContain("September birthdays");
    act(() => button("Pause rotation").click());
    act(() => {
      vi.advanceTimersByTime(80_000);
    });
    expect(kind()).toBe("birthdays");
    act(() => button("Next screen").click());
    expect(kind()).toBe("anniversaries");
    expect(host.textContent).toContain("6");
    act(() => button("Next screen").click());
    expect(kind()).toBe("news");
    act(() => button("Next screen").click());
    expect(kind()).toBe("org");
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
