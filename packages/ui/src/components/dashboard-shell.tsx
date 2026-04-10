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
  rotationNavItems?: NavItem[] | undefined;
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
  const activeItem = props.navItems.find(
    (item) => item.href === props.activePath,
  );
  const navSections = props.navItems.reduce<
    Array<{ name: string; items: NavItem[] }>
  >((acc, item) => {
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
    <nav
      aria-label="Dashboard navigation"
      className="dashboard-shell__menu absolute right-0 z-20 border border-[#e4ddd4] bg-white shadow-[0_18px_50px_rgba(0,54,62,0.12)]"
    >
      <div className="dashboard-shell__menu-header">
        <div className="dashboard-shell__menu-eyebrow font-bold uppercase tracking-[0.28em] text-slate-500">
          Dashboard Menu
        </div>
        <div className="dashboard-shell__menu-current font-black tracking-tight text-[#182033]">
          {activeItem?.label ?? props.title}
        </div>
        {activeItem?.section ? (
          <div className="dashboard-shell__menu-current-section font-semibold text-slate-500">
            {activeItem.section}
          </div>
        ) : null}
      </div>

      <div className="dashboard-shell__menu-body">
        {navSections.map((section) => (
          <section className="dashboard-shell__menu-section" key={section.name}>
            <div className="dashboard-shell__menu-section-title font-bold uppercase tracking-[0.28em] text-slate-500">
              {section.name}
            </div>
            <div className="dashboard-shell__menu-grid grid">
              {section.items.map((item) => {
                const active = item.href === props.activePath;

                return (
                  <a
                    className={`dashboard-shell__menu-link transition ${
                      active
                        ? "bg-[#00363e] text-white"
                        : "bg-[#f7f3ee] text-[#00363e] hover:bg-[#fa6e18] hover:text-white"
                    }`}
                    href={navHrefFor(item.href)}
                    key={item.href}
                  >
                    <div className="dashboard-shell__menu-link-label font-black">
                      {item.label}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {props.tvMenu ? (
        <>
          <div className="dashboard-shell__menu-divider" />
          <section className="dashboard-shell__menu-tools">
            <div className="dashboard-shell__menu-section-title font-bold uppercase tracking-[0.28em] text-slate-500">
              Display Tools
            </div>
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
          </section>
        </>
      ) : null}
    </nav>
  );

  return (
    <div
      data-dashboard-shell="true"
      data-tv-mode={props.tvMode ? "true" : "false"}
      data-kiosk-mode={kioskMode ? "true" : "false"}
      data-rotate-mode={props.tvMenu?.rotateMode ? "true" : "false"}
      className="dashboard-shell h-[100dvh] overflow-hidden bg-[linear-gradient(180deg,_#faf8f2_0%,_#f3efe7_100%)] text-slate-900"
    >
      <TvRotationRuntime
        activePath={props.activePath}
        enabled={Boolean(props.tvMode && props.tvMenu?.rotateMode)}
        navItems={props.rotationNavItems ?? props.navItems}
        presetQuery={props.navQueryString ?? ""}
      />
      <div
        className={`dashboard-shell__inner mx-auto flex h-[100dvh] w-full flex-col overflow-hidden ${
          props.tvMode ? "max-w-none" : ""
        }`}
      >
        {kioskMode ? (
          <div className="dashboard-shell__kiosk-menu pointer-events-none fixed z-50">
            <details className="pointer-events-auto relative">
              <summary className="dashboard-shell__menu-button flex cursor-pointer list-none items-center justify-center border border-[#e6ddd2] bg-white font-black text-[#00363e] shadow-[0_4px_14px_rgba(15,23,42,0.12)] marker:hidden">
                ☰
              </summary>
              {menuContent}
            </details>
          </div>
        ) : (
          <header
            className={`dashboard-shell__header sticky top-0 z-40 border-b border-[#e8ddd1]/90 bg-[rgba(249,246,240,0.94)] backdrop-blur-md ${
              props.tvMode
                ? "dashboard-shell__header--tv"
                : "dashboard-shell__header--desktop"
            }`}
          >
            <div
              className={`dashboard-shell__header-row flex items-center justify-between ${
                props.tvMode ? "lg:flex-nowrap" : "flex-wrap lg:flex-nowrap"
              }`}
            >
              <div className="dashboard-shell__brand flex min-w-0 items-center">
                {props.brandLogoUrl ? (
                  <img
                    alt="IRBIS HVAC"
                    className="dashboard-shell__logo border border-[#e7dfd3] bg-white object-contain shadow-[0_4px_14px_rgba(8,61,73,0.08)]"
                    src={props.brandLogoUrl}
                  />
                ) : (
                  <div className="dashboard-shell__logo flex items-center justify-center bg-[#083d49] font-black tracking-[0.08em] text-white shadow-[0_4px_14px_rgba(8,61,73,0.16)]">
                    IR
                  </div>
                )}

                <div className="min-w-0">
                  {activeItem?.section ? (
                    <div className="dashboard-shell__section font-bold uppercase tracking-[0.24em] text-slate-500">
                      {activeItem.section}
                    </div>
                  ) : null}
                  <div className="dashboard-shell__title truncate font-black tracking-tight text-[#182033]">
                    {activeItem?.label ?? props.title}
                  </div>
                </div>
              </div>

              <div className="dashboard-shell__header-actions flex min-w-0 flex-1 items-center justify-end lg:justify-end">
                <div className="flex min-w-0 flex-1 justify-end">
                  {props.headerContent}
                </div>
                <details className="relative shrink-0">
                  <summary className="dashboard-shell__menu-button flex cursor-pointer list-none items-center justify-center border border-[#e6ddd2] bg-white font-black text-[#00363e] shadow-[0_4px_14px_rgba(15,23,42,0.06)] marker:hidden">
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
          className={`dashboard-shell__main ${kioskMode ? "mt-0" : "mt-4"} flex-1 min-h-0 overflow-hidden ${
            props.contentClassName ?? ""
          }`}
        >
          {props.children}
        </main>
      </div>
    </div>
  );
}
