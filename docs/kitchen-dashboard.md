# Kitchen TV dashboard

Updated October 19, 2026 against Vadim's eight-page Kitchen TV Mockup and Spec.

## Open the board

- Dashboard: https://irbisweb-production.up.railway.app/kitchen
- Unattended TV: https://irbisweb-production.up.railway.app/kitchen?tv=1&kiosk=1&rotate=1
- Monthly upload: https://irbisweb-production.up.railway.app/kitchen/insider

The board uses a 1920 × 1080 canvas scaled proportionally to the viewport, including 4K at 2×. It has its own mockup header, transparent full-color logo, Montserrat, light leopard artwork, circular photos, and initials fallbacks. TV controls stay hidden until hovered or keyboard-focused. The existing dashboard authentication remains required.

## Five-screen loop

1. Leadership and revenue: CEO, COO, CFO in that order, each connected to their own branches. Installation is summarized; HVAC service is grouped. Names, titles, counts, photos and relationships come from the existing normalized Rippling snapshot.
2. Installation crew: the employee with the Installation Manager role and their direct reports. Job titles determine lead installers, helpers, plumbing, electrical, and permits/inspections/warranty groups. Helpers split into columns. Extra columns paginate without dropping employees.
3. Birthdays: current company month, date order, four-column grid, at most eight people per page. Earlier dates have grey pills and 72% opacity.
4. Anniversaries: current company month, at most four tall cards per page, milestone years, passed/upcoming state. Employees with less than one year are omitted.
5. IRBIS Insider: two full portrait pages, side by side, 717 × 930 pixels each. October 2026 uses the newsletter artwork supplied in Vadim's mockup, stored as a protected database issue.

The first four screens stay for 20 seconds each; Insider stays for 45 seconds. A short fade connects screens. Empty birthday/anniversary months are omitted. Overflow pages receive the same section duration. Normal refreshes do not reset playback. Calendar rules use `APP_TIMEZONE` (America/Los_Angeles), never the operator's computer timezone.

## Monthly publishing

Sign in with an individual permitted IRBIS account and open **Upload Insider**. Choose the issue month. Select one two-page portrait PDF, or exactly two PNG/JPEG/WebP images. Review both pages, swap their order if needed, and publish. The TV checks for an updated issue every minute. The shared TV account remains read-only.

PDF conversion runs locally in the browser with the bundled Mozilla PDF.js worker. The server accepts exactly two portrait page images, validates and re-encodes them, and stores the monthly issue atomically in PostgreSQL. File names, month, publisher ID, and upload time are retained. Invalid uploads never replace the current issue. The upload is bounded to 16 MB total; the UI accepts files up to 12 MB each. Newsletter content and images require dashboard authentication; uploaded pages are never placed on a public asset host.

Future issues can be uploaded in advance. The current company month selects the issue automatically. If none is published, the TV displays a truthful pending-issue message. Each issue is selected only for its own month.

## Data and operations

The existing API synchronizes Rippling hourly, and the browser checks that snapshot every minute. Only complete successful reads replace the persistent roster. Server-unavailable data clears the employee display; a temporary network failure can retain the last available snapshot for at most 24 hours. No birth years, ages, personal emails, addresses, compensation or identifiers are added to the board.

The new additive table is defined in `packages/db/sql/kitchen-newsletter.sql` and `packages/db/prisma/schema.prisma`. Apply only that SQL, then run the normal Prisma generation and web build. No broad schema push is needed. The web service already has its protected PostgreSQL connection. The API and worker do not require a release for this web change.

`node scripts/prepare-kitchen-assets.mjs` copies the worker from the lockfile-pinned PDF.js package before web build/dev. Newsletter artwork stays in the authenticated database, outside the public source repository; pages are served only through protected handlers. Shared dashboard shell/header and unrelated dashboards are unchanged.

## Long-running pages and release compatibility

Kitchen clients that support the lower department row request `/api/dashboard/kitchen?presentation=2`. Requests without that explicit version retain the earlier seven-column presentation, with the additional department contacts outside the executive branches. Do not change the default contract to the new hierarchy: pre-existing TV documents continue polling data with their old JavaScript and CSS. Plumbing's department label is `Plumbing Service`; the full technician role remains inside the card.

The Kitchen page receives the web deployment identity and checks the protected, uncached `/api/kitchen/release` endpoint every minute. Two consistent observations of a different release request a full document reload through the existing online/authentication recovery mechanism. Server/router prop refreshes do not advance the version of the already-loaded document. The selected slide and rotation state survive that reload. Recovery also runs for ordinary `/kitchen` pages with the controls visible, even without `tv=1`.

Documents opened before the release monitor was installed need one initial reload to obtain the new interface and monitoring code. The compatible data response restores their readable layout on their next ordinary roster poll in the meantime. Release QA must cover an old document receiving new API data without reloading, and both ordinary and TV modes.

## Verification

The October implementation is covered by 120 web tests, including screen ordering, role-driven hierarchy, 37-person crew completeness, crew overflow, celebration pagination, empty-month skipping, 20/45-second timing, milestones, authentication, shared-account write rejection, cross-origin rejection, bounded upload parsing, invalid images, and atomic validated storage. Production build and TypeScript checks pass. Browser review covers Full HD, 4K and 1280 × 720; physical TV playback still requires loading/reloading the TV URL on that device.
