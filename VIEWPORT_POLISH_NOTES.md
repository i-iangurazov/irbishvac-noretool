# Viewport Polish Notes

## Root Causes Found

- The shared dashboard shell already used `100dvh`, but several dashboard surfaces still behaved like natural-height documents instead of bounded viewport layouts.
- Leaderboard pages kept a large-screen `min-height` constraint and overly tall featured-card spacing, which made the card grid feel heavy and pushed the composition past the available height budget.
- Company-wide panels still used older, roomier spacing values from before the viewport-fit pass, especially in the trend chart, right rail, and lower support widgets.
- Some grid children were missing explicit `min-height: 0`, `height: 100%`, or equal-row budgets, so they expanded to content height instead of respecting their parent grid tracks.
- A later guardrail rule reset the company right rail to `auto` rows on desktop, which fought the intended fixed viewport composition.

## What Changed To Fit Pages Within `100vh`

- Tightened vertical density in shared dashboard surfaces by reducing card/panel padding, panel title spacing, stat-row height, and internal content gaps.
- Removed the large-screen leaderboard `min-height` override that was forcing extra height.
- Added stronger `height: 100%`, `min-height: 0`, and `overflow: hidden` containment on dashboard page wrappers and board grids.
- Reintroduced explicit row budgeting for the desktop company-wide board so the left column and right rail divide the available height instead of stacking to natural content size.
- Reduced company trend chart height and label-row height by switching to the existing dashboard chart-height tokens instead of larger hardcoded values.

## Shared Fixes Introduced

- `apps/web/app/globals.css`
  - `leaderboard-page`, `company-wide-page`, and `leaderboard-board` now explicitly contain overflow.
  - `leaderboard-secondary-grid` now uses equal auto rows and stretch alignment.
  - `leaderboard-card` spacing was tightened, especially featured-body spacing and stat-row height.
  - `company-panel`, `capacity-bars`, and related dashboard panels now use flex-column/min-height-safe internals.
  - Company-wide section gaps, panel padding, pace-card padding, metric card padding, and supporting stat gaps were reduced.
  - Chart wrappers, panel bodies, and stacked widget groups now honor bounded height better.
  - Large-screen header tools now stay on one line when there is enough width.

## Page-Specific Fixes Introduced

- Technicians / leaderboard-style pages
  - Reduced featured-card visual weight and tightened card rhythm.
  - Forced the desktop leaderboard grid to fill the available viewport instead of inheriting a tall minimum height.
  - Ensured the secondary leaderboard cards balance as equal-height rows on large screens.

- Company-wide page
  - Tightened the trending section, lower rail, and right-hand widget stack.
  - Reduced the chart footprint and panel spacing so the board fits more cleanly into a single viewport.
  - Reapplied explicit right-rail row budgeting on large desktop layouts so the four stacked widgets share height evenly.

## Intentional Exceptions

- Smaller desktop widths below the large dashboard breakpoint still allow the single-column fallback layouts already present in the app.
- If a future screen gains materially more content than the current KPI/widget set, that screen may still need bounded internal scrolling inside a widget rather than page scroll.

## Remaining Visual Outliers For Manual Review

- The company-wide board is still the densest composition and should be checked on a real large display for final tuning.
- Rotated TV mode should be visually checked after this pass to confirm the new tighter panel budgets still feel readable at distance.
