type EmptyDashboardStateProps = {
  title: string;
  description: string;
};

export function EmptyDashboardState({ title, description }: EmptyDashboardStateProps) {
  return (
    <section className="flex h-full min-h-[12rem] items-center justify-center rounded-[1.75rem] border border-dashed border-[#d7dfe6] bg-white/80 px-6 py-8 text-center shadow-sm">
      <div className="max-w-xl">
        <h2 className="text-xl font-black tracking-tight text-[#00363e]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </section>
  );
}
