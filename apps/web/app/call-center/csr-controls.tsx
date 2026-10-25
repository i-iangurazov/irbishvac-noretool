"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, RefreshCw } from "lucide-react";
import {
  isPreparedStaffPortrait,
  staffPortraitUrl,
} from "../../lib/staff-portrait-url";

export function CsrAvatar({ name, src }: { name: string; src: string | null }) {
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const current = [staffPortraitUrl(name), src].find((url): url is string =>
    Boolean(url && !failed.includes(url)),
  );
  useEffect(() => {
    // Cached images can finish before React attaches its load/error listeners.
    if (image.current?.complete) {
      if (image.current.naturalWidth > 0) setLoaded(current ?? null);
      else if (current)
        setFailed((values) => [...new Set([...values, current])]);
    }
  }, [current]);
  const initials = name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .filter((_, index, parts) => index === 0 || index === parts.length - 1)
    .join("");
  return (
    <span
      className={`csr-avatar${current && isPreparedStaffPortrait(current) ? " csr-avatar--prepared" : ""}`}
      aria-label={name}
    >
      <span aria-hidden="true">{initials}</span>
      {current ? (
        <img
          key={current}
          ref={image}
          src={current}
          alt={name}
          style={{ opacity: loaded === current ? 1 : 0 }}
          onLoad={() => setLoaded(current)}
          onError={() => setFailed((values) => [...values, current])}
        />
      ) : null}
    </span>
  );
}

export function CsrPeriodPicker({
  from,
  to,
  label,
  query,
  allowSingleDate = false,
}: {
  from: string;
  to: string;
  label: string;
  query: string;
  allowSingleDate?: boolean;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [single, setSingle] = useState(allowSingleDate && from === to);
  const [start, setStart] = useState(from);
  const [end, setEnd] = useState(to);
  useEffect(() => {
    setStart(from);
    setEnd(to);
    setSingle(allowSingleDate && from === to);
  }, [from, to, allowSingleDate]);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <details className="csr-period" ref={ref}>
      <summary className="csr-button">
        <CalendarDays size={17} />
        <span>{label}</span>
        <ChevronDown size={15} />
      </summary>
      <form className="csr-period__popover" method="get">
        {Array.from(new URLSearchParams(query))
          .filter(([key]) => !["from", "to", "range", "page"].includes(key))
          .map(([key, value]) => (
            <input type="hidden" key={key} name={key} value={value} />
          ))}
        <input type="hidden" name="range" value="fixed" />
        {allowSingleDate && (
          <div
            className="membership-date-mode"
            role="group"
            aria-label="Date selection mode"
          >
            <button
              type="button"
              aria-pressed={!single}
              onClick={() => setSingle(false)}
            >
              Date range
            </button>
            <button
              type="button"
              aria-pressed={single}
              onClick={() => setSingle(true)}
            >
              Single date
            </button>
          </div>
        )}
        <label>
          {single ? "Date" : "From"}
          <input
            aria-label="Start date"
            name="from"
            type="date"
            required
            max={single ? undefined : end}
            value={start}
            onInput={(event) => setStart(event.currentTarget.value)}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        {single ? (
          <input type="hidden" name="to" value={start} />
        ) : (
          <label>
            To
            <input
              aria-label="End date"
              name="to"
              type="date"
              required
              min={start}
              value={end}
              onInput={(event) => setEnd(event.currentTarget.value)}
              onChange={(event) => setEnd(event.target.value)}
            />
          </label>
        )}
        <button className="csr-button csr-button--primary" type="submit">
          Apply dates
        </button>
      </form>
    </details>
  );
}

export function CsrRefresh({ pending }: { pending: boolean }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible") router.refresh();
      },
      pending ? 15_000 : 60_000,
    );
    return () => window.clearInterval(timer);
  }, [pending, router]);
  return (
    <button
      type="button"
      className="csr-button csr-refresh"
      title="Reload dashboard"
      aria-label="Refresh dashboard"
      disabled={refreshing}
      onClick={() => {
        setRefreshing(true);
        router.refresh();
        window.setTimeout(() => setRefreshing(false), 1000);
      }}
    >
      <RefreshCw size={17} className={refreshing ? "csr-spin" : ""} />
    </button>
  );
}
