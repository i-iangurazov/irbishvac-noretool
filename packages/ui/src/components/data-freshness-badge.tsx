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
    <div className="data-freshness-badge inline-flex items-center border border-[#d6e8e2] bg-[#eef7f3] font-semibold text-[#0b6b5c] shadow-[0_4px_12px_rgba(15,23,42,0.04)]">
      <span className="data-freshness-badge__dot inline-flex rounded-full bg-[#0b8b4f]" />
      {formatFreshness(value)}
    </div>
  );
}
