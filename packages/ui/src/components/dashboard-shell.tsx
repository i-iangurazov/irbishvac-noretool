import type { ReactNode } from "react";
import { TvRotationRuntime } from "./tv-rotation-runtime";
import { TvSettingsModal } from "./tv-settings-modal";

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
  tvMode?: boolean | undefined;
  kioskMode?: boolean | undefined;
  navQueryString?: string | undefined;
  tvMenu?:
    | {
        enabled: boolean;
        toggleHref: string;
        kioskMode?: boolean;
        kioskHref?: string;
        rotateMode?: boolean;
        rotatePreset?: string;
        rotateOffHref?: string;
        rotateMtdHref?: string;
        rotateYtdHref?: string;
      }
    | undefined;
  headerContent?: ReactNode | undefined;
  contentClassName?: string | undefined;
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
  const kioskMode = Boolean(props.tvMode && props.kioskMode);
  const navHrefFor = (href: string) =>
    props.navQueryString ? `${href}?${props.navQueryString}` : href;
  const menuContent = (
    <nav className="dashboard-shell__menu absolute right-0 top-[calc(100%+0.5rem)] z-20 w-[20rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-[#e4ddd4] bg-white p-3 shadow-[0_18px_50px_rgba(0,54,62,0.12)] 3xl:w-[24rem] 3xl:p-4 4xl:w-[26rem] 5xl:w-[30rem] 5xl:p-5">
      {navSections.map((section) => (
        <div className="mb-3 last:mb-0" key={section.name}>
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500 3xl:text-[11px] 4xl:text-[12px] 5xl:text-[13px]">
            {section.name}
          </div>
          <div className="grid gap-1">
            {section.items.map((item) => {
              const active = item.href === props.activePath;

              return (
                <a
                  className={`dashboard-shell__menu-link rounded-xl px-3 py-2.5 text-sm transition 3xl:px-4 3xl:py-3.5 3xl:text-[1rem] 4xl:text-[1.08rem] 5xl:px-4.5 5xl:py-4 5xl:text-[1.16rem] ${
                    active
                      ? "bg-[#00363e] text-white"
                      : "bg-[#f7f3ee] text-[#00363e] hover:bg-[#fa6e18] hover:text-white"
                  }`}
                  href={navHrefFor(item.href)}
                  key={item.href}
                >
                  <div className="font-black">{item.label}</div>
                </a>
              );
            })}
          </div>
        </div>
      ))}

      {props.tvMenu ? (
        <>
          <div className="my-3 border-t border-[#eee5dc]" />
          <div className="mb-1">
            <TvSettingsModal
              enabled={props.tvMenu.enabled}
              kioskHref={props.tvMenu.kioskHref}
              kioskMode={props.tvMenu.kioskMode}
              rotateMode={props.tvMenu.rotateMode}
              rotatePreset={props.tvMenu.rotatePreset}
              rotateMtdHref={props.tvMenu.rotateMtdHref}
              rotateOffHref={props.tvMenu.rotateOffHref}
              rotateYtdHref={props.tvMenu.rotateYtdHref}
              toggleHref={props.tvMenu.toggleHref}
            />
          </div>
        </>
      ) : null}
    </nav>
  );

  return (
    <div
      data-tv-mode={props.tvMode ? "true" : "false"}
      data-kiosk-mode={kioskMode ? "true" : "false"}
      className={`bg-[linear-gradient(180deg,_#faf8f2_0%,_#f3efe7_100%)] text-slate-900 ${
        props.tvMode ? "h-[100dvh] overflow-hidden" : "min-h-screen"
      }`}
    >
      <TvRotationRuntime
        activePath={props.activePath}
        enabled={Boolean(props.tvMode && props.tvMenu?.rotateMode)}
        navItems={props.navItems}
        presetQuery={props.navQueryString ?? ""}
      />
      <div
        className={`dashboard-shell__inner mx-auto flex w-full flex-col ${
          props.tvMode
            ? "h-[100dvh] max-w-none overflow-hidden px-4 py-3 md:px-6 md:py-4 3xl:px-8 3xl:py-5 4xl:px-10 5xl:px-14"
            : "min-h-screen max-w-[1660px] px-3 py-3 md:px-5 md:py-4 2xl:max-w-[1980px] 3xl:max-w-[2620px] 3xl:px-7 3xl:py-5 4xl:max-w-[3340px] 4xl:px-10 5xl:max-w-[3920px] 5xl:px-14"
        }`}
      >
        {kioskMode ? (
          <div className="pointer-events-none fixed right-4 top-4 z-50 3xl:right-6 3xl:top-6">
            <details className="pointer-events-auto relative">
              <summary className="dashboard-shell__menu-button flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-[0.95rem] border border-[#e6ddd2] bg-white text-[0.95rem] font-black text-[#00363e] shadow-[0_4px_14px_rgba(15,23,42,0.12)] marker:hidden 3xl:h-12 3xl:w-12 3xl:text-[1.05rem] 4xl:h-14 4xl:w-14 4xl:text-[1.15rem] 5xl:h-16 5xl:w-16 5xl:text-[1.3rem]">
                ☰
              </summary>
              {menuContent}
            </details>
          </div>
        ) : (
        <header
          className={`dashboard-shell__header sticky top-0 z-40 border-b border-[#e8ddd1]/90 bg-[rgba(249,246,240,0.94)] backdrop-blur-md ${
            props.tvMode
              ? "-mx-2 px-2 py-2 md:-mx-4 md:px-4 3xl:-mx-6 3xl:px-6 4xl:-mx-8 4xl:px-8 5xl:-mx-10 5xl:px-10"
              : "-mx-1 px-1 py-2 md:-mx-3 md:px-3 3xl:-mx-5 3xl:px-5 3xl:py-3 4xl:-mx-7 4xl:px-7 5xl:-mx-10 5xl:px-10"
          }`}
        >
          <div
            className={`flex items-center justify-between gap-3 3xl:gap-4 ${
              props.tvMode ? "lg:flex-nowrap" : "flex-wrap lg:flex-nowrap"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3 3xl:gap-4">
              {props.brandLogoUrl ? (
                <img
                  alt="IRBIS HVAC"
                  className="dashboard-shell__logo h-10 w-10 rounded-[0.9rem] border border-[#e7dfd3] bg-white object-contain p-1 shadow-[0_4px_14px_rgba(8,61,73,0.08)] 3xl:h-14 3xl:w-14 3xl:rounded-[1rem] 4xl:h-16 4xl:w-16 5xl:h-20 5xl:w-20"
                  src={props.brandLogoUrl}
                />
              ) : (
                <div className="dashboard-shell__logo flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-[#083d49] text-sm font-black tracking-[0.08em] text-white shadow-[0_4px_14px_rgba(8,61,73,0.16)] 3xl:h-14 3xl:w-14 3xl:text-lg 4xl:h-16 4xl:w-16 5xl:h-20 5xl:w-20 5xl:text-xl">
                  IR
                </div>
              )}

              <div className="min-w-0">
                {activeItem?.section ? (
                  <div className="dashboard-shell__section text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500 3xl:text-[13px] 4xl:text-[14px] 5xl:text-[16px]">
                    {activeItem.section}
                  </div>
                ) : null}
                <div className="dashboard-shell__title truncate text-[1rem] font-black tracking-tight text-[#182033] md:text-[1.12rem] 3xl:text-[1.42rem] 4xl:text-[1.62rem] 5xl:text-[1.92rem]">
                  {activeItem?.label ?? props.title}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-2 3xl:gap-3 4xl:gap-4 lg:justify-end">
              <div className="flex min-w-0 flex-1 justify-end">{props.headerContent}</div>
              <details className="relative shrink-0">
                <summary className="dashboard-shell__menu-button flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-[0.95rem] border border-[#e6ddd2] bg-white text-[0.95rem] font-black text-[#00363e] shadow-[0_4px_14px_rgba(15,23,42,0.06)] marker:hidden 3xl:h-12 3xl:w-12 3xl:text-[1.05rem] 4xl:h-14 4xl:w-14 4xl:text-[1.15rem] 5xl:h-16 5xl:w-16 5xl:text-[1.3rem]">
                  ☰
                </summary>
                {menuContent}
              </details>
            </div>
          </div>
        </header>
        )}

        <div className="sr-only">
          <h1>{props.title}</h1>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </div>

        <main
          className={`dashboard-shell__main ${kioskMode ? "mt-0" : "mt-4"} flex-1 ${props.tvMode ? "min-h-0 overflow-hidden" : ""} ${
            props.contentClassName ?? ""
          }`}
        >
          {props.children}
        </main>
      </div>
    </div>
  );
}
