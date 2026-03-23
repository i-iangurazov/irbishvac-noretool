type GoalTrackerCardProps = {
  title: string;
  current: string;
  goal: string;
  percent: number;
};

export function GoalTrackerCard(props: GoalTrackerCardProps) {
  return (
    <div className="rounded-[1.5rem] border border-[#ece3da] bg-white px-5 py-5 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
        {props.title}
      </div>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-black text-[#00363e]">{props.current}</div>
          <div className="mt-1 text-sm text-slate-500">Goal {props.goal}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-[#fa6e18]">
            {(props.percent * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf1ef]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,_#00363e_0%,_#fa6e18_100%)]"
          style={{ width: `${Math.min(props.percent * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
