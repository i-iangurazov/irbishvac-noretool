type CapacityRow = {
  businessUnit: string;
  capacityPct: number;
  scheduledHours: number;
  targetHours: number;
};

type CapacityBarsProps = {
  rows: CapacityRow[];
};

export function CapacityBars({ rows }: CapacityBarsProps) {
  return (
    <div className="capacity-bars flex h-full flex-col rounded-[1rem] border border-[#ece3da] bg-white px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] 3xl:px-5 3xl:py-5">
      <div className="capacity-bars__title text-[1.02rem] font-black uppercase tracking-tight text-[#111827] md:text-[1.12rem] 3xl:text-[1.2rem] 4xl:text-[1.28rem]">
        Capacity
      </div>
      {rows.length > 0 ? (
        <div className="capacity-bars__rows mt-3 space-y-3 3xl:space-y-4">
          {rows.map((row) => (
            <div className="capacity-bars__row" key={row.businessUnit}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="capacity-bars__business-unit text-[13px] font-black text-[#00363e] 3xl:text-[14px]">{row.businessUnit}</div>
                  <div className="capacity-bars__detail mt-1 text-[11px] text-slate-500 3xl:text-[12px]">
                    {row.scheduledHours}h scheduled of {row.targetHours}h target
                  </div>
                </div>
                <div className="capacity-bars__pct rounded-full bg-[#eef5f7] px-3 py-1 text-xs font-black text-[#00363e] md:text-sm 3xl:px-3.5 3xl:py-1.5 3xl:text-[0.95rem]">
                  {row.capacityPct}%
                </div>
              </div>
              <div className="capacity-bars__track mt-2.5 h-3 overflow-hidden rounded-full bg-[#edf1ef] 3xl:h-3.5">
                <div
                  className="capacity-bars__fill h-full rounded-full bg-[linear-gradient(90deg,_#20b2aa_0%,_#fa6e18_100%)]"
                  style={{ width: `${Math.min(row.capacityPct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="capacity-bars__empty-wrap mt-4 flex flex-1 items-center justify-center">
          <div className="capacity-bars__empty flex w-full max-w-[14rem] flex-col items-center justify-center rounded-[1rem] border border-dashed border-[#d7dfdf] bg-[#f8fbfb] px-4 py-6 text-center 3xl:max-w-[16rem] 3xl:px-5 3xl:py-7">
            <div className="capacity-bars__empty-icon flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f2f4] text-lg font-black text-[#0b4d5a] 3xl:h-11 3xl:w-11">
              +
            </div>
            <div className="capacity-bars__empty-title mt-3 text-sm font-black text-[#17323d] 3xl:text-[0.95rem]">Capacity data pending</div>
            <div className="capacity-bars__empty-copy mt-1 max-w-[12rem] text-xs leading-relaxed text-slate-500 3xl:max-w-[13rem] 3xl:text-[13px]">
              This panel will populate when a capacity snapshot is available for the selected range.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
