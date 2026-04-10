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
    <article className="kpi-card border border-[#e8ddd2] bg-[linear-gradient(180deg,_#ffffff_0%,_#fbfaf8_100%)]">
      <div className="kpi-card__label font-bold uppercase tracking-[0.28em] text-slate-500">
        {props.label}
      </div>
      <div
        className="kpi-card__value font-black tracking-tight"
        style={{ color: props.accent ?? "#00363e" }}
      >
        {props.value}
      </div>
      {props.hint ? <p className="kpi-card__hint text-slate-600">{props.hint}</p> : null}
      {props.children ? <div className="kpi-card__content">{props.children}</div> : null}
    </article>
  );
}
