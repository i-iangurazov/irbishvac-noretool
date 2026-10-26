"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import {
  dateValue,
  displayDate,
  membershipPeriods,
  monthStart,
  periodDays,
  shiftDate,
} from "./membership-period";
import "./membership-period-picker.css";

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const months = Array.from({ length: 12 }, (_, i) =>
  displayDate(`2026-${String(i + 1).padStart(2, "0")}-01`, {
    month: "long",
    day: undefined,
    year: undefined,
  }),
);

export function MembershipPeriodPicker({
  from,
  to,
  today,
  label,
  query,
}: {
  from: string;
  to: string;
  today: string;
  label: string;
  query: string;
}) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  const [single, setSingle] = useState(from === to);
  const [choosingEnd, setChoosingEnd] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [view, setView] = useState(monthStart(from));
  const [focused, setFocused] = useState(from);
  const [rolling, setRolling] = useState<string | null>(null);
  const [quick, setQuick] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLFormElement>(null);
  const id = useId();
  const presets = membershipPeriods(today);
  const valid = Boolean(start && end && start <= end);
  const years = Array.from(
    {
      length: Math.max(
        11,
        Number(today.slice(0, 4)) - Number(from.slice(0, 4)) + 6,
      ),
    },
    (_, i) =>
      Math.min(Number(from.slice(0, 4)), Number(today.slice(0, 4)) - 5) + i,
  );

  function close() {
    // End the native modal's inert state before returning focus to its trigger.
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }
  function show() {
    setStart(from);
    setEnd(to);
    setSingle(from === to);
    setChoosingEnd(false);
    setHovered(null);
    setView(monthStart(from));
    setFocused(from);
    const params = new URLSearchParams(query);
    setRolling(!params.has("from") ? params.get("preset") : null);
    setQuick(
      !params.has("from") && ["mtd", "ytd"].includes(params.get("preset") ?? "")
        ? params.get("preset")
        : (presets.find((period) => period.from === from && period.to === to)
            ?.id ?? null),
    );
    setOpen(true);
  }
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    element.showModal();
    function position() {
      if (!trigger.current || !panel.current) return;
      const bounds = trigger.current.getBoundingClientRect();
      const width = Math.min(760, window.innerWidth - 24);
      const height = Math.min(
        panel.current.getBoundingClientRect().height,
        window.innerHeight - 24,
      );
      const left = Math.max(
        12,
        Math.min(bounds.right - width, window.innerWidth - width - 12),
      );
      const top = Math.max(
        12,
        Math.min(bounds.bottom + 10, window.innerHeight - height - 12),
      );
      Object.assign(element.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
      });
    }
    position();
    const observer = new ResizeObserver(position);
    if (panel.current) observer.observe(panel.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      element.close();
    };
  }, [open]);

  function pick(date: string) {
    setRolling(null);
    setQuick(null);
    setHovered(null);
    setFocused(date);
    if (single) {
      setStart(date);
      setEnd(date);
      return;
    }
    if (!choosingEnd) {
      setStart(date);
      setEnd("");
      setChoosingEnd(true);
    } else {
      setStart(date < start ? date : start);
      setEnd(date < start ? start : date);
      setChoosingEnd(false);
    }
  }
  function editStart(value: string) {
    setStart(value);
    if (single) setEnd(value);
    setRolling(null);
    setQuick(null);
    setChoosingEnd(false);
    if (value) {
      setView(monthStart(value));
      setFocused(value);
    }
  }
  function editEnd(value: string) {
    setEnd(value);
    setRolling(null);
    setQuick(null);
    setChoosingEnd(false);
  }
  function calendarKey(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const offset = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -dateValue(date).getUTCDay(),
      End: 6 - dateValue(date).getUTCDay(),
    }[event.key];
    let next: string;
    if (offset !== undefined) next = shiftDate(date, offset);
    else if (event.key === "PageUp" || event.key === "PageDown")
      next = monthStart(date, event.key === "PageUp" ? -1 : 1);
    else return;
    event.preventDefault();
    setFocused(next);
    const visibleMonths = window.matchMedia("(max-width: 650px)").matches
      ? 1
      : 2;
    if (next < view || next >= monthStart(view, visibleMonths))
      setView(monthStart(next));
    requestAnimationFrame(() =>
      panel.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)
        ?.focus(),
    );
  }
  const previewEnd = choosingEnd ? (hovered ?? start) : end;
  const low = previewEnd && previewEnd < start ? previewEnd : start;
  const high = previewEnd && previewEnd > start ? previewEnd : start;
  function calendar(month: string, second = false) {
    const firstDay = dateValue(month).getUTCDay();
    const count = dateValue(shiftDate(monthStart(month, 1), -1)).getUTCDate();
    return (
      <section
        className={`membership-calendar${second ? " membership-calendar--second" : ""}`}
        aria-label={displayDate(month, { month: "long", day: undefined })}
      >
        <h3>{displayDate(month, { month: "long", day: undefined })}</h3>
        <div className="membership-calendar__week" aria-hidden="true">
          {weekdays.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div
          className="membership-calendar__days"
          role="group"
          aria-label={`Dates in ${displayDate(month, { month: "long", day: undefined })}`}
        >
          {Array.from({ length: firstDay }, (_, i) => (
            <span key={`blank${i}`} />
          ))}
          {Array.from({ length: count }, (_, i) => {
            const date = shiftDate(month, i),
              edge = date === start || date === end;
            return (
              <button
                type="button"
                key={date}
                data-date={date}
                data-edge={edge}
                data-in-range={Boolean(
                  low && high && date >= low && date <= high,
                )}
                data-today={date === today}
                aria-label={displayDate(date, { weekday: "long" })}
                aria-pressed={edge}
                aria-current={date === today ? "date" : undefined}
                tabIndex={date === focused ? 0 : -1}
                onClick={() => pick(date)}
                onFocus={() => setFocused(date)}
                onKeyDown={(event) => calendarKey(event, date)}
                onMouseEnter={() => setHovered(date)}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
      </section>
    );
  }
  return (
    <div className="membership-period">
      <button
        type="button"
        className="csr-button membership-period__trigger"
        ref={trigger}
        onClick={show}
        aria-label={`Reporting period: ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
      >
        <CalendarDays size={17} />
        <span>{label}</span>
        <ChevronDown size={15} />
      </button>
      {open &&
        createPortal(
          <dialog
            className="membership-period-dialog"
            id={id}
            ref={dialog}
            aria-labelledby={`${id}-title`}
            onCancel={(event) => {
              event.preventDefault();
              close();
            }}
            onClick={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <form
              ref={panel}
              method="get"
              className="membership-period-panel"
              onSubmit={(event) => {
                if (!valid) event.preventDefault();
              }}
            >
              <header className="membership-period__heading">
                <div>
                  <h2 id={`${id}-title`}>Choose reporting period</h2>
                  <p>Use a quick period or select dates below.</p>
                </div>
                <button
                  type="button"
                  className="membership-period__icon"
                  aria-label="Close date picker"
                  onClick={close}
                >
                  <X size={19} />
                </button>
              </header>
              {Array.from(new URLSearchParams(query))
                .filter(
                  ([key]) =>
                    !["from", "to", "range", "page", "preset"].includes(key),
                )
                .map(([key, value]) => (
                  <input type="hidden" key={key} name={key} value={value} />
                ))}
              <input
                type="hidden"
                name="preset"
                value={rolling === "ytd" ? "ytd" : "mtd"}
              />
              {rolling !== "mtd" && rolling !== "ytd" && (
                <>
                  <input type="hidden" name="from" value={start} />
                  <input type="hidden" name="to" value={end} />
                  <input type="hidden" name="range" value="fixed" />
                </>
              )}
              <div className="membership-period__body">
                <aside
                  className="membership-period__presets"
                  aria-label="Quick reporting periods"
                >
                  {presets.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      aria-pressed={quick === preset.id}
                      onClick={() => {
                        setStart(preset.from);
                        setEnd(preset.to);
                        setSingle(preset.from === preset.to);
                        setChoosingEnd(false);
                        setHovered(null);
                        setView(monthStart(preset.from));
                        setFocused(preset.from);
                        setQuick(preset.id);
                        setRolling(
                          preset.id === "mtd" || preset.id === "ytd"
                            ? preset.id
                            : null,
                        );
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <span>Dates use Pacific time.</span>
                </aside>
                <div className="membership-period__custom">
                  <div
                    className="membership-period__mode"
                    role="group"
                    aria-label="Date selection mode"
                  >
                    <button
                      type="button"
                      aria-pressed={!single}
                      onClick={() => {
                        setSingle(false);
                        setChoosingEnd(false);
                        setQuick(null);
                      }}
                    >
                      Date range
                    </button>
                    <button
                      type="button"
                      aria-pressed={single}
                      onClick={() => {
                        setSingle(true);
                        setEnd(start);
                        setChoosingEnd(false);
                        setRolling(null);
                        setQuick(null);
                      }}
                    >
                      Single date
                    </button>
                  </div>
                  <div className="membership-period__inputs">
                    <label>
                      {single ? "Date" : "Start date"}
                      <input
                        aria-label="Start date"
                        type="date"
                        required
                        value={start}
                        onInput={(event) =>
                          editStart(event.currentTarget.value)
                        }
                        onChange={(event) => editStart(event.target.value)}
                      />
                    </label>
                    {!single && (
                      <>
                        <span aria-hidden="true">→</span>
                        <label>
                          End date
                          <input
                            aria-label="End date"
                            type="date"
                            required
                            value={end}
                            aria-invalid={Boolean(start && end && !valid)}
                            onInput={(event) =>
                              editEnd(event.currentTarget.value)
                            }
                            onChange={(event) => editEnd(event.target.value)}
                          />
                        </label>
                      </>
                    )}
                  </div>
                  <div className="membership-calendar__navigation">
                    <button
                      type="button"
                      className="membership-period__icon"
                      aria-label="Previous month"
                      onClick={() => {
                        setView(monthStart(view, -1));
                        setFocused(monthStart(view, -1));
                      }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <div>
                      <select
                        aria-label="Calendar month"
                        value={Number(view.slice(5, 7))}
                        onChange={(event) => {
                          const date = `${view.slice(0, 4)}-${String(event.target.value).padStart(2, "0")}-01`;
                          setView(date);
                          setFocused(date);
                        }}
                      >
                        {months.map((name, i) => (
                          <option key={name} value={i + 1}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Calendar year"
                        value={Number(view.slice(0, 4))}
                        onChange={(event) => {
                          const date = `${event.target.value}-${view.slice(5)}`;
                          setView(date);
                          setFocused(date);
                        }}
                      >
                        {[...new Set([...years, Number(view.slice(0, 4))])]
                          .sort((a, b) => a - b)
                          .map((year) => (
                            <option key={year} value={year}>
                              {year}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="membership-period__icon"
                      aria-label="Next month"
                      onClick={() => {
                        setView(monthStart(view, 1));
                        setFocused(monthStart(view, 1));
                      }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div
                    className="membership-calendars"
                    onMouseLeave={() => setHovered(null)}
                  >
                    {calendar(view)}
                    {calendar(monthStart(view, 1), true)}
                  </div>
                  <p
                    className={`membership-period__instruction${start && end && !valid ? " membership-period__instruction--error" : ""}`}
                    role="status"
                  >
                    {start && end && !valid
                      ? "End date must be on or after the start date."
                      : single
                        ? "Select one day on the calendar."
                        : choosingEnd
                          ? "Now choose the end date. Either direction works."
                          : "Select a start date, then an end date."}
                  </p>
                </div>
              </div>
              <footer className="membership-period__footer">
                <div aria-live="polite">
                  {valid ? (
                    <>
                      <strong>
                        {displayDate(start)}
                        {start !== end && ` – ${displayDate(end)}`}
                      </strong>
                      <span>
                        {periodDays(start, end)}{" "}
                        {start === end ? "day" : "days"} selected
                      </span>
                    </>
                  ) : (
                    <strong>Choose an end date</strong>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    className="membership-period__cancel"
                    onClick={close}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="membership-period__apply"
                    disabled={!valid}
                  >
                    Apply period
                  </button>
                </div>
              </footer>
            </form>
          </dialog>,
          document.body,
        )}
    </div>
  );
}
