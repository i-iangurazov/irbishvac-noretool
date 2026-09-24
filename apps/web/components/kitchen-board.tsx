"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Cake,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Newspaper,
  Pause,
  Play,
  RefreshCw,
  Trophy,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import {
  kitchenCelebrations,
  kitchenOrgPages,
  type KitchenBoardData,
  type KitchenEmployee,
  type KitchenCelebration,
  type KitchenOrgPage,
  type KitchenNews,
} from "../../../packages/domain/src/kitchen-board";

import {
  kitchenPortraitFocus,
  kitchenPortraitFrame,
  kitchenPortraitUsable,
} from "../lib/kitchen-portrait";

type Kind = "org" | "birthdays" | "anniversaries" | "news";
type Slide = {
  kind: Kind;
  id: string;
  org?: KitchenOrgPage;
  events?: KitchenCelebration[];
  news?: KitchenNews;
  page: number;
  pages: number;
};
const TABS: { kind: Kind; label: string; icon: LucideIcon }[] = [
  { kind: "org", label: "Our people", icon: UsersRound },
  { kind: "birthdays", label: "Birthdays", icon: Cake },
  { kind: "anniversaries", label: "Work anniversaries", icon: Trophy },
  { kind: "news", label: "Company news", icon: Newspaper },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function kitchenPhotoSrc(employee: KitchenEmployee, url: string) {
  return employee.photoSource === "cloudflare" && url === employee.photoUrl
    ? `/_next/image?url=${encodeURIComponent(url)}&w=1200&q=82`
    : url;
}

function Portrait({ employee }: { employee: KitchenEmployee }) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      setViewport((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const photoUrl = [
    employee.photoUrl ? kitchenPhotoSrc(employee, employee.photoUrl) : null,
    employee.photoSource === "cloudflare" ? employee.photoUrl : null,
    employee.photoFallbackUrl,
  ].find((url): url is string =>
    Boolean(url && !failedUrls.includes(url) && kitchenPortraitUsable(url)),
  );
  const hasPhoto = Boolean(photoUrl);
  const frame =
    photoUrl && loadedUrl === photoUrl
      ? kitchenPortraitFrame(
          dimensions,
          viewport,
          kitchenPortraitFocus(photoUrl),
        )
      : null;
  return (
    <div ref={container} className="kitchen-portrait" data-has-photo={hasPhoto}>
      <div
        className="kitchen-portrait-fallback"
        aria-hidden={hasPhoto}
        aria-label={`Photo unavailable for ${employee.name}`}
      >
        <span aria-hidden="true">{initials(employee.name)}</span>
      </div>
      {photoUrl && (
        <img
          src={photoUrl}
          alt={employee.name}
          referrerPolicy="no-referrer"
          decoding="async"
          data-loaded={Boolean(frame)}
          style={frame ?? undefined}
          onLoad={(event) => {
            const image = event.currentTarget;
            setDimensions({
              width: image.naturalWidth,
              height: image.naturalHeight,
            });
            setLoadedUrl(photoUrl);
          }}
          onError={() => setFailedUrls((urls) => [...urls, photoUrl])}
        />
      )}
    </div>
  );
}

function Person({
  employee,
  manager = false,
}: {
  employee: KitchenEmployee;
  manager?: boolean;
}) {
  return (
    <article
      className={`kitchen-person ${manager ? "kitchen-person--manager" : ""}`}
    >
      <Portrait employee={employee} />
      <div className="kitchen-person-copy">
        <span className="kitchen-person-department">
          {manager
            ? "Reporting to"
            : employee.department === "Department not listed"
              ? "IRBIS team"
              : employee.department}
        </span>
        <h3>{employee.name}</h3>
        <p>{employee.title}</p>
      </div>
    </article>
  );
}

function newsPages(body: string) {
  const pages: string[] = [];
  let remaining = body.trim();
  while (remaining.length > 350) {
    const wordBoundary = remaining.lastIndexOf(" ", 350);
    const cut = wordBoundary > 180 ? wordBoundary : 350;
    pages.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) pages.push(remaining);
  return pages;
}

export function buildKitchenSlides(
  data: KitchenBoardData,
  now: Date,
  pageSize = 3,
): Slide[] {
  const org = kitchenOrgPages(
    data.directory.employees,
    pageSize,
    pageSize === 3 ? 4 : pageSize,
  );
  const slides: Slide[] = org.map((group) => ({
    kind: "org",
    id: `org-${group.id}`,
    org: group,
    page: group.page,
    pages: group.pages,
  }));
  if (!org.length)
    slides.push({ kind: "org", id: "org-empty", page: 1, pages: 1 });
  const celebrations = kitchenCelebrations(
    data.directory.employees,
    now,
    data.timezone,
  );
  for (const kind of ["birthdays", "anniversaries"] as const) {
    const events = celebrations[kind];
    if (!events.length)
      slides.push({ kind, id: `${kind}-empty`, events: [], page: 1, pages: 1 });
    for (let offset = 0; offset < events.length; offset += pageSize) {
      slides.push({
        kind,
        id: `${kind}-${offset}`,
        events: events.slice(offset, offset + pageSize),
        page: offset / pageSize + 1,
        pages: Math.ceil(events.length / pageSize),
      });
    }
  }
  const announcements = data.news.flatMap((news) =>
    newsPages(news.body).map((body, index) => ({
      ...news,
      id: `${news.id}-${index}`,
      body,
    })),
  );
  if (!announcements.length)
    slides.push({ kind: "news", id: "news-empty", page: 1, pages: 1 });
  announcements.forEach((news, index) =>
    slides.push({
      kind: "news",
      id: `news-${news.id}`,
      news,
      page: index + 1,
      pages: announcements.length,
    }),
  );
  return slides;
}

/** Empty sections remain available manually but never occupy an unattended TV screen. */
export function nextKitchenSlide(slides: Slide[], current: number) {
  for (let offset = 1; offset <= slides.length; offset++) {
    const index = (current + offset) % slides.length;
    const slide = slides[index]!;
    if (slide.org?.employees.length || slide.events?.length || slide.news)
      return index;
  }
  return current;
}

function Celebration({
  event,
  kind,
  month,
}: {
  event: KitchenCelebration;
  kind: "birthdays" | "anniversaries";
  month: string;
}) {
  return (
    <article
      className={`kitchen-celebration ${event.isToday ? "kitchen-celebration--today" : ""}`}
    >
      <div className="kitchen-celebration-photo">
        <Portrait employee={event.employee} />
        <div className="kitchen-event-date">
          <CalendarDays aria-hidden="true" />
          {month} {event.day}
          {event.isToday && <span>Today</span>}
        </div>
      </div>
      <div className="kitchen-celebration-copy">
        <span className="kitchen-person-department">
          {event.employee.department === "Department not listed"
            ? "IRBIS team"
            : event.employee.department}
        </span>
        <h3>{event.employee.name}</h3>
        <p>{event.employee.title}</p>
        <div className="kitchen-event-message">
          {kind === "anniversaries" ? (
            <>
              <strong>{event.years}</strong>
              <span>
                {event.years === 1 ? "year" : "years"}
                <small>with IRBIS</small>
              </span>
            </>
          ) : (
            <>
              <Cake aria-hidden="true" />
              <span>
                {event.isToday ? "Happy birthday!" : "Celebrating this month"}
              </span>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export function KitchenBoard({
  tvMode,
  autoplay,
  intervalSeconds = 20,
  initialData,
}: {
  tvMode: boolean;
  autoplay: boolean;
  intervalSeconds?: number;
  initialData?: KitchenBoardData;
}) {
  const [data, setData] = useState<KitchenBoardData | null>(
    initialData ?? null,
  );
  const [networkError, setNetworkError] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [slideIndex, setSlideIndex] = useState(0);
  const [running, setRunning] = useState(autoplay);
  const [retry, setRetry] = useState(0);
  const [pageSize, setPageSize] = useState(3);
  const boardRef = useRef<HTMLDivElement>(null);
  const seconds = Math.min(120, Math.max(10, intervalSeconds));

  useEffect(() => {
    const update = () => {
      const width = boardRef.current?.clientWidth || window.innerWidth;
      setPageSize(width < 700 ? 1 : width < 1100 ? 2 : 3);
    };
    update();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (boardRef.current) observer?.observe(boardRef.current);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [data?.status]);

  useEffect(() => {
    if (initialData) return;
    let alive = true,
      busy = false;
    let controller: AbortController | null = null;
    async function load() {
      if (busy) return;
      busy = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 15_000);
      try {
        const response = await fetch("/api/dashboard/kitchen", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Board unavailable");
        const body: KitchenBoardData = await response.json();
        if (
          !Array.isArray(body.directory?.employees) ||
          !Array.isArray(body.news) ||
          !body.timezone
        )
          throw new Error("Invalid board");
        if (alive) {
          setData(body);
          setNetworkError(false);
        }
      } catch {
        if (alive) {
          setNetworkError(true);
          setData(null);
        }
      } finally {
        window.clearTimeout(timeout);
        busy = false;
      }
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);
    return () => {
      alive = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [initialData, retry]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const slides = useMemo(
    () => (data ? buildKitchenSlides(data, now, pageSize) : []),
    [data, now, pageSize],
  );
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const currentIndex = slides.length ? slideIndex % slides.length : 0;
  const slide = slides[currentIndex];
  useEffect(() => {
    const upcoming = slides[nextKitchenSlide(slides, currentIndex)];
    const people = upcoming?.org
      ? [upcoming.org.manager, ...upcoming.org.employees]
      : (upcoming?.events?.map((event) => event.employee) ?? []);
    for (const employee of people) {
      if (!employee?.photoUrl) continue;
      const photo = new Image();
      photo.referrerPolicy = "no-referrer";
      photo.src = kitchenPhotoSrc(employee, employee.photoUrl);
    }
  }, [slides, currentIndex]);
  useEffect(() => {
    if (!running || slides.length < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden)
        setSlideIndex((index) =>
          nextKitchenSlide(slidesRef.current, index % slidesRef.current.length),
        );
    }, seconds * 1000);
    return () => window.clearInterval(timer);
    // The content refresh must not restart the current screen's timer.
  }, [running, slides.length, seconds]);

  const navigate = (delta: number) => {
    setRunning(false);
    setSlideIndex((currentIndex + delta + slides.length) % slides.length);
  };
  const selectTab = (kind: Kind) => {
    setRunning(false);
    setSlideIndex(
      Math.max(
        0,
        slides.findIndex((item) => item.kind === kind),
      ),
    );
  };
  const dateFormat = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", {
      ...options,
      timeZone: data?.timezone ?? "America/Los_Angeles",
    });
  const month = dateFormat({ month: "long" }).format(now);
  const activeTab = TABS.find((tab) => tab.kind === slide?.kind) ?? TABS[0]!;
  const SectionIcon = activeTab.icon;
  const sectionSlides = slides.filter((item) => item.kind === slide?.kind);
  const sectionPage =
    sectionSlides.findIndex((item) => item.id === slide?.id) + 1;
  const reportsCount = slide?.org?.manager
    ? data?.directory.employees.filter(
        (employee) => employee.managerId === slide.org?.manager?.id,
      ).length
    : null;
  const title =
    slide?.kind === "org"
      ? slide.org?.manager
        ? `${slide.org.manager.name}’s team`
        : "Meet our team"
      : slide?.kind === "birthdays"
        ? `${month} birthdays`
        : slide?.kind === "anniversaries"
          ? "Work anniversaries"
          : "Company news";
  const isReady = data?.status === "ready" && slide;

  return (
    <div
      ref={boardRef}
      className={`kitchen-board ${tvMode ? "kitchen-board--tv" : ""}`}
      data-kitchen-board="true"
      data-slide-kind={isReady ? slide.kind : "loading"}
    >
      {isReady ? (
        <>
          <div className="kitchen-heading">
            <div>
              <div className="kitchen-label">
                <SectionIcon aria-hidden="true" />
                {slide.kind === "org"
                  ? "OUR PEOPLE"
                  : slide.kind === "news"
                    ? "LATEST UPDATES"
                    : `${month.toUpperCase()} ${dateFormat({ year: "numeric" }).format(now)}`}
              </div>
              <h1>{title}</h1>
              <p>
                {slide.kind === "org"
                  ? reportsCount !== null
                    ? `${reportsCount} direct reports`
                    : `${data.directory.employees.length} people. One IRBIS team.`
                  : slide.kind === "birthdays"
                    ? "Celebrating our people."
                    : slide.kind === "anniversaries"
                      ? "Thank you for being part of IRBIS."
                      : "Updates from across the company."}
              </p>
            </div>
            <div className="kitchen-page-position">
              <span>{String(sectionPage).padStart(2, "0")}</span>
              <i>/</i>
              {String(sectionSlides.length).padStart(2, "0")}
            </div>
          </div>

          <section
            className={`kitchen-stage kitchen-stage--${slide.kind}`}
            aria-label={activeTab.label}
          >
            {slide.kind === "org" &&
              (slide.org ? (
                <div
                  key={slide.id}
                  className={`kitchen-org ${slide.org.manager ? "kitchen-org--team" : "kitchen-org--overview"}`}
                  data-single={slide.org.employees.length === 1}
                  style={
                    {
                      "--people-count": slide.org.employees.length,
                      "--report-weight": `${slide.org.employees.length}fr`,
                    } as CSSProperties
                  }
                >
                  {slide.org.manager && (
                    <>
                      <Person employee={slide.org.manager} manager />
                      <div
                        className="kitchen-report-connector"
                        aria-hidden="true"
                      >
                        <span />
                        <ArrowRight />
                      </div>
                    </>
                  )}
                  <div
                    className="kitchen-people-grid"
                    style={
                      {
                        "--people-count": slide.org.employees.length,
                      } as CSSProperties
                    }
                  >
                    {slide.org.employees.map((employee) => (
                      <Person key={employee.id} employee={employee} />
                    ))}
                  </div>
                </div>
              ) : (
                <Empty
                  icon={UsersRound}
                  title="No active employees to display"
                  text="Employee information will appear here when it is available."
                />
              ))}
            {(slide.kind === "birthdays" || slide.kind === "anniversaries") &&
              (slide.events?.length ? (
                <div
                  key={slide.id}
                  className={`kitchen-celebrations ${slide.events.length === 1 ? "kitchen-celebrations--single" : ""}`}
                  style={
                    { "--people-count": slide.events.length } as CSSProperties
                  }
                >
                  {slide.events.map((event) => (
                    <Celebration
                      key={event.employee.id}
                      event={event}
                      kind={slide.kind as "birthdays" | "anniversaries"}
                      month={month.slice(0, 3)}
                    />
                  ))}
                </div>
              ) : (
                <Empty
                  icon={SectionIcon}
                  title={`No ${slide.kind === "birthdays" ? "birthdays" : "work anniversaries"} listed for ${month}`}
                  text="The next month’s celebrations will appear automatically."
                />
              ))}
            {slide.kind === "news" &&
              (slide.news ? (
                <article key={slide.id} className="kitchen-news">
                  <div className="kitchen-news-category">
                    <Newspaper aria-hidden="true" />
                    COMPANY UPDATE
                  </div>
                  <h2>{slide.news.title}</h2>
                  <p>{slide.news.body}</p>
                </article>
              ) : (
                <Empty
                  icon={Newspaper}
                  title="You’re up to date"
                  text="Company updates will appear here when available."
                />
              ))}
          </section>

          <footer className="kitchen-footer">
            <nav className="kitchen-tabs" aria-label="People and news sections">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.kind}
                    aria-pressed={slide.kind === tab.kind}
                    onClick={() => selectTab(tab.kind)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="kitchen-playback">
              <button
                className="kitchen-icon-button"
                aria-label="Previous screen"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="kitchen-play-toggle"
                aria-label={running ? "Pause rotation" : "Start rotation"}
                aria-pressed={running}
                onClick={() => setRunning(!running)}
              >
                {running ? (
                  <Pause aria-hidden="true" />
                ) : (
                  <Play aria-hidden="true" />
                )}
                <span>{running ? "Pause" : "Play"}</span>
              </button>
              <button
                className="kitchen-icon-button"
                aria-label="Next screen"
                onClick={() => navigate(1)}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          </footer>
          <div className="kitchen-status-line">
            <span
              className={
                data.stale ? "kitchen-sync kitchen-sync--stale" : "kitchen-sync"
              }
            >
              {data.stale ? (
                <CircleAlert aria-hidden="true" />
              ) : (
                <span className="kitchen-sync-dot" />
              )}
              {data.stale
                ? "Showing the last available update"
                : "Updated automatically"}
              {data.syncedAt && (
                <span>
                  {" "}
                  ·{" "}
                  {dateFormat({ hour: "numeric", minute: "2-digit" }).format(
                    new Date(data.syncedAt),
                  )}
                </span>
              )}
            </span>
            <span>
              {currentIndex + 1} of {slides.length} screens
              {running ? ` · ${seconds}s per screen` : " · Paused"}
            </span>
          </div>
        </>
      ) : (
        <section className="kitchen-waiting" role="status">
          {!data && !networkError ? (
            <>
              <RefreshCw className="kitchen-loading-icon" aria-hidden="true" />
              <h1>Loading our people</h1>
              <p>Getting the latest employee information.</p>
            </>
          ) : (
            <>
              <CircleAlert aria-hidden="true" />
              <h1>Our people board is temporarily unavailable</h1>
              <p>We’ll reconnect automatically. You can also try again.</p>
              <button
                className="kitchen-retry"
                onClick={() => setRetry((value) => value + 1)}
              >
                <RefreshCw aria-hidden="true" />
                Try again
              </button>
            </>
          )}
          <a href="/company-wide">
            <ArrowLeft aria-hidden="true" />
            Back to dashboards
          </a>
        </section>
      )}
    </div>
  );
}

function Empty({
  title,
  text,
  icon: Icon,
}: {
  title: string;
  text: string;
  icon: LucideIcon;
}) {
  return (
    <div className="kitchen-empty">
      <Icon aria-hidden="true" />
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}
