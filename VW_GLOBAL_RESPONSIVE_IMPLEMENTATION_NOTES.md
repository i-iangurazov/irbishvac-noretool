# VW Global Responsive Implementation Notes

## Root Causes

- The frontend was already dashboard-centric, but sizing was split between:
  - dashboard-scoped `clamp(...)` overrides in `apps/web/app/globals.css`
  - hardcoded Tailwind `px`, `rem`, arbitrary heights, and breakpoint-specific sizing in JSX
  - component-level spacing that bypassed the shared shell tokens
- Large-screen and TV shrinkage came from mixed systems:
  - shared layout surfaces scaled one way
  - dense page layouts, especially `company-wide` and `call-center/summary`, still used fixed paddings, heights, and text sizes
  - TV controls and shared cards still carried local size rules in JSX
- The practical frontend surface in this repo is the dashboard app, so the right fix was an app-wide token layer plus migration of shared dashboard primitives and the two bespoke layouts.

## New Scaling Approach

- Added an app-wide vw token system on `body[data-vw-app="true"]` in `apps/web/app/globals.css`.
- Centralized viewport tokens for:
  - spacing
  - radius
  - font sizes
  - controls
  - icons
  - modal widths
  - shadows
- Mapped dashboard shell variables (`--dash-*`) to the global vw tokens so existing dashboard architecture stayed intact.
- Kept TV and rotate behavior as token overrides by changing `--vw-unit` instead of scattering more special-case component rules.
- Migrated components toward semantic class hooks so sizing now comes from centralized CSS rather than JSX utility values.

## Files Changed

- `apps/web/app/layout.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/call-center/summary/page.tsx`
- `apps/web/components/company-wide-page.tsx`
- `apps/web/components/leaderboard-page.tsx`
- `packages/ui/src/components/capacity-bars.tsx`
- `packages/ui/src/components/dashboard-shell.tsx`
- `packages/ui/src/components/data-freshness-badge.tsx`
- `packages/ui/src/components/empty-dashboard-state.tsx`
- `packages/ui/src/components/filter-bar.tsx`
- `packages/ui/src/components/goal-tracker-card.tsx`
- `packages/ui/src/components/kpi-card.tsx`
- `packages/ui/src/components/leaderboard-card.tsx`
- `packages/ui/src/components/tv-fullscreen-button.tsx`
- `packages/ui/src/components/tv-settings-modal.tsx`

## What Now Scales Globally

- Dashboard shell padding, header spacing, logo sizing, menu sizing, and action controls
- Filter bar pills, freshness badge, TV settings modal, and fullscreen action
- Empty states, KPI cards, goal tracker cards, leaderboard cards, and capacity bars
- Company-wide board sections, trend chart rails/bars, marketing ring/cards, calls ring/cards, goal tracker, gross margin tracker, and monthly pace cards
- Leaderboard layouts for service, install, advisors, leads, campaigns, and call-center by-CSR pages through shared `LeaderboardPage` + `LeaderboardCard`
- Call-center summary board and TV summary metric surfaces

## Assumptions And Tradeoffs

- The user-facing frontend in this repo is effectively the dashboard app, so the vw system was applied there rather than attempting a risky monorepo-wide style rewrite.
- The refactor targets visual sizing, not business logic.
- Colors, gradients, borders, and some shadow recipes remain fixed design constants; layout and typography sizing are what now scale through vw.
- Structural utilities like `grid-cols-*`, `flex`, `absolute`, and viewport fill (`100dvh`) were kept where they define layout behavior rather than dimension tokens.

## Remaining Outliers For Manual Review

- `company-wide` remains the densest bespoke screen and should be checked on an actual wall-mounted TV and a rotated TV.
- Non-layout visual constants such as shadow blur values are still literal design values, not vw tokens.
- If the team wants literally every visual constant expressed as vw, the next pass should be limited to polish only; the core scaling system is now centralized and in place.
