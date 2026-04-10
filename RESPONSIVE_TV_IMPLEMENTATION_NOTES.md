# Responsive TV Implementation Notes

## Root Causes

- Dashboard sizing was split between default Tailwind `px`/`rem` classes and a large ad hoc `[data-tv-mode="true"]` override block in [`apps/web/app/globals.css`](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/apps/web/app/globals.css).
- Shared dashboard surfaces did not consume a single scale model, so desktop, TV, and rotating TV states drifted apart in proportion and readability.
- Header controls, menu surfaces, filter bars, cards, and board gaps were sized independently, which made large TV layouts feel sparse in some places and cramped in others.
- `CompanyWidePage` still contained several page-local TV sizing branches in JSX, especially around the trend chart, marketing panel, calls panel, and right-rail cards.

## New Scaling Approach

- Added a dashboard-scoped VW-first token layer under `data-dashboard-shell`, using `clamp(..., vw, ...)` so viewport width is the dominant input with min/max guards.
- Centralized dashboard tokens now cover:
  - spacing
  - typography
  - radii
  - borders and shadows
  - filter controls
  - leaderboard avatars/cards
  - company-wide ring/chart dimensions
- Added TV-specific and rotate-mode-specific token adjustments instead of maintaining a long flat list of one-off overrides.
- Migrated shared shell/menu/header/filter/freshness surfaces and the major dashboard boards to consume those tokens through semantic class hooks.

## Files Changed

- [`apps/web/app/globals.css`](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/apps/web/app/globals.css)
- [`apps/web/components/company-wide-page.tsx`](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/apps/web/components/company-wide-page.tsx)
- [`apps/web/components/leaderboard-page.tsx`](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/apps/web/components/leaderboard-page.tsx)
- [`apps/web/app/call-center/summary/page.tsx`](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/apps/web/app/call-center/summary/page.tsx)
- [`packages/ui/src/components/dashboard-shell.tsx`](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/packages/ui/src/components/dashboard-shell.tsx)
- [`packages/ui/src/components/tv-settings-modal.tsx`](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/packages/ui/src/components/tv-settings-modal.tsx)
- [`packages/ui/src/components/empty-dashboard-state.tsx`](/Users/ilias_iangurazov/Commercial/irbishvac-noretool/packages/ui/src/components/empty-dashboard-state.tsx)

## Assumptions And Tradeoffs

- Scope was applied to all current dashboard routes that render through the shared shell:
  - company-wide
  - technicians
  - installers
  - advisors
  - leads
  - campaigns
  - call-center summary
  - call-center by CSR
- The implementation stays dashboard-scoped instead of changing the whole app globally, to reduce risk outside the TV surfaces.
- Existing board architecture and page composition were preserved; the work is primarily a shared token layer plus targeted semantic hooks.
- Rotating TV mode was treated as the existing dashboard rotation state and tuned for readability by reducing leaderboard density and increasing shared scale consistency.

## Verification

- `pnpm --filter @irbis/ui typecheck`
- `pnpm --filter @irbis/web typecheck`
- `pnpm --filter @irbis/web test`

## Remaining Manual Review Items

- The company-wide board is materially improved, but it still has the highest layout complexity and should get a visual pass on a real TV/browser target.
- Non-dashboard application pages were intentionally left out of scope.
- If stakeholders want even more aggressive large-TV scaling, the new token layer can be tuned in one place without revisiting each dashboard component.
