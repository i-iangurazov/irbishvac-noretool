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
    <div className="filter-bar inline-flex flex-wrap items-center justify-end gap-1.5 rounded-[1rem] border border-[#d9e0dd] bg-white p-1 shadow-[0_6px_18px_rgba(15,23,42,0.05)] 3xl:gap-2 3xl:rounded-[1.1rem] 3xl:p-1.5 4xl:gap-2.5 5xl:gap-3 5xl:rounded-[1.25rem] 5xl:p-2">
      <div className="filter-bar__date inline-flex h-10 min-w-[8.9rem] items-center rounded-[0.82rem] bg-[#0b4d5a] px-4 text-[0.92rem] font-semibold text-white shadow-[0_4px_12px_rgba(8,61,73,0.1)] 3xl:h-12 3xl:min-w-[11rem] 3xl:px-5 3xl:text-[1.02rem] 4xl:h-14 4xl:min-w-[12.5rem] 4xl:text-[1.1rem] 5xl:h-16 5xl:min-w-[14rem] 5xl:px-6 5xl:text-[1.25rem]">
          {props.from}
      </div>
      <div className="filter-bar__date inline-flex h-10 min-w-[8.9rem] items-center rounded-[0.82rem] bg-[#0b4d5a] px-4 text-[0.92rem] font-semibold text-white shadow-[0_4px_12px_rgba(8,61,73,0.1)] 3xl:h-12 3xl:min-w-[11rem] 3xl:px-5 3xl:text-[1.02rem] 4xl:h-14 4xl:min-w-[12.5rem] 4xl:text-[1.1rem] 5xl:h-16 5xl:min-w-[14rem] 5xl:px-6 5xl:text-[1.25rem]">
          {props.to}
      </div>
      <div className="filter-bar__presets inline-flex rounded-[0.9rem] bg-[#f4f7f7] p-0.5 3xl:rounded-[1rem] 3xl:p-1 5xl:rounded-[1.1rem] 5xl:p-1.5">
        {props.presets.map((preset) => (
          <a
            className={`filter-bar__preset flex h-9 min-w-[4.25rem] items-center justify-center rounded-[0.72rem] px-3 text-[0.78rem] font-black tracking-[0.08em] transition 3xl:h-11 3xl:min-w-[5rem] 3xl:px-4 3xl:text-[0.88rem] 4xl:h-12 4xl:min-w-[5.8rem] 4xl:text-[0.96rem] 5xl:h-14 5xl:min-w-[6.6rem] 5xl:px-5 5xl:text-[1.08rem] ${
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
          className={`filter-bar__tv-toggle flex h-9 min-w-[4.25rem] items-center justify-center rounded-[0.8rem] border px-3 text-[0.78rem] font-black tracking-[0.08em] transition 3xl:h-11 3xl:min-w-[5rem] 3xl:px-4 3xl:text-[0.88rem] 4xl:h-12 4xl:min-w-[5.8rem] 4xl:text-[0.96rem] 5xl:h-14 5xl:min-w-[6.6rem] 5xl:px-5 5xl:text-[1.08rem] ${
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
