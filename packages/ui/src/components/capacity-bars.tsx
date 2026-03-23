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
    <div className="flex h-full flex-col rounded-[1rem] border border-[#ece3da] bg-white px-4 py-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="text-[1.02rem] font-black uppercase tracking-tight text-[#111827] md:text-[1.12rem]">
        Capacity
      </div>
      {rows.length > 0 ? (
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div key={row.businessUnit}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] font-black text-[#00363e]">{row.businessUnit}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {row.scheduledHours}h scheduled of {row.targetHours}h target
                  </div>
                </div>
                <div className="rounded-full bg-[#eef5f7] px-3 py-1 text-xs font-black text-[#00363e] md:text-sm">
                  {row.capacityPct}%
                </div>
              </div>
              <div className="mt-2.5 h-3 overflow-hidden rounded-full bg-[#edf1ef]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,_#20b2aa_0%,_#fa6e18_100%)]"
                  style={{ width: `${Math.min(row.capacityPct, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[14rem] flex-col items-center justify-center rounded-[1rem] border border-dashed border-[#d7dfdf] bg-[#f8fbfb] px-4 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e9f2f4] text-lg font-black text-[#0b4d5a]">
              +
            </div>
            <div className="mt-3 text-sm font-black text-[#17323d]">Capacity data pending</div>
            <div className="mt-1 max-w-[12rem] text-xs leading-relaxed text-slate-500">
              This panel will populate when a capacity snapshot is available for the selected range.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
