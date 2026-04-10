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
    ? "leaderboard-card__avatar leaderboard-card__avatar--featured aspect-square w-full overflow-hidden border border-[#e9edf2] bg-[#edf3f6]"
    : "leaderboard-card__avatar leaderboard-card__avatar--compact overflow-hidden border border-[#e9edf2] bg-[#edf3f6]";

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
          ? "leaderboard-card__avatar-text leaderboard-card__avatar-text--featured"
          : "leaderboard-card__avatar-text leaderboard-card__avatar-text--compact"
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
      className={`leaderboard-card h-full overflow-hidden border transition ${
        featured
          ? "leaderboard-card--featured border-[#fa6e18] bg-white shadow-[0_10px_24px_rgba(250,110,24,0.08)]"
          : "leaderboard-card--compact border-[#ece3da] bg-white"
      }`}
    >
      <div className="leaderboard-card__header flex items-start justify-between">
        <div className="min-w-0">
          <h3
            className="leaderboard-card__title font-black leading-[1.02] text-[#111827]"
          >
            {props.title}
          </h3>
          {props.subtitle ? (
            <div className="leaderboard-card__subtitle font-semibold leading-tight text-slate-500">
              {props.subtitle}
            </div>
          ) : null}
        </div>
        <div className="leaderboard-card__rank inline-flex shrink-0 bg-[#ff7a1a] font-black text-white shadow-sm">
          #{props.rank}
        </div>
      </div>

      {featured ? (
        <div className="leaderboard-card__body leaderboard-card__body--featured">
          <div className="leaderboard-card__featured-layout grid md:items-center">
            <div className="leaderboard-card__avatar-wrap flex justify-center md:justify-start">
              <Avatar featured={true} imageUrl={props.imageUrl} title={props.title} />
            </div>
            <div className="leaderboard-card__revenue text-center md:text-left">
              <div className="leaderboard-card__value-label font-black uppercase tracking-[0.08em] text-slate-500">
                {props.valueLabel}
              </div>
              <div className="leaderboard-card__value font-black tracking-tight text-[#2d8c44]">
                {props.value}
              </div>
            </div>
          </div>
          <div className="leaderboard-card__stats divide-y divide-[#edf0f3]">
            {props.stats.map((stat) => (
              <div
                className="leaderboard-card__stat-row grid grid-cols-[minmax(0,1fr)_auto] items-center"
                key={stat.label}
              >
                <div className="leaderboard-card__stat-label font-medium leading-tight text-[#111827]">
                  {stat.label}
                </div>
                <div className="leaderboard-card__stat-value text-right font-black leading-none text-[#111827]">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="leaderboard-card__body leaderboard-card__body--compact grid h-full grid-rows-[auto_1fr]">
          <div className="leaderboard-card__compact-top grid items-start">
            <Avatar featured={false} imageUrl={props.imageUrl} title={props.title} />
            <div className="leaderboard-card__revenue min-w-0 flex-1">
              <div className="leaderboard-card__value-label font-black leading-tight text-[#111827]">{props.valueLabel}</div>
              <div className="leaderboard-card__value font-black leading-none tracking-tight text-[#2d8c44]">
                {props.value}
              </div>
            </div>
          </div>
          <div className="leaderboard-card__stats divide-y divide-[#edf0f3]">
            {props.stats.map((stat) => (
              <div
                className="leaderboard-card__stat-row grid grid-cols-[minmax(0,1fr)_auto] items-center"
                key={stat.label}
              >
                <div className="leaderboard-card__stat-label font-medium leading-tight text-[#111827]">
                  {stat.label}
                </div>
                <div className="leaderboard-card__stat-value text-right font-black leading-none text-[#111827]">
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
