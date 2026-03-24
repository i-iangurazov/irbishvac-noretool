import {
  DashboardShell,
  DataFreshnessBadge,
  EmptyDashboardState,
  FilterBar,
  LeaderboardCard
} from "@irbis/ui";
import { formatCompactCurrency, formatCurrency, formatPercent } from "@irbis/utils";
import { navItems } from "../lib/api";
import {
  buildDashboardQueryString,
  buildKioskHref,
  buildPresetHref,
  buildRotationHref,
  buildTvModeHref,
  type ResolvedDashboardFilters
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
  const visibleItems = props.items.slice(0, props.maxVisibleItems ?? 9);
  const items = visibleItems.map((item) => ({
    ...item,
    imageUrl: props.useHeadshots ? resolveStaffHeadshotUrl(item.title, item.imageUrl) : item.imageUrl
  }));
  const tvMode = props.filters.tvMode;
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
      tvMenu={{
        enabled: tvMode,
        toggleHref: buildTvModeHref(props.path, props.filters, !tvMode),
        kioskMode: props.filters.kioskMode,
        kioskHref: buildKioskHref(props.path, props.filters, !props.filters.kioskMode),
        rotateMode: props.filters.rotateMode,
        rotatePreset: props.filters.preset,
        rotateOffHref: buildRotationHref(props.path, props.filters, props.filters.preset, false),
        rotateMtdHref: buildRotationHref(props.path, props.filters, "mtd", true),
        rotateYtdHref: buildRotationHref(props.path, props.filters, "ytd", true)
      }}
      contentClassName={
        tvMode
          ? "min-h-[calc(100dvh-7.5rem)] 4xl:min-h-[calc(100dvh-8.5rem)] 5xl:min-h-[calc(100dvh-9.5rem)]"
          : "4xl:min-h-[calc(100dvh-9rem)] 5xl:min-h-[calc(100dvh-10rem)]"
      }
      headerContent={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <FilterBar
            from={props.filters.fromLabel}
            to={props.filters.toLabel}
            presets={[
              {
                label: "YTD",
                href: buildPresetHref(props.path, "ytd", props.filters),
                active: props.filters.preset === "ytd"
              },
              {
                label: "MTD",
                href: buildPresetHref(props.path, "mtd", props.filters),
                active: props.filters.preset === "mtd"
              }
            ]}
          />
          <DataFreshnessBadge value={props.freshness} />
        </div>
      }
    >
      <div className={`flex flex-col gap-3 ${tvMode ? "leaderboard-page leaderboard-page--tv h-full min-h-0" : "leaderboard-page"}`}>
        {hasCachedData ? (
          tvMode ? (
            <section className="leaderboard-tv-grid h-full min-h-0">
              {items.map((item, index) => (
                <div
                  className={index === 0 ? "leaderboard-tv-slot leaderboard-tv-slot--featured" : "leaderboard-tv-slot"}
                  key={`${item.title}-${index + 1}`}
                >
                  <LeaderboardCard
                    featured={index === 0}
                    imageUrl={item.imageUrl}
                    rank={index + 1}
                    stats={item.stats}
                    subtitle={item.subtitle}
                    title={item.title}
                    value={item.value}
                    valueLabel={item.valueLabel}
                  />
                </div>
              ))}
            </section>
          ) : (
            <div
              className="leaderboard-board grid items-stretch gap-3 3xl:gap-4 xl:grid-cols-[minmax(18rem,0.44fr)_minmax(0,1.56fr)] 2xl:grid-cols-[minmax(19rem,0.45fr)_minmax(0,1.55fr)] 3xl:grid-cols-[minmax(21rem,0.47fr)_minmax(0,1.53fr)] 4xl:grid-cols-[minmax(25rem,0.5fr)_minmax(0,1.5fr)] 5xl:grid-cols-[minmax(29rem,0.54fr)_minmax(0,1.46fr)] 4xl:min-h-[calc(100dvh-9rem)] 5xl:min-h-[calc(100dvh-10rem)]"
            >
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

              <section className="leaderboard-secondary-grid grid auto-rows-fr items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4 xl:grid-rows-2 3xl:gap-4 4xl:h-full 5xl:h-full">
                {secondaryItems.map((item, index) => (
                  <div
                    className={
                      index >= 4 ? "hidden xl:block" : index >= 2 ? "hidden md:block" : ""
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
          )
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
