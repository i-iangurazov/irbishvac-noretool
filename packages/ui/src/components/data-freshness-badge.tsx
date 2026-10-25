type DataFreshnessBadgeProps = {
  value?: string | null | undefined;
};

function formatFreshness(value: string | null | undefined) {
  if (!value) {
    return "Awaiting data";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Awaiting data";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Los_Angeles",
  }).format(parsed);
}

export function DataFreshnessBadge({ value }: DataFreshnessBadgeProps) {
  const available = Boolean(value && Number.isFinite(Date.parse(value)));
  return (
    <div
      className={`data-freshness-badge inline-flex items-center border font-semibold shadow-[0_4px_12px_rgba(15,23,42,0.04)] ${available ? "border-[#d6e8e2] bg-[#eef7f3] text-[#0b6b5c]" : "border-[#e2e8f0] bg-[#f8fafc] text-[#64748b]"}`}
    >
      <span
        className={`data-freshness-badge__dot inline-flex rounded-full ${available ? "bg-[#0b8b4f]" : "bg-[#94a3b8]"}`}
      />
      {formatFreshness(value)}
    </div>
  );
}
