type DataFreshnessBadgeProps = {
  value?: string | null | undefined;
};

function formatFreshness(value: string | null | undefined) {
  if (!value) {
    return "Snapshot unknown";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return `Snapshot ${value}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles"
  }).format(parsed);
}

export function DataFreshnessBadge({ value }: DataFreshnessBadgeProps) {
  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-full border border-[#d6e8e2] bg-[#eef7f3] px-3.5 text-[12px] font-semibold text-[#0b6b5c] shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
      <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#0b8b4f]" />
      {formatFreshness(value)}
    </div>
  );
}
