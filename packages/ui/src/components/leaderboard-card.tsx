"use client";

import { useMemo, useState, type ReactNode } from "react";

type Stat = {
  label: string;
  value: string;
};

type LeaderboardCardProps = {
  rank: number;
  title: string;
  subtitle?: string | undefined;
  valueLabel: string;
  value: string;
  stats: Stat[];
  imageUrl?: string | null | undefined;
  featured?: boolean;
  children?: ReactNode;
};

function buildInitials(input: string) {
  const tokens = input
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9.]+$/g, ""))
    .filter(Boolean);

  if (tokens.length === 0) {
    return "?";
  }

  if (tokens.length === 1) {
    return (tokens[0] ?? "?").slice(0, 2).toUpperCase();
  }

  const first = tokens[0] ?? "";
  const last =
    tokens
      .slice()
      .reverse()
      .find((part) => part.replace(/\./g, "").length > 1) ?? tokens[tokens.length - 1] ?? "";

  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

function Avatar(props: { title: string; imageUrl?: string | null | undefined; featured: boolean }) {
  const [hasError, setHasError] = useState(false);
  const initials = useMemo(() => buildInitials(props.title), [props.title]);

  const wrapperClassName = props.featured
    ? "aspect-square w-full max-w-[10rem] overflow-hidden rounded-[1rem] border border-[#e9edf2] bg-[#edf3f6]"
    : "h-14 w-14 overflow-hidden rounded-[0.95rem] border border-[#e9edf2] bg-[#edf3f6]";

  const imageClassName = props.featured
    ? "h-full w-full object-cover object-top"
    : "h-full w-full object-cover object-top";

  if (props.imageUrl && !hasError) {
    return (
      <div className={wrapperClassName}>
        <img
          alt={props.title}
          className={imageClassName}
          loading="lazy"
          src={props.imageUrl}
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${wrapperClassName} flex items-center justify-center bg-[#0d4f5b] font-black tracking-tight text-white shadow-sm ${
        props.featured ? "text-4xl" : "text-xl"
      }`}
    >
      {initials}
    </div>
  );
}

export function LeaderboardCard(props: LeaderboardCardProps) {
  const featured = props.featured ?? props.rank === 1;

  return (
    <article
      className={`h-full overflow-hidden rounded-[1rem] border px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition ${
        featured
          ? "border-[#fa6e18] bg-white shadow-[0_10px_24px_rgba(250,110,24,0.08)]"
          : "border-[#ece3da] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={`font-black leading-[1.02] text-[#111827] ${
              featured ? "text-[1.25rem] md:text-[1.4rem]" : "text-[0.92rem] md:text-[1rem]"
            }`}
          >
            {props.title}
          </h3>
          {props.subtitle ? (
            <div className="mt-1 text-[0.78rem] font-semibold leading-tight text-slate-500 md:text-[0.86rem]">
              {props.subtitle}
            </div>
          ) : null}
        </div>
        <div className="inline-flex shrink-0 rounded-full bg-[#ff7a1a] px-2.5 py-1 text-[11px] font-black text-white shadow-sm">
          #{props.rank}
        </div>
      </div>

      {featured ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center">
            <div className="flex justify-center md:justify-start">
              <Avatar featured={true} imageUrl={props.imageUrl} title={props.title} />
            </div>
            <div className="text-center md:text-left">
              <div className="text-[0.86rem] font-black uppercase tracking-[0.08em] text-slate-500">
                {props.valueLabel}
              </div>
              <div className="mt-1 text-[1rem] font-black tracking-tight text-[#2d8c44] md:text-[1.5rem]">
                {props.value}
              </div>
            </div>
          </div>
          <div className="divide-y divide-[#edf0f3]">
            {props.stats.map((stat) => (
              <div
                className="grid min-h-[1.8rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5"
                key={stat.label}
              >
                <div className="text-[12px] font-medium leading-tight text-[#111827]">
                  {stat.label}
                </div>
                <div className="text-right text-[0.9rem] font-black leading-none text-[#111827] md:text-[0.96rem]">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-3 grid h-full grid-rows-[auto_1fr]">
          <div className="grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3">
            <Avatar featured={false} imageUrl={props.imageUrl} title={props.title} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="text-[12px] font-black leading-tight text-[#111827]">{props.valueLabel}</div>
              <div className="mt-1 text-[1.05rem] font-black leading-none tracking-tight text-[#2d8c44] md:text-[1.15rem]">
                {props.value}
              </div>
            </div>
          </div>
          <div className="mt-3 divide-y divide-[#edf0f3]">
            {props.stats.map((stat) => (
              <div
                className="grid min-h-[1.9rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5"
                key={stat.label}
              >
                <div className="text-[11px] font-medium leading-tight text-[#111827]">
                  {stat.label}
                </div>
                <div className="text-right text-[0.9rem] font-black leading-none text-[#111827]">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {props.children}
    </article>
  );
}
