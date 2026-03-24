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
    ? "leaderboard-card__avatar leaderboard-card__avatar--featured aspect-square w-full max-w-[10rem] overflow-hidden rounded-[1rem] border border-[#e9edf2] bg-[#edf3f6] 3xl:max-w-[11rem] 4xl:max-w-[13rem] 5xl:max-w-[15rem]"
    : "leaderboard-card__avatar leaderboard-card__avatar--compact h-14 w-14 overflow-hidden rounded-[0.95rem] border border-[#e9edf2] bg-[#edf3f6] 3xl:h-16 3xl:w-16 5xl:h-20 5xl:w-20";

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
        props.featured
          ? "leaderboard-card__avatar-text leaderboard-card__avatar-text--featured text-4xl"
          : "leaderboard-card__avatar-text leaderboard-card__avatar-text--compact text-xl"
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
      className={`leaderboard-card h-full overflow-hidden rounded-[1rem] border px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)] transition 3xl:px-5 3xl:py-4 5xl:px-6 5xl:py-5 ${
        featured
          ? "leaderboard-card--featured border-[#fa6e18] bg-white shadow-[0_10px_24px_rgba(250,110,24,0.08)]"
          : "leaderboard-card--compact border-[#ece3da] bg-white"
      }`}
    >
      <div className="leaderboard-card__header flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={`leaderboard-card__title font-black leading-[1.02] text-[#111827] ${
              featured
                ? "text-[1.25rem] md:text-[1.4rem] 3xl:text-[1.58rem] 4xl:text-[1.8rem] 5xl:text-[2rem]"
                : "text-[0.92rem] md:text-[1rem] 3xl:text-[1.08rem] 4xl:text-[1.14rem] 5xl:text-[1.28rem]"
            }`}
          >
            {props.title}
          </h3>
          {props.subtitle ? (
            <div className="leaderboard-card__subtitle mt-1 text-[0.78rem] font-semibold leading-tight text-slate-500 md:text-[0.86rem] 3xl:text-[0.92rem] 5xl:text-[1.02rem]">
              {props.subtitle}
            </div>
          ) : null}
        </div>
        <div className="leaderboard-card__rank inline-flex shrink-0 rounded-full bg-[#ff7a1a] px-2.5 py-1 text-[11px] font-black text-white shadow-sm 3xl:px-3 3xl:py-1.5 3xl:text-[12px] 5xl:px-3.5 5xl:py-2 5xl:text-[13px]">
          #{props.rank}
        </div>
      </div>

      {featured ? (
        <div className="leaderboard-card__body mt-3 space-y-3">
          <div className="leaderboard-card__featured-layout grid gap-4 md:grid-cols-[10rem_minmax(0,1fr)] md:items-center 3xl:grid-cols-[11rem_minmax(0,1fr)] 4xl:grid-cols-[13rem_minmax(0,1fr)] 5xl:grid-cols-[15rem_minmax(0,1fr)] 3xl:gap-5 5xl:gap-6">
            <div className="leaderboard-card__avatar-wrap flex justify-center md:justify-start">
              <Avatar featured={true} imageUrl={props.imageUrl} title={props.title} />
            </div>
            <div className="leaderboard-card__revenue text-center md:text-left">
              <div className="leaderboard-card__value-label text-[0.86rem] font-black uppercase tracking-[0.08em] text-slate-500 3xl:text-[0.92rem] 5xl:text-[1rem]">
                {props.valueLabel}
              </div>
              <div className="leaderboard-card__value mt-1 text-[1rem] font-black tracking-tight text-[#2d8c44] md:text-[1.5rem] 3xl:text-[1.8rem] 4xl:text-[2.05rem] 5xl:text-[2.35rem]">
                {props.value}
              </div>
            </div>
          </div>
          <div className="leaderboard-card__stats divide-y divide-[#edf0f3]">
            {props.stats.map((stat) => (
              <div
                className="leaderboard-card__stat-row grid min-h-[1.8rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5 3xl:min-h-[2rem] 3xl:py-2 5xl:min-h-[2.3rem] 5xl:py-2.5"
                key={stat.label}
              >
                <div className="leaderboard-card__stat-label text-[12px] font-medium leading-tight text-[#111827] 3xl:text-[13px] 5xl:text-[14px]">
                  {stat.label}
                </div>
                <div className="leaderboard-card__stat-value text-right text-[0.9rem] font-black leading-none text-[#111827] md:text-[0.96rem] 3xl:text-[1.02rem] 5xl:text-[1.12rem]">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="leaderboard-card__body mt-3 grid h-full grid-rows-[auto_1fr]">
          <div className="leaderboard-card__compact-top grid grid-cols-[56px_minmax(0,1fr)] items-start gap-3 3xl:grid-cols-[64px_minmax(0,1fr)] 3xl:gap-4 5xl:grid-cols-[72px_minmax(0,1fr)] 5xl:gap-5">
            <Avatar featured={false} imageUrl={props.imageUrl} title={props.title} />
            <div className="leaderboard-card__revenue min-w-0 flex-1 pt-0.5">
              <div className="leaderboard-card__value-label text-[12px] font-black leading-tight text-[#111827] 3xl:text-[13px] 5xl:text-[14px]">{props.valueLabel}</div>
              <div className="leaderboard-card__value mt-1 text-[1.05rem] font-black leading-none tracking-tight text-[#2d8c44] md:text-[1.15rem] 3xl:text-[1.25rem] 4xl:text-[1.36rem] 5xl:text-[1.52rem]">
                {props.value}
              </div>
            </div>
          </div>
          <div className="leaderboard-card__stats mt-3 divide-y divide-[#edf0f3]">
            {props.stats.map((stat) => (
              <div
                className="leaderboard-card__stat-row grid min-h-[1.9rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-1.5 3xl:min-h-[2.05rem] 3xl:py-1.5 5xl:min-h-[2.3rem] 5xl:py-2"
                key={stat.label}
              >
                <div className="leaderboard-card__stat-label text-[11px] font-medium leading-tight text-[#111827] 3xl:text-[12px] 5xl:text-[13px]">
                  {stat.label}
                </div>
                <div className="leaderboard-card__stat-value text-right text-[0.9rem] font-black leading-none text-[#111827] 3xl:text-[0.96rem] 5xl:text-[1.06rem]">
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
