import type { ReactNode } from "react";

type KpiCardProps = {
  label: string;
  value: string;
  accent?: string | undefined;
  hint?: string | undefined;
  children?: ReactNode | undefined;
};

export function KpiCard(props: KpiCardProps) {
  return (
    <article className="rounded-[1.6rem] border border-[#e8ddd2] bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)] px-5 py-5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
      <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
        {props.label}
      </div>
      <div
        className="mt-3 text-3xl font-black tracking-tight md:text-4xl"
        style={{ color: props.accent ?? "#00363e" }}
      >
        {props.value}
      </div>
      {props.hint ? <p className="mt-2 text-sm leading-6 text-slate-600">{props.hint}</p> : null}
      {props.children ? <div className="mt-3">{props.children}</div> : null}
    </article>
  );
}
