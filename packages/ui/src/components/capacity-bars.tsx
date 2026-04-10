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
    <div className="capacity-bars flex h-full flex-col border border-[#ece3da] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="capacity-bars__title font-black uppercase tracking-tight text-[#111827]">
        Capacity
      </div>
      {rows.length > 0 ? (
        <div className="capacity-bars__rows flex-1 min-h-0">
          {rows.map((row) => (
            <div className="capacity-bars__row" key={row.businessUnit}>
              <div className="capacity-bars__row-top flex items-center justify-between">
                <div className="min-w-0">
                  <div className="capacity-bars__business-unit font-black text-[#00363e]">{row.businessUnit}</div>
                  <div className="capacity-bars__detail text-slate-500">
                    {row.scheduledHours}h scheduled of {row.targetHours}h target
                  </div>
                </div>
                <div className="capacity-bars__pct bg-[#eef5f7] font-black text-[#00363e]">
                  {row.capacityPct}%
                </div>
              </div>
              <div className="capacity-bars__track overflow-hidden rounded-full bg-[#edf1ef]">
                <div
                  className="capacity-bars__fill h-full rounded-full bg-[linear-gradient(90deg,_#20b2aa_0%,_#fa6e18_100%)]"
                  style={{ width: `${Math.min(row.capacityPct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="capacity-bars__empty-wrap flex flex-1 items-center justify-center">
          <div className="capacity-bars__empty flex w-full flex-col items-center justify-center border border-dashed border-[#d7dfdf] bg-[#f8fbfb] text-center">
            <div className="capacity-bars__empty-icon flex items-center justify-center rounded-full bg-[#e9f2f4] font-black text-[#0b4d5a]">
              +
            </div>
            <div className="capacity-bars__empty-title font-black text-[#17323d]">Capacity data pending</div>
            <div className="capacity-bars__empty-copy leading-relaxed text-slate-500">
              This panel will populate when a capacity snapshot is available for the selected range.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
