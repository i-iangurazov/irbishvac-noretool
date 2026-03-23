type DatePreset = {
  label: string;
  href: string;
  active?: boolean;
};

type FilterBarProps = {
  from: string;
  to: string;
  presets: DatePreset[];
};

export function FilterBar(props: FilterBarProps) {
  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-1.5 rounded-[1rem] border border-[#d9e0dd] bg-white p-1 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="inline-flex h-10 min-w-[8.9rem] items-center rounded-[0.82rem] bg-[#0b4d5a] px-4 text-[0.92rem] font-semibold text-white shadow-[0_4px_12px_rgba(8,61,73,0.1)]">
          {props.from}
      </div>
      <div className="inline-flex h-10 min-w-[8.9rem] items-center rounded-[0.82rem] bg-[#0b4d5a] px-4 text-[0.92rem] font-semibold text-white shadow-[0_4px_12px_rgba(8,61,73,0.1)]">
          {props.to}
      </div>
      <div className="inline-flex rounded-[0.9rem] bg-[#f4f7f7] p-0.5">
        {props.presets.map((preset) => (
          <a
            className={`flex h-9 min-w-[4.25rem] items-center justify-center rounded-[0.72rem] px-3 text-[0.78rem] font-black tracking-[0.08em] transition ${
              preset.active
                ? "bg-[#0b4d5a] text-white shadow-sm"
                : "text-[#0a505e] hover:bg-white"
            }`}
            href={preset.href}
            key={preset.href}
          >
            {preset.label}
          </a>
        ))}
      </div>
    </div>
  );
}
