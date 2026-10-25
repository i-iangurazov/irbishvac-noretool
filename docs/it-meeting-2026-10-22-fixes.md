# IT meeting, October 22: TV and roster fixes

## Delivered behavior

- The HVAC Sales page renders the complete API roster. The former three-person name allowlist hid Angelo Gamez and Luis Retes even though the report already contained them.
- Operational TV reports (technicians, installers, advisors) refresh on Railway at startup and every 30 minutes, using a relative MTD period resolved at execution. This avoids dependence on delayed GitHub schedule launches. The latest inspected full GitHub refresh completed 27 of 28 scopes; the advisor YTD scope received ServiceTitan 504/524 responses. Sales now requires the actual selected scope: an unavailable annual report cannot borrow monthly figures or present unknown performance as zero. Failed terminal refresh jobs can retry after a cooldown, without duplicating in-flight work.
- ServiceTitan's published definition for report 80249474 names its filter `BusinessUnitId`; the advisor request now uses that exact name. A real filtered October request matched all five HVAC sellers and the displayed metrics on the live monthly board. Exact source figures are retained only in the private verification report. Explicit plumbing/electrical sales business units are excluded from the HVAC board and its supplemental roster. Full annual source completion remains a separate live verification item; no annual figures are estimated.
- The worker reads active technicians in the configured active ServiceTitan sales business units at startup and every 15 minutes. A complete, sanitized roster is cached separately from report periods. The API adds eligible zero-activity staff to any selected period without replacing or double counting report metrics. Historical report activity is retained; inactive/unrelated staff are not added as roster seeds. Failed source reads retain the last complete roster, and roster supplementation stops after 24 hours without a successful sync.
- Kitchen shows Sales / Raymond Porras as Sales Manager, Marketing / Emil Sultanaliev, and Customer Service / Adele Aldyrakhmanova. The latter two professional identities are present in ServiceTitan, but absent from the authorized Rippling directory. Their board-only contacts and Raymond's requested display title are traceable in `kitchen-org-display.ts`. No Rippling employment data is changed or invented. Unconfirmed reporting lines are omitted; the two departments appear in an independent block. Future matching Rippling records supersede the supplementary contacts without duplication.
- Executive and branch connector centerlines now align explicitly. The six connected columns retain readable widths. The independent department block fits below the short left columns. Existing portraits, birthday exclusions, crew, anniversaries, and monthly newsletter remain in place.

## Unattended TV recovery

Recovery is mounted above page error boundaries and remains active across normal SPA transitions. A failed route navigation has a 30-second watchdog; failed page renders show a branded reconnecting screen. Retry delays are bounded and persisted across reloads, with online/wake handling and cleanup. Hourly and business-midnight maintenance cannot be cancelled by a normal page-ready event. Relative ranges roll forward; explicit fixed historical ranges remain fixed.

Visible online TV views also refresh their server-rendered data every minute, including a stationary view with only one page. Ordinary route renders do not reset this interval; desktop and offline views do not trigger it.

Before replacing the document, the client probes the same-origin `/healthz` endpoint. This endpoint returns only `{ "ok": true }`, without authentication or infrastructure/user data. An unavailable server leaves recovery JavaScript running in the existing document, with automatic subsequent probes. A captive HTML response cannot pass this check. Clerk refresh is attempted with a bounded wait before reloading; existing session expiry and access restrictions remain enforced.

Server Components use the authenticated request identity and the existing backend server credential directly. They no longer forward an aging browser cookie through a second web middleware request. Reads and proxy calls have bounded transport timeouts, no caching, and explicit errors for network failures, redirects, HTML, or malformed JSON. Unauthenticated web API calls return JSON 401; pages still require sign-in.

## Verification

- Released behavior is covered by 393 passing tests: web 176, API 61, worker 35, domain 88, integrations 29, and UI 4. Experimental long-query transport tests are recorded separately until their live source check completes.
- Type checks and production builds for affected applications passed.
- Recovery tests include an accelerated 24-hour run with frequent route commits and document reloads, business midnight, fixed ranges, offline/wake, storage failures, retry backoff, hung auth/probe calls, superseded navigation, and timeout failures.
- Browser QA uses the production Kitchen directory and reviewed portrait files. A real React page failure automatically recovers. A stopped local server preserves the reconnecting document until the server returns.
- Kitchen's five screens and both newsletter pages were checked live after deployment, including loaded image dimensions, birthday exclusion, the Sales title, and both added department leaders. Service TV rotation, both HVAC Install pages, all five Sales people, CSR, and Memberships were also checked on the authenticated production site. Release IDs, source checks, and screenshots are retained privately with the task report.

Automated clock tests are not a physical overnight test of the office TV, browser power settings, or its network hardware. Existing frozen TV tabs must load the new release once before the new recovery code can run.
