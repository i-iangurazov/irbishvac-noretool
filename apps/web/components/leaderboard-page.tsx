import {
  DashboardShell,
  DataFreshnessBadge,
  EmptyDashboardState,
  FilterBar,
  LeaderboardCard,
} from "@irbis/ui";
import {
  formatCompactCurrency,
  formatCurrency,
  formatPercent,
} from "@irbis/utils";
import { navItems } from "../lib/api";
import {
  buildDashboardQueryString,
  getDashboardRotationNavItems,
  buildKioskHref,
  buildPresetHref,
  buildRotationHref,
  buildTvModeHref,
  supportsDashboardRotation,
  type ResolvedDashboardFilters,
} from "../lib/dashboard-filters";
import { getBrandLogoUrl, resolveStaffHeadshotUrl } from "../lib/assets";

type LeaderboardStat = {
  label: string;
  value: string;
};

type LeaderboardItem = {
  title: string;
  subtitle?: string | undefined;
  valueLabel: string;
  value: string;
  stats: LeaderboardStat[];
  imageUrl?: string | null | undefined;
};

type KpiItem = {
  label: string;
  value: string;
  hint?: string;
};

type LeaderboardPageProps = {
  path: string;
  title: string;
  subtitle: string;
  freshness?: string | null;
  filters: ResolvedDashboardFilters;
  items: LeaderboardItem[];
  kpis: KpiItem[];
  maxVisibleItems?: number;
  useHeadshots?: boolean;
};

export function money(value: number) {
  return formatCurrency(value);
}

export function compactMoney(value: number) {
  return formatCompactCurrency(value);
}

export function ratio(value: number) {
  return formatPercent(value);
}

export function LeaderboardPage(props: LeaderboardPageProps) {
  const hasCachedData = Boolean(props.freshness) || props.items.length > 0;
  const tvMode = props.filters.tvMode;
  const rotationSupported = supportsDashboardRotation(props.path);
  const rotateMode = rotationSupported && props.filters.rotateMode;
  const maxVisibleItems = props.maxVisibleItems ?? 9;
  const visibleItems = props.items.slice(0, maxVisibleItems);
  const items = visibleItems.map((item) => ({
    ...item,
    imageUrl: props.useHeadshots
      ? resolveStaffHeadshotUrl(item.title, item.imageUrl)
      : item.imageUrl,
  }));
  const featuredItem = items[0];
  const secondaryItems = items.slice(1);

  return (
    <DashboardShell
      title={props.title}
      subtitle={props.subtitle}
      navItems={navItems}
      activePath={props.path}
      brandLogoUrl={getBrandLogoUrl()}
      tvMode={props.filters.tvMode}
      kioskMode={props.filters.kioskMode}
      navQueryString={buildDashboardQueryString(props.filters)}
      rotationNavItems={
        rotationSupported ? getDashboardRotationNavItems(navItems) : undefined
      }
      tvMenu={{
        enabled: tvMode,
        toggleHref: buildTvModeHref(props.path, props.filters, !tvMode),
        kioskMode: props.filters.kioskMode,
        kioskHref: buildKioskHref(
          props.path,
          props.filters,
          !props.filters.kioskMode,
        ),
        ...(rotationSupported
          ? {
              rotateMode,
              rotatePreset: props.filters.preset,
              rotateOffHref: buildRotationHref(
                props.path,
                props.filters,
                props.filters.preset,
                false,
              ),
              rotateMtdHref: buildRotationHref(
                props.path,
                props.filters,
                "mtd",
                true,
              ),
              rotateYtdHref: buildRotationHref(
                props.path,
                props.filters,
                "ytd",
                true,
              ),
            }
          : {}),
      }}
      contentClassName={
        "leaderboard-page__main"
      }
      headerContent={
        <div className="dashboard-header-tools flex flex-wrap items-center justify-end">
          <FilterBar
            from={props.filters.fromLabel}
            to={props.filters.toLabel}
            presets={[
              {
                label: "YTD",
                href: buildPresetHref(props.path, "ytd", props.filters),
                active: props.filters.preset === "ytd",
              },
              {
                label: "MTD",
                href: buildPresetHref(props.path, "mtd", props.filters),
                active: props.filters.preset === "mtd",
              },
            ]}
          />
          <DataFreshnessBadge value={props.freshness} />
        </div>
      }
    >
      <div className="leaderboard-page flex h-full min-h-0 flex-col">
        {hasCachedData ? (
          <div className="leaderboard-board grid items-stretch">
            {featuredItem ? (
              <LeaderboardCard
                featured={true}
                imageUrl={featuredItem.imageUrl}
                rank={1}
                stats={featuredItem.stats}
                subtitle={featuredItem.subtitle}
                title={featuredItem.title}
                value={featuredItem.value}
                valueLabel={featuredItem.valueLabel}
              />
            ) : null}

            <section className="leaderboard-secondary-grid grid auto-rows-fr items-stretch md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2">
              {secondaryItems.map((item, index) => (
                <div
                  className={
                    index >= 4
                      ? "hidden xl:block"
                      : index >= 2
                        ? "hidden md:block"
                        : ""
                  }
                  key={`${item.title}-${index + 1}`}
                >
                  <LeaderboardCard
                    featured={false}
                    imageUrl={item.imageUrl}
                    rank={index + 2}
                    stats={item.stats}
                    subtitle={item.subtitle}
                    title={item.title}
                    value={item.value}
                    valueLabel={item.valueLabel}
                  />
                </div>
              ))}
            </section>
          </div>
        ) : (
          <EmptyDashboardState
            title="No cached snapshot for this range yet"
            description="The API queued a background refresh for the selected preset. This page will populate as soon as the worker stores the real snapshot."
          />
        )}
      </div>
    </DashboardShell>
  );
}
