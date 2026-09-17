"use client";

import { MarketingIcon } from "./marketing-icon";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

type CampaignPeriodOption = {
  id: string;
  active: boolean;
  href: string;
  label: string;
};

const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(2026, index, 1))),
);

export function CampaignPeriodSelect({ activeLabel, options }: {
  activeLabel: string;
  options: CampaignPeriodOption[];
}) {
  const activeOption = options.find((option) => option.active) ?? options[0];
  const activeYear = Number(activeOption?.id.slice(0, 4) ?? new Date().getFullYear());
  const years = options.map((option) => Number(option.id.slice(0, 4)));
  const firstYear = years.length ? Math.min(...years) : activeYear;
  const lastYear = years.length ? Math.max(...years) : activeYear;
  const [year, setYear] = useState(activeYear);
  const [open, setOpen] = useState(false);
  const calendarId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const pendingFocusRef = useRef<"active" | "first" | "last" | null>(null);

  useEffect(() => {
    if (!open) return;
    if (pendingFocusRef.current) {
      const links = [...(calendarRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-month]") ?? [])];
      const target = pendingFocusRef.current === "active"
        ? links.find((link) => link.getAttribute("aria-current") === "date") ?? links[0]
        : pendingFocusRef.current === "last" ? links.at(-1) : links[0];
      target?.focus();
      pendingFocusRef.current = null;
    }
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, year]);

  function openCalendar(focus: "active" | "first" | "last" = "active") {
    setYear(activeYear);
    pendingFocusRef.current = focus;
    setOpen(true);
  }

  function handleButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    openCalendar(event.key === "ArrowUp" ? "last" : "active");
  }

  function handleCalendarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!(event.target instanceof HTMLAnchorElement) || !event.target.dataset.month) return;
    const links = [...(calendarRef.current?.querySelectorAll<HTMLAnchorElement>("a[data-month]") ?? [])];
    const index = links.indexOf(event.target);
    const month = Number(event.target.dataset.month);
    let target: HTMLAnchorElement | undefined;
    if (event.key === "ArrowRight") target = links[index + 1];
    if (event.key === "ArrowLeft") target = links[index - 1];
    if (event.key === "ArrowDown") target = links.find((link) => Number(link.dataset.month) === month + 3);
    if (event.key === "ArrowUp") target = links.find((link) => Number(link.dataset.month) === month - 3);
    if (event.key === "Home") target = links[0];
    if (event.key === "End") target = links.at(-1);
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    target?.focus();
  }

  return (
    <div className="campaign-period-select" data-open={open} ref={rootRef}>
      <button
        aria-controls={open ? calendarId : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Reporting month: ${activeLabel}`}
        onClick={() => open ? setOpen(false) : openCalendar()}
        onKeyDown={handleButtonKeyDown}
        ref={buttonRef}
        type="button"
      >
        <MarketingIcon name="calendar" />
        <strong>{activeLabel}</strong>
        <MarketingIcon name="chevron" className="campaign-period-select__chevron" />
      </button>
      {open ? (
        <div
          aria-label="Choose reporting month"
          className="campaign-period-select__calendar"
          id={calendarId}
          onKeyDown={handleCalendarKeyDown}
          ref={calendarRef}
          role="dialog"
        >
          <div className="campaign-calendar-heading">
            <button aria-label="Previous year" disabled={year <= firstYear} onClick={() => { pendingFocusRef.current = "first"; setYear(year - 1); }} type="button"><MarketingIcon name="chevron" className="campaign-calendar-previous" /></button>
            <strong aria-live="polite">{year}</strong>
            <button aria-label="Next year" disabled={year >= lastYear} onClick={() => { pendingFocusRef.current = "first"; setYear(year + 1); }} type="button"><MarketingIcon name="chevron" className="campaign-calendar-next" /></button>
          </div>
          <div aria-label={`Months in ${year}`} className="campaign-calendar-months" role="group">
            {monthNames.map((name, index) => {
              const id = `${year}-${String(index + 1).padStart(2, "0")}`;
              const option = options.find((item) => item.id === id);
              return option ? (
                <a aria-current={option.active ? "date" : undefined} aria-label={option.label} className={option.active ? "is-active" : ""} data-month={index + 1} href={option.href} key={id} onClick={() => setOpen(false)}>{name}</a>
              ) : (
                <button aria-label={`${name} ${year}: no data available`} disabled key={id} type="button">{name}</button>
              );
            })}
          </div>
          <p>Choose a month to view its report.</p>
        </div>
      ) : null}
    </div>
  );
}
