"use client";
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Maximize,
  RefreshCw,
} from "lucide-react";
import {
  kitchenBusinessDate,
  kitchenCelebrations,
  type KitchenBoardData,
  type KitchenEmployee,
  type KitchenCelebration,
} from "../../../packages/domain/src/kitchen-board";
import {
  buildKitchenSlides,
  kitchenLeadership,
  kitchenCrewGroups,
  kitchenMonthKey,
  KITCHEN_SCREEN_MS,
  KITCHEN_INSIDER_MS,
  type KitchenKind,
  type KitchenSlide,
} from "../lib/kitchen-layout";
import {
  kitchenPortraitUsable,
  kitchenPortraitFocus,
  kitchenPortraitFrame,
} from "../lib/kitchen-portrait";
import type { NewsletterInfo } from "../lib/kitchen-newsletter";
export { buildKitchenSlides } from "../lib/kitchen-layout";
export const nextKitchenSlide = (slides: KitchenSlide[], current: number) =>
  slides.length ? (current + 1) % slides.length : 0;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
function Portrait({ employee }: { employee: KitchenEmployee }) {
  const [failed, setFailed] = useState<string[]>([]);
  const [frame, setFrame] = useState<CSSProperties | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const urls = [
    employee.photoSource === "cloudflare" && employee.photoUrl
      ? `/_next/image?url=${encodeURIComponent(employee.photoUrl)}&w=640&q=90`
      : employee.photoUrl,
    employee.photoUrl,
    employee.photoFallbackUrl,
  ];
  const src = urls.find((url): url is string =>
    Boolean(url && !failed.includes(url) && kitchenPortraitUsable(url)),
  );
  return (
    <div className="kitchen-avatar" ref={ref}>
      <span aria-hidden="true">{initials(employee.name)}</span>
      {src && (
        <img
          key={src}
          src={src}
          alt={employee.name}
          referrerPolicy="no-referrer"
          style={frame ?? undefined}
          onLoad={(event) => {
            const img = event.currentTarget,
              box = ref.current;
            if (box)
              setFrame(
                kitchenPortraitFrame(
                  { width: img.naturalWidth, height: img.naturalHeight },
                  { width: box.clientWidth, height: box.clientHeight },
                  kitchenPortraitFocus(src),
                ),
              );
          }}
          onError={() => {
            setFailed((value) => [...value, src]);
            setFrame(null);
          }}
        />
      )}
    </div>
  );
}
function PersonRow({ person }: { person: KitchenEmployee }) {
  return (
    <article className="kitchen-person-row">
      <Portrait employee={person} />
      <div>
        <h3>{person.name}</h3>
        <p>{person.title}</p>
      </div>
    </article>
  );
}
function Leader({
  person,
  count,
  orange = false,
}: {
  person: KitchenEmployee;
  count?: number;
  orange?: boolean;
}) {
  return (
    <article
      className={`kitchen-leader ${orange ? "kitchen-leader--orange" : ""}`}
    >
      <Portrait employee={person} />
      <div>
        <h3>{person.name}</h3>
        <p>{person.title}</p>
        {count !== undefined && count > 0 && <strong>{count} on team</strong>}
      </div>
    </article>
  );
}
function Leadership({
  slide,
  data,
}: {
  slide: KitchenSlide;
  data: KitchenBoardData;
}) {
  const { roots, reports } = kitchenLeadership(data.directory.employees);
  const branches = slide.branches ?? [];
  return (
    <div
      className="kitchen-org"
      style={
        { "--branch-count": Math.max(1, branches.length) } as CSSProperties
      }
    >
      <div className="kitchen-executives">
        {roots.map((root) => {
          const count = branches.filter(
            (branch) => branch.executive.id === root.id,
          ).length;
          return (
            <div
              key={root.id}
              className="kitchen-executive-zone"
              style={{ gridColumn: `span ${Math.max(1, count)}` }}
            >
              <article
                className={`kitchen-executive ${/\bCEO\b|chief executive/i.test(root.title) ? "kitchen-executive--ceo" : ""}`}
              >
                <Portrait employee={root} />
                <div>
                  <span>Executive</span>
                  <h2>{root.name}</h2>
                  <p>
                    {root.title} · {reports(root.id).length} direct
                  </p>
                </div>
              </article>
              <div className="kitchen-root-line" />
            </div>
          );
        })}
      </div>
      <div className="kitchen-branches">
        {branches.map((branch, index) => {
          const crew = branch.installation
            ? kitchenCrewGroups(reports(branch.leader!.id))
            : [];
          const sameBefore =
            branches[index - 1]?.executive.id === branch.executive.id;
          const sameAfter =
            branches[index + 1]?.executive.id === branch.executive.id;
          return (
            <section
              key={`${branch.executive.id}-${branch.leader?.id ?? branch.label}`}
              className="kitchen-branch"
            >
              <div
                className="kitchen-branch-connector"
                data-before={sameBefore}
                data-after={sameAfter}
              />
              {branch.leader ? (
                <Leader
                  person={branch.leader}
                  count={reports(branch.leader.id).length}
                />
              ) : (
                <article className="kitchen-service-leader">
                  <h3>{branch.label}</h3>
                  <p>Report to {branch.executive.name.split(" ")[0]}</p>
                  <strong>{branch.people.length} technicians</strong>
                </article>
              )}
              {branch.installation ? (
                <>
                  <div className="kitchen-crew-summary">
                    <h4>Crew breakdown</h4>
                    {crew.map((group) => (
                      <div key={group.label}>
                        <span>{group.label.replace("HVAC ", "")}</span>
                        <strong>{group.people.length}</strong>
                      </div>
                    ))}
                  </div>
                  <p className="kitchen-crew-link">Full crew on screen 2</p>
                </>
              ) : (
                <div className="kitchen-report-rows">
                  {branch.people.map((person) => (
                    <PersonRow person={person} key={person.id} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
function Crew({
  slide,
  data,
}: {
  slide: KitchenSlide;
  data: KitchenBoardData;
}) {
  const { installationManager: manager, reports } = kitchenLeadership(
    data.directory.employees,
  );
  if (!manager) return null;
  const boss = data.directory.employees.find(
    (person) => person.id === manager.managerId,
  );
  return (
    <div className="kitchen-crew">
      <div className="kitchen-crew-banner">
        <Portrait employee={manager} />
        <div>
          <h2>
            {manager.name} · {manager.title}
          </h2>
          <p>
            {boss ? `Reports to ${boss.name} · ` : ""}
            {manager.department}
          </p>
        </div>
        <strong>
          {reports(manager.id).length}
          <span>direct reports</span>
        </strong>
      </div>
      <div
        className="kitchen-crew-columns"
        style={
          {
            "--crew-columns": Math.max(1, slide.columns?.length ?? 1),
          } as CSSProperties
        }
      >
        {slide.columns?.map((column, index) => (
          <div className="kitchen-crew-column" key={index}>
            {column.map((group) => (
              <section
                className={`kitchen-crew-group kitchen-tone-${group.tone}`}
                key={group.label}
              >
                <h3>
                  {group.label} · {group.people.length}
                </h3>
                <div>
                  {group.people.map((person) => (
                    <PersonRow person={person} key={person.id} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
function Birthday({
  event,
  day,
  month,
}: {
  event: KitchenCelebration;
  day: number;
  month: string;
}) {
  const passed = event.day < day;
  return (
    <article
      className={`kitchen-birthday ${passed ? "kitchen-event--passed" : ""}`}
    >
      <div className="kitchen-birthday-top">
        <Portrait employee={event.employee} />
        <span
          className={`kitchen-date-pill ${passed ? "kitchen-date-pill--passed" : ""}`}
        >
          {passed ? "🎈" : "🎂"} {month} {event.day}
          {passed ? " · passed" : ""}
        </span>
      </div>
      <h2>{event.employee.name}</h2>
      <p>{event.employee.title}</p>
    </article>
  );
}
function Anniversary({
  event,
  day,
  month,
}: {
  event: KitchenCelebration;
  day: number;
  month: string;
}) {
  const passed = event.day < day;
  return (
    <article
      className={`kitchen-anniversary ${passed ? "kitchen-event--passed" : ""}`}
    >
      <div className="kitchen-anniversary-date">
        <strong>
          🎉 {month} {event.day}
        </strong>
        <span
          className={`kitchen-date-pill ${passed ? "kitchen-date-pill--passed" : ""}`}
        >
          {passed ? "passed" : event.day === day ? "today" : "upcoming"}
        </span>
      </div>
      <div className="kitchen-years">
        <strong>{event.years}</strong>
        <span>{event.years === 1 ? "year" : "years"} 🎆</span>
      </div>
      <div className="kitchen-anniversary-person">
        <Portrait employee={event.employee} />
        <div>
          <h2>{event.employee.name}</h2>
          <p>{event.employee.title}</p>
        </div>
      </div>
    </article>
  );
}
const tabs: { kind: KitchenKind; label: string }[] = [
  { kind: "org", label: "Leadership" },
  { kind: "crew", label: "Installation crew" },
  { kind: "birthdays", label: "Birthdays" },
  { kind: "anniversaries", label: "Anniversaries" },
  { kind: "news", label: "IRBIS Insider" },
];
export function KitchenBoard({
  tvMode,
  autoplay,
  initialData,
  brandLogoUrl,
}: {
  tvMode: boolean;
  autoplay: boolean;
  initialData?: KitchenBoardData;
  brandLogoUrl?: string | null;
}) {
  const [data, setData] = useState<KitchenBoardData | null>(
      initialData ?? null,
    ),
    [networkError, setNetworkError] = useState(false);
  const [now, setNow] = useState(() => new Date()),
    [index, setIndex] = useState(0),
    [running, setRunning] = useState(autoplay),
    [scale, setScale] = useState(1);
  const [issue, setIssue] = useState<NewsletterInfo | null>(null),
    [issueError, setIssueError] = useState(false);
  const [canUpload, setCanUpload] = useState(false),
    [retry, setRetry] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const timezone = data?.timezone ?? "America/Los_Angeles",
    monthKey = kitchenMonthKey(now, timezone);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const measure = () =>
      setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080));
    measure();
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;
    observer?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(tick);
  }, []);
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
        if (!response.ok) throw new Error();
        const body: KitchenBoardData = await response.json();
        if (!Array.isArray(body.directory?.employees)) throw new Error();
        if (alive) {
          setData(body.status === "ready" ? body : null);
          setNetworkError(body.status !== "ready");
        }
      } catch {
        if (alive) {
          setNetworkError(true);
          setData((previous) =>
            previous?.syncedAt &&
            Date.now() - new Date(previous.syncedAt).getTime() <= 86_400_000
              ? previous
              : null,
          );
        }
      } finally {
        window.clearTimeout(timeout);
        busy = false;
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [initialData, retry]);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setIssue((previous) => (previous?.month === monthKey ? previous : null));
    async function load() {
      try {
        const response = await fetch(`/api/kitchen/insider?month=${monthKey}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (alive) {
          setIssue(body.issue);
          setCanUpload(body.canUpload);
          setIssueError(false);
        }
      } catch {
        if (alive) setIssueError(true);
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [monthKey]);
  const slides = useMemo(
    () => (data ? buildKitchenSlides(data, now, true) : []),
    [data, now],
  );
  const current = slides[index % Math.max(1, slides.length)];
  const duration =
    current?.kind === "news" ? KITCHEN_INSIDER_MS : KITCHEN_SCREEN_MS;
  useEffect(() => {
    if (!running || slides.length < 2) return;
    const timer = window.setTimeout(
      () => setIndex((value) => (value + 1) % slides.length),
      duration,
    );
    return () => window.clearTimeout(timer);
  }, [running, index, slides.length, duration]);
  useEffect(() => {
    setIndex(0);
  }, [monthKey]);
  const date = kitchenBusinessDate(now, timezone),
    month = new Intl.DateTimeFormat("en-US", {
      month: "long",
      timeZone: timezone,
    }).format(now),
    shortMonth = month.slice(0, 3);
  const { installationManager } = kitchenLeadership(
    data?.directory.employees ?? [],
  );
  const celebrations = data
    ? kitchenCelebrations(data.directory.employees, now, timezone)
    : null;
  const title =
    current?.kind === "org"
      ? "Leadership and revenue"
      : current?.kind === "crew"
        ? `${installationManager?.name ?? "Installation"}’s team`
        : current?.kind === "birthdays"
          ? "Happy birthday, team 🎂"
          : current?.kind === "anniversaries"
            ? "Thank you for being part of IRBIS 🎆"
            : "IRBIS Insider";
  const label =
    current?.kind === "org"
      ? "Our people"
      : current?.kind === "crew"
        ? "Our people · Installation crew"
        : `${month} ${date.year} · ${current?.kind === "birthdays" ? "Birthdays" : current?.kind === "anniversaries" ? "Work anniversaries" : "Company news"}`;
  const count =
    current?.kind === "birthdays"
      ? `${celebrations?.birthdays.length ?? 0} birthdays this month`
      : current?.kind === "anniversaries"
        ? `${celebrations?.anniversaries.length ?? 0} this month 🎉`
        : `${data?.directory.employees.length ?? 0} people${current?.kind === "crew" ? " · screen 2" : ""}`;
  const move = (delta: number) => {
    setRunning(false);
    setIndex((index + delta + slides.length) % slides.length);
  };
  return (
    <div
      className={`kitchen-experience ${tvMode ? "kitchen-experience--tv" : ""}`}
    >
      <div className="kitchen-viewport" ref={viewport}>
        <div
          className="kitchen-canvas"
          data-kitchen-board="true"
          data-slide-kind={current?.kind ?? "loading"}
          data-slide-id={current?.id}
          style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
        >
          {data && current ? (
            <>
              <header
                className={`kitchen-heading ${current.kind === "news" ? "kitchen-heading--newsletter" : ""}`}
              >
                {brandLogoUrl && (
                  <img
                    className="kitchen-brand-logo"
                    src={brandLogoUrl}
                    alt="IRBIS Air Plumbing Electrical"
                  />
                )}
                <div className="kitchen-heading-copy">
                  <p>{label}</p>
                  <h1>{title}</h1>
                </div>
                <div
                  className={`kitchen-count ${["birthdays", "anniversaries"].includes(current.kind) ? "kitchen-count--orange" : ""}`}
                >
                  {count}
                </div>
              </header>
              <section
                className={`kitchen-stage kitchen-stage--${current.kind}`}
                key={current.id}
                aria-label={title}
              >
                {current.kind === "org" && (
                  <Leadership slide={current} data={data} />
                )}
                {current.kind === "crew" && (
                  <Crew slide={current} data={data} />
                )}
                {current.kind === "birthdays" && (
                  <div className="kitchen-birthdays">
                    {current.events?.map((event) => (
                      <Birthday
                        key={event.employee.id}
                        event={event}
                        day={date.day}
                        month={shortMonth}
                      />
                    ))}
                  </div>
                )}
                {current.kind === "anniversaries" && (
                  <div
                    className="kitchen-anniversaries"
                    style={
                      {
                        "--celebration-count": current.events?.length ?? 1,
                      } as CSSProperties
                    }
                  >
                    {current.events?.map((event) => (
                      <Anniversary
                        key={event.employee.id}
                        event={event}
                        day={date.day}
                        month={shortMonth}
                      />
                    ))}
                  </div>
                )}
                {current.kind === "news" &&
                  (issue ? (
                    <div className="kitchen-newsletter-pages">
                      {issue.pages.map((src, page) => (
                        <img
                          src={src}
                          alt={`IRBIS Insider ${month} ${date.year}, page ${page + 1} of 2`}
                          key={src}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="kitchen-empty">
                      <h2>
                        {issueError
                          ? "Reconnecting to the IRBIS Insider"
                          : "The new IRBIS Insider is on its way"}
                      </h2>
                      <p>
                        {issueError
                          ? "We’ll retry automatically."
                          : `The ${month} issue will appear here when HR or marketing publishes it.`}
                      </p>
                    </div>
                  ))}
              </section>
              {current.pages > 1 && (
                <div className="kitchen-pagination">
                  Page {current.page} of {current.pages}
                </div>
              )}
              {(data.stale || networkError) && (
                <div className="kitchen-stale">
                  Showing the last available employee update · reconnecting
                  automatically
                </div>
              )}
            </>
          ) : (
            <div className="kitchen-empty">
              <RefreshCw />
              <h1>
                {networkError
                  ? "Reconnecting to our people"
                  : "Loading our people"}
              </h1>
              <p>The board will reconnect automatically.</p>
              {networkError && (
                <button onClick={() => setRetry((value) => value + 1)}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="kitchen-controls">
        <a href="/company-wide" className="kitchen-home">
          IRBIS dashboards
        </a>
        <nav aria-label="Kitchen screens">
          {tabs.map((tab) => (
            <button
              key={tab.kind}
              disabled={!slides.some((slide) => slide.kind === tab.kind)}
              aria-pressed={current?.kind === tab.kind}
              onClick={() => {
                setRunning(false);
                setIndex(
                  Math.max(
                    0,
                    slides.findIndex((slide) => slide.kind === tab.kind),
                  ),
                );
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="kitchen-playback">
          <button
            aria-label="Previous screen"
            onClick={() => move(-1)}
            disabled={!slides.length}
          >
            <ChevronLeft />
          </button>
          <button
            aria-label={running ? "Pause rotation" : "Start rotation"}
            aria-pressed={running}
            onClick={() => setRunning((value) => !value)}
          >
            {running ? <Pause /> : <Play />}
          </button>
          <button
            aria-label="Next screen"
            onClick={() => move(1)}
            disabled={!slides.length}
          >
            <ChevronRight />
          </button>
          <button
            aria-label="Enter fullscreen"
            onClick={() => {
              if (!document.fullscreenElement)
                void document.documentElement.requestFullscreen();
              else void document.exitFullscreen();
            }}
          >
            <Maximize />
          </button>
        </div>
        <span className="kitchen-play-status">
          {(index % Math.max(1, slides.length)) + 1} / {slides.length} ·{" "}
          {running ? `${duration / 1000}s` : "Paused"}
        </span>
        {!tvMode && canUpload && <a href="/kitchen/insider">Upload Insider</a>}
        {!tvMode && (
          <a href="/kitchen?tv=1&kiosk=1&rotate=1">Launch kitchen TV ↗</a>
        )}
      </div>
    </div>
  );
}
