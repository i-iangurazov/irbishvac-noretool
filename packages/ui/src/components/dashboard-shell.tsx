import type { ReactNode } from "react";

type NavItem = {
  href: string;
  label: string;
  section?: string;
  shortLabel?: string;
};

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  activePath: string;
  brandLogoUrl?: string | null;
  headerContent?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
};

export function DashboardShell(props: DashboardShellProps) {
  const activeItem = props.navItems.find((item) => item.href === props.activePath);
  const navSections = props.navItems.reduce<Array<{ name: string; items: NavItem[] }>>((acc, item) => {
    const sectionName = item.section ?? "Dashboards";
    const section = acc.find((entry) => entry.name === sectionName);

    if (section) {
      section.items.push(item);
      return acc;
    }

    acc.push({ name: sectionName, items: [item] });
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#faf8f2_0%,_#f3efe7_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1660px] flex-col px-3 py-3 md:px-5 md:py-4">
        <header className="sticky top-0 z-40 -mx-1 border-b border-[#e8ddd1]/90 bg-[rgba(249,246,240,0.94)] px-1 py-2 backdrop-blur-md md:-mx-3 md:px-3">
          <div className="flex flex-wrap items-center justify-between gap-3 lg:flex-nowrap">
            <div className="flex min-w-0 items-center gap-3">
              {props.brandLogoUrl ? (
                <img
                  alt="IRBIS HVAC"
                  className="h-10 w-10 rounded-[0.9rem] border border-[#e7dfd3] bg-white object-contain p-1 shadow-[0_4px_14px_rgba(8,61,73,0.08)]"
                  src={props.brandLogoUrl}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[#083d49] text-sm font-black tracking-[0.08em] text-white shadow-[0_4px_14px_rgba(8,61,73,0.16)]">
                  IR
                </div>
              )}

              <div className="min-w-0">
                {activeItem?.section ? (
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">
                    {activeItem.section}
                  </div>
                ) : null}
                <div className="truncate text-[1rem] font-black tracking-tight text-[#182033] md:text-[1.12rem]">
                  {activeItem?.label ?? props.title}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 lg:justify-end">
              <div className="flex min-w-0 flex-1 justify-end">{props.headerContent}</div>
              <details className="relative shrink-0">
                <summary className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-[0.95rem] border border-[#e6ddd2] bg-white text-[0.95rem] font-black text-[#00363e] shadow-[0_4px_14px_rgba(15,23,42,0.06)] marker:hidden">
                  ☰
                </summary>
                <nav className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[20rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#e4ddd4] bg-white p-3 shadow-[0_18px_50px_rgba(0,54,62,0.12)]">
                  {navSections.map((section) => (
                    <div className="mb-3 last:mb-0" key={section.name}>
                      <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">
                        {section.name}
                      </div>
                      <div className="grid gap-1">
                        {section.items.map((item) => {
                          const active = item.href === props.activePath;

                          return (
                            <a
                              className={`rounded-xl px-3 py-2.5 text-sm transition ${
                                active
                                  ? "bg-[#00363e] text-white"
                                  : "bg-[#f7f3ee] text-[#00363e] hover:bg-[#fa6e18] hover:text-white"
                              }`}
                              href={item.href}
                              key={item.href}
                            >
                              <div className="font-black">{item.label}</div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </nav>
              </details>
            </div>
          </div>
        </header>

        <div className="sr-only">
          <h1>{props.title}</h1>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </div>

        <main className={`mt-4 flex-1 ${props.contentClassName ?? ""}`}>{props.children}</main>
      </div>
    </div>
  );
}
