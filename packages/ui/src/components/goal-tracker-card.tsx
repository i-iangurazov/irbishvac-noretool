type GoalTrackerCardProps = {
  title: string;
  current: string;
  goal: string;
  percent: number;
};

export function GoalTrackerCard(props: GoalTrackerCardProps) {
  return (
    <div className="goal-tracker-card border border-[#ece3da] bg-white">
      <div className="goal-tracker-card__label font-semibold uppercase tracking-[0.25em] text-slate-500">
        {props.title}
      </div>
      <div className="goal-tracker-card__summary flex items-end justify-between">
        <div>
          <div className="goal-tracker-card__current font-black text-[#00363e]">{props.current}</div>
          <div className="goal-tracker-card__goal text-slate-500">Goal {props.goal}</div>
        </div>
        <div className="goal-tracker-card__percent-wrap text-right">
          <div className="goal-tracker-card__percent font-black text-[#fa6e18]">
            {(props.percent * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="goal-tracker-card__track overflow-hidden bg-[#edf1ef]">
        <div
          className="goal-tracker-card__fill h-full bg-[linear-gradient(90deg,_#00363e_0%,_#fa6e18_100%)]"
          style={{ width: `${Math.min(props.percent * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}
