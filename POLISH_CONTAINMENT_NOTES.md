# Polish Containment Notes

## Root Causes Found

- The company-wide board mixed strict equal-height grid tracks with aggressive `overflow: hidden`, so dense panels were forced into buckets that were too small for their content.
- Desktop company-wide reused the same `h-full` assumptions as TV presentation mode, which caused readable content to be clipped instead of letting the board negotiate height.
- The dropdown menu and TV settings modal both reused broad shared action styles, so they lacked their own shell, grouping rhythm, and local hierarchy.
- Important company-wide text still used truncation in a few places, which hid meaningful business data instead of wrapping it.

## Shared Layout Fixes Introduced

- Gave the dashboard dropdown menu a proper panel structure with a header, body, section separation, bounded internal scrolling, and more intentional menu item sizing.
- Converted the TV settings surface into a centered bounded dialog with a real header/body split, section cards, readable action rows, and explicit active-state treatment.
- Kept the global `vw` token system intact and only layered local containment/polish rules on top of it.

## Company-Wide Page Fixes

- Switched desktop company-wide to a softer bounded-scroll model inside the main content area so important content stays visible instead of being clipped.
- Relaxed desktop-only equal-height row constraints on the left column, support stack, and right rail.
- Increased separation between major blocks and restored more breathing room inside the trend panel.
- Kept TV mode tighter, while desktop now prioritizes readability over forced compression.
- Removed truncation from marketing/source labels so names can wrap visibly.
- Aligned marketing and calls internals toward the top of their panels so content reads more naturally.

## Dropdown Menu Fixes

- Added a menu header with current board context.
- Introduced clearer section rhythm, divider treatment, and bounded scrolling inside the menu body.
- Normalized menu item sizing and panel spacing so the dropdown reads like a deliberate navigation surface instead of a raw stacked list.

## TV Settings Modal Fixes

- Centered the modal and constrained its width and height cleanly.
- Added a proper header/body layout with grouped sections and descriptive copy.
- Converted controls into readable action cards with title, description, and state treatment.
- Aligned fullscreen behavior with the same active-state styling as the other settings.

## Remaining Limitations / Manual Review

- Company-wide is the densest page in the app and still benefits from a manual visual check on real large displays.
- If stakeholders want a stricter single-screen company-wide desktop layout again, that should be handled with explicit per-panel budgeting rather than returning to blanket clipping.
