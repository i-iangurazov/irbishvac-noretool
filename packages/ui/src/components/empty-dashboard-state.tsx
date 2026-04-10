type EmptyDashboardStateProps = {
  title: string;
  description: string;
};

export function EmptyDashboardState({
  title,
  description,
}: EmptyDashboardStateProps) {
  return (
    <section className="empty-dashboard-state flex h-full items-center justify-center border border-dashed border-[#d7dfe6] bg-white/80 text-center shadow-sm">
      <div className="empty-dashboard-state__content">
        <h2 className="empty-dashboard-state__title font-black tracking-tight text-[#00363e]">
          {title}
        </h2>
        <p className="empty-dashboard-state__description text-slate-600">
          {description}
        </p>
      </div>
    </section>
  );
}
