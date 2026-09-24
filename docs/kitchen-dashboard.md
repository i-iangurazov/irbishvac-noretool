# Kitchen TV dashboard

Implements Tim's September 17 request at `/kitchen`, available as **People & Company News** in the existing dashboard menu.

- Reporting structure comes from Rippling's worker-to-manager relationships. The display starts with employees without a reporting manager, then pages through each manager's direct reports. Every active employee is included; missing departments and photos have honest fallbacks.
- Birthdays and work anniversaries show the current month in `APP_TIMEZONE` (America/Los_Angeles by default). Birthday cards show month/day, never age or birth year. Anniversaries use `original_start_date` only, and display the milestone reached that month. A February 29 event is observed on February 28 in non-leap years.
- Launch the TV at `/kitchen?tv=1&kiosk=1&rotate=1`. Each screen advances after five seconds, in both desktop and TV playback. Legacy `seconds` URL parameters no longer override this interval. Today's birthdays and work anniversaries have dedicated screens at the start of each cycle, followed by the full org chart, other monthly celebrations, and news. Every celebration appears once per cycle. Play starts with today's celebrations when present; previous/next and section buttons pause rotation. A new company day or newly synced celebration receives priority automatically while playing, without repeated interruptions on ordinary refreshes. The existing DashboardShell supplies the unchanged header, fullscreen controls, dashboard navigation, and kiosk behavior. The kitchen content uses Lucide icons. Empty news/celebration sections remain accessible manually and are skipped during unattended rotation.
- The API refreshes employees hourly, independently of ServiceTitan and Redis. The browser checks the API every minute and recalculates the calendar every 30 seconds, including month/year rollover. Only complete successful reads replace the persistent snapshot. A short source outage keeps the previous snapshot with a stale indicator; snapshots older than 24 hours stop displaying.
- All board requests use the existing Clerk/company access policy and protected API proxy. The Rippling token stays on the API server. No public employee endpoint or new authentication bypass was added.

## Company news

No announcement editor is included. No company announcements have been invented. Tim did not specify a news source; that part requires a source/content decision before it can update automatically.

The display accepts optional server-side `KITCHEN_NEWS_JSON`, an array of `{id,title,body,startsOn?,endsOn?}`. Dates use YYYY-MM-DD in the company timezone and both publication boundaries are inclusive. The default `[]` shows an honest empty state. This is a content adapter for an agreed source, not a new publishing workflow. Keep the title under 120 characters and body under 1,000 characters. A feed integration can replace this adapter once the source is known.

## Setup and release

The change adds one table, `KitchenSnapshot`, without changing existing dashboard tables or enums.

1. Apply `packages/db/sql/kitchen-board.sql` to the target database with the normal database change process. It is additive and idempotent. Do not run a broad schema push against production.
2. Generate the Prisma client: `pnpm --filter @irbis/db prisma:generate`.
3. Configure the API service with `RIPPLING_API_TOKEN`, `RIPPLING_API_VERSION=2024-08-01`, `RIPPLING_SYNC_INTERVAL_MINUTES=60`, and `RIPPLING_MAX_STALE_HOURS=24`. Existing `DATABASE_URL` and `APP_TIMEZONE` apply. Never prefix the token with `NEXT_PUBLIC_`.
4. Build/restart the API and web services. The API imports the roster at startup if its snapshot is due. Each API instance checks persistent freshness before refreshing, and deduplicates overlapping requests in that process.
5. Sign in normally, open `/kitchen`, confirm the latest update timestamp, and launch TV mode. Use the authorized shared display account already supported by the app for the kitchen TV.

The token needs `workers.read`, `workers.original-start-date.read`, `users.read`, and `departments.read`, plus the owner's read permissions for employee birthdays and original hire dates. A valid token does not override the owner's field permissions.

## Employee photo matching

The API uses the existing `R2_PUBLIC_BASE_URL`, `ASSET_FOLDER_TECHNICIAN_PHOTOS`, `R2_TECHNICIAN_PHOTO_EXT`, and `R2_TECHNICIAN_PHOTO_NAME_STYLE` configuration. Set these on the API service as well as the web service. Current file names use spaces and `.png` in `technicians_photos`.

During the hourly roster sync, exact full names are checked first, followed by capitalization, accent, suffix/initial, and unambiguous shortened-name variants. It never uses first names alone, guesses nicknames, or compares faces. A shortened name is rejected if another active employee could claim it. Confirmed image responses are stored as the primary photo URL; Rippling remains the fallback URL. If Cloudflare is not configured or a file cannot be verified, Rippling remains primary. Missing-photo counts reflect both sources.

Availability checks use public HEAD requests with no credentials, six concurrent workers, per-request timeouts, and a 25-second overall limit. No Cloudflare listing or write permissions are needed. Cloudflare headshots use the existing Next image optimizer at 1200 pixels and quality 82, including preloads, so TV browsers do not download the large original PNGs. If optimization fails, the browser tries the original Cloudflare image before falling back to Rippling and finally initials. This does not alter photos in either source system.

## Portrait framing

The kitchen portrait component uses image-specific, reviewed face bounds in `apps/web/lib/kitchen-portrait-focus.json`. Keys hash the original image origin/path, so expiring URL signatures and the Next image optimizer share the same framing. Bounds are normalized and contain no employee names or source URLs. They describe composition only; Cloudflare matching remains strictly name-based.

Portraits target a consistent face size and vertical placement, fill their card, and recalculate when the card resizes. Group photos preserve all face bounds. Reviewed equipment, logo, or blank images are marked `null` and skipped through the existing source fallback chain. The current roster has 49 usable primary portraits and 14 initials placeholders. All 16 backup images were reviewed too; two non-portraits are skipped.

A replacement at a new source path is displayed in full until its framing is reviewed and added to this map. If an image is overwritten at the same path, update its bounds as part of the replacement. Source photos are never edited or rewritten. The current bounds were measured locally and visually checked in the actual portrait component; there is no face-recognition service or runtime image-analysis dependency.

## Data boundaries and operations

Raw Rippling API records are not persisted. The snapshot contains only active worker IDs, names, titles, department names, manager IDs, photo URLs, birthday month/day, original hire dates, and aggregate data-quality counts. It excludes personal emails, addresses, compensation, government identifiers, and full dates of birth. Employee photos prefer verified matches in the existing Cloudflare R2 headshot folder, with the Rippling photo retained as a fallback. Browser image errors try Rippling before initials. Photo requests never receive the Rippling API token.

The API's fixed Rippling origin, pagination checks, bounded retries and timeouts prevent partial ingestion and sending credentials to another host. Logs contain counts and generic error codes only. Employees missing birthdays/hire dates are omitted from that celebration list, and the page indicates incomplete date information. Successful future syncs update permission restrictions, departures, title changes, and photos automatically.

The news source and remaining photo uploads are content follow-ups; the code does not fabricate them. Confirm counts again after deployment because Rippling changes over time.

## TV presentation update — September 24

The kitchen route retains the shared DashboardShell and its existing header. The redesigned content fills the available area below it, using locally hosted Montserrat and Lucide icons; it does not replace or restyle the shared header. Large original employee photos replace the small circular avatars. The overview shows up to four people; team screens show a manager and up to three direct reports, with an explicit reporting connection. Smaller groups stay balanced rather than stretching one face across the entire screen. Celebration screens show large photos, month/day, and anniversary milestones. The next screen’s photos preload; failed or missing images retain the employee’s name and initials.

Live verification on September 24 found 63 active employees, all 63 birthdays and first hire dates available, 43 photos, and one missing department. These are observations, not hardcoded roster values. The Cloudflare lookup subsequently matched 25 existing headshots, leaving 27 employees using Rippling photos and 11 without either source. These remaining photos can be supplied through the existing Cloudflare folder or Rippling; do not fabricate portraits or infer reporting relationships.

Browser review covered Full HD, 1600×900, 1280×720, 4K, and mobile, using the authenticated live snapshot. Every org-chart page was checked at Full HD and 720p for card/text overflow. Production publishing remains a separate release step requiring the database table and API environment above.
