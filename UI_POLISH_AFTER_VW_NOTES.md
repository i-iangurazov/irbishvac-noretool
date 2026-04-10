# UI Polish After VW Notes

## Root Causes Found

- The vw migration preserved sizing, but several layouts lost their original breakpoint behavior when responsive tracks were moved into unconditional global CSS.
- Shared header/tool surfaces kept strong vw-based minimum widths, but the surrounding flex containers did not get enough shrink, wrap, and `min-width: 0` guards.
- Some modal, card, and right-rail grids still assumed fixed column counts that no longer matched their actual container widths after vw scaling.
- Long labels, timestamps, and metric values had too few containment rules, so wrapping and overflow became layout-breaking instead of graceful.

## Shared Fixes Introduced

- Added post-vw layout guardrails in `apps/web/app/globals.css`:
  - `overflow-x: clip` protection
  - `min-width: 0` / `min-height: 0` on shell, boards, cards, and key flex/grid children
  - header action/tool wrapping and alignment guards
  - filter bar wrapping/shrink behavior
  - freshness badge overflow containment
  - menu and modal overflow controls
  - text wrapping/ellipsis rules for long labels and values
- Restored breakpoint-aware behavior for the main shared board layouts instead of forcing multi-column tracks at every width.
- Made TV modal action grids adaptive with auto-fit columns and a full-width fullscreen action row.
- Added containment for leaderboard cards, capacity rows, and shared metric/value surfaces so long content no longer pushes cards out of shape.

## Page-Specific Fixes Introduced

- `company-wide`:
  - restored responsive stacking for the outer board, lower rail, marketing section, and calls section on non-TV widths
  - converted right-rail sales, goal, and gross-margin card groups to auto-fit grids instead of viewport-only breakpoint assumptions
  - improved containment for legend pills, trend month labels, marketing rows, and gross-margin scale labels
- `leaderboard` pages:
  - restored single-column-to-two-column board behavior based on page width
  - improved card shrink/wrap behavior for featured and compact cards
- `call-center/summary`:
  - stabilized card containment and shared board sizing through the shared guardrails
  - preserved the vw sizing system while reducing clipping risk in summary cards and TV rows

## Remaining Visual Outliers Needing Manual Review

- The `company-wide` board is still the most composition-heavy screen and should be checked on an actual desktop plus large TV.
- Rotated TV views should still get a manual pass, especially on the service/install/advisors-style boards, because the remaining tradeoff is density rather than outright breakage.
- If the product team wants tighter typography micro-tuning after seeing the live screens, that should be a small follow-up polish pass, not another responsive refactor.
