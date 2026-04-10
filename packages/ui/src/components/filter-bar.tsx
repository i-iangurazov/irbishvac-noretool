type DatePreset = {
  label: string;
  href: string;
  active?: boolean;
};

type FilterBarProps = {
  from: string;
  to: string;
  presets: DatePreset[];
  tvMode?: boolean;
  tvHref?: string;
};

export function FilterBar(props: FilterBarProps) {
  return (
    <div className="filter-bar inline-flex flex-wrap items-center justify-end border border-[#d9e0dd] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="filter-bar__date inline-flex items-center bg-[#0b4d5a] font-semibold text-white shadow-[0_4px_12px_rgba(8,61,73,0.1)]">
          {props.from}
      </div>
      <div className="filter-bar__date inline-flex items-center bg-[#0b4d5a] font-semibold text-white shadow-[0_4px_12px_rgba(8,61,73,0.1)]">
          {props.to}
      </div>
      <div className="filter-bar__presets inline-flex bg-[#f4f7f7]">
        {props.presets.map((preset) => (
          <a
            className={`filter-bar__preset flex items-center justify-center font-black tracking-[0.08em] transition ${
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
      {props.tvHref ? (
        <a
          className={`filter-bar__tv-toggle flex items-center justify-center border font-black tracking-[0.08em] transition ${
            props.tvMode
              ? "border-[#0b4d5a] bg-[#0b4d5a] text-white shadow-sm"
              : "border-[#d9e0dd] bg-white text-[#0a505e] hover:border-[#0b4d5a] hover:text-[#0b4d5a]"
          }`}
          href={props.tvHref}
        >
          TV
        </a>
      ) : null}
    </div>
  );
}
