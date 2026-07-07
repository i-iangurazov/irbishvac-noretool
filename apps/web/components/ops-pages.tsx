import type { ReactNode } from "react";
import { getBrandLogoUrl } from "../lib/assets";

export type HealthPayload = {
  ok: boolean;
  degraded: boolean;
  timestamp: string;
  checks?: {
    database?: { ok: boolean; detail?: string };
    redis?: { ok: boolean; detail?: string };
    snapshots?: {
      ok: boolean;
      detail?: string;
      latestSnapshotTime: string | null;
      staleThresholdMinutes: number;
    };
  };
};

type OpsShellProps = {
  activePath: "/ops" | "/ops/user-manual" | "/ops/condition-report";
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

type HealthStatusProps = {
  health: HealthPayload | null;
};

const OPS_NAV = [
  { href: "/ops", label: "Operations Home" },
  { href: "/ops/user-manual", label: "User Manual" },
  { href: "/ops/condition-report", label: "Condition Report" },
  { href: "/company-wide", label: "Live Dashboard" }
] as const;

const cardBase =
  "rounded-lg border border-[#e6ddd2] bg-white shadow-[0_10px_26px_rgba(15,23,42,0.06)]";

export function OpsShell(props: OpsShellProps) {
  const logoUrl = getBrandLogoUrl();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#f7f3ec_0%,_#eef5f3_54%,_#f8f6f2_100%)] text-slate-950">
      <header className="border-b border-[#e2d8cc] bg-white/88 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 md:px-8 lg:flex-row lg:items-center lg:justify-between">
          <a className="flex min-w-0 items-center gap-3" href="/company-wide">
            {logoUrl ? (
              <img
                alt="IRBIS HVAC"
                className="h-12 w-12 rounded-lg border border-[#e7dfd3] bg-white object-contain p-1.5 shadow-sm"
                src={logoUrl}
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#083d49] text-base font-black tracking-[0.1em] text-white shadow-sm">
                IR
              </span>
            )}
            <span className="min-w-0">
              <span className="block text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                IRBIS HVAC
              </span>
              <span className="block truncate text-xl font-black tracking-tight text-[#17313a]">
                Dashboard Operations
              </span>
            </span>
          </a>

          <nav className="flex flex-wrap gap-2" aria-label="Operations navigation">
            {OPS_NAV.map((item) => {
              const active = item.href === props.activePath;

              return (
                <a
                  className={`rounded-lg border px-3 py-2 text-sm font-black transition ${
                    active
                      ? "border-[#083d49] bg-[#083d49] text-white"
                      : "border-[#d8cfc4] bg-[#f9f7f2] text-[#083d49] hover:border-[#fa6e18] hover:text-[#c94f07]"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-[#e3dad0] bg-[linear-gradient(135deg,_#083d49_0%,_#0b6f77_58%,_#f26a21_100%)] text-white">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 md:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-4xl">
              <p className="text-sm font-black uppercase tracking-[0.24em] text-[#b9efe8]">
                {props.eyebrow}
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">
                {props.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-[#e7fffb] md:text-lg">
                {props.description}
              </p>
            </div>
            {props.actions ? (
              <div className="flex flex-wrap gap-3 lg:justify-end">{props.actions}</div>
            ) : null}
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">{props.children}</div>
      </main>
    </div>
  );
}

export function PrimaryLink(props: { href: string; children: ReactNode }) {
  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#083d49] bg-[#083d49] px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-[#0b5964]"
      href={props.href}
    >
      {props.children}
    </a>
  );
}

export function SecondaryLink(props: { href: string; children: ReactNode }) {
  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#f7c39d] bg-white px-4 py-2 text-sm font-black text-[#b64600] shadow-sm transition hover:border-[#fa6e18] hover:text-[#8f3500]"
      href={props.href}
    >
      {props.children}
    </a>
  );
}

export function SectionBand(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="py-7">
      <div className="mb-5 max-w-4xl">
        {props.eyebrow ? (
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#0b7a7d]">
            {props.eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-2xl font-black tracking-tight text-[#14252e] md:text-3xl">
          {props.title}
        </h2>
        {props.description ? (
          <p className="mt-3 text-base font-semibold leading-7 text-slate-600">
            {props.description}
          </p>
        ) : null}
      </div>
      {props.children}
    </section>
  );
}

export function InfoGrid(props: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{props.children}</div>;
}

export function InfoCard(props: {
  label: string;
  value?: string;
  tone?: "teal" | "orange" | "green" | "slate";
  children?: ReactNode;
}) {
  const tone =
    props.tone === "orange"
      ? "border-l-[#fa6e18]"
      : props.tone === "green"
        ? "border-l-[#16a34a]"
        : props.tone === "slate"
          ? "border-l-slate-500"
          : "border-l-[#08979f]";

  return (
    <article className={`${cardBase} border-l-4 ${tone} p-5`}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {props.label}
      </p>
      {props.value ? (
        <p className="mt-2 text-2xl font-black tracking-tight text-[#13232b]">
          {props.value}
        </p>
      ) : null}
      {props.children ? (
        <div className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          {props.children}
        </div>
      ) : null}
    </article>
  );
}

export function TextPanel(props: { children: ReactNode }) {
  return <div className={`${cardBase} p-5 md:p-6`}>{props.children}</div>;
}

export function BulletList(props: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm font-semibold leading-6 text-slate-700">
      {props.items.map((item) => (
        <li className="flex gap-2" key={item}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0b8c91]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function NumberedList(props: { items: string[] }) {
  return (
    <ol className="space-y-3 text-sm font-semibold leading-6 text-slate-700">
      {props.items.map((item, index) => (
        <li className="grid grid-cols-[2rem_1fr] gap-2" key={item}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#083d49] text-xs font-black text-white">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function CodeBlock(props: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-[#d8d2c8] bg-[#14252e] p-4 text-sm font-semibold leading-6 text-[#e7fffb] shadow-inner">
      <code>{props.children}</code>
    </pre>
  );
}

export function HealthStatus({ health }: HealthStatusProps) {
  const snapshotTime = health?.checks?.snapshots?.latestSnapshotTime ?? "Not available";
  const statusLabel = !health
    ? "Unavailable"
    : health.ok && !health.degraded
      ? "Healthy"
      : health.ok && health.degraded
        ? "Degraded"
        : "Down";
  const statusClass =
    statusLabel === "Healthy"
      ? "bg-[#e8f8ed] text-[#116b2d] border-[#b8e7c5]"
      : statusLabel === "Degraded"
        ? "bg-[#fff4e8] text-[#9a3f00] border-[#ffd2a8]"
        : "bg-[#fff0f0] text-[#9a1f1f] border-[#ffc4c4]";

  return (
    <div className={`${cardBase} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece3da] bg-[#f9f7f2] p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            Railway API
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-[#14252e]">
            Live Health
          </h2>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm font-black ${statusClass}`}>
          {statusLabel}
        </span>
      </div>
      <div className="grid gap-4 p-5 md:grid-cols-4">
        <Metric label="Database" value={health?.checks?.database?.ok ? "OK" : "Check"} />
        <Metric label="Redis" value={health?.checks?.redis?.ok ? "OK" : "Check"} />
        <Metric label="Snapshots" value={health?.checks?.snapshots?.ok ? "OK" : "Check"} />
        <Metric label="Latest Snapshot" value={snapshotTime} />
      </div>
    </div>
  );
}

function Metric(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#ece3da] bg-white p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {props.label}
      </p>
      <p className="mt-2 break-words text-sm font-black text-[#14252e]">{props.value}</p>
    </div>
  );
}

