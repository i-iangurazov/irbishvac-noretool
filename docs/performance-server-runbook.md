# Performance operations

Production services: API and web serve dashboards; the worker refreshes the shared
ServiceTitan personnel directory every 15 minutes in a dedicated queue. The
`performance-reports` service owns coaching preparation and delivery. Its `/data`
volume persists frozen inputs, PDFs, delivery state and scheduler history across releases.
No process depends on a Mac, a sibling checkout or a local env file.

## Rollout state — 2026-11-03

API, worker and dashboards are live. Both isolated smoke packages for the closed
working day November 2 generated all 9 technician and 5 advisor PDFs with no
layout QA failures. These were non-sending runs, not scheduled delivery proof.
The report service is configured for normal scheduling with
`PERFORMANCE_REPORT_AUTO_SEND=true` after the owner confirmed the live connection
test reached the inbox and the six legacy triggers were disabled. Verify the
runtime flag after the activation release. First real scheduled Thursday and
Friday delivery with the Mac off remains the final acceptance gate.

The owner chose Railway Hobby and reuse of the existing IRBIS Resend connection
from the marketing/recruiting service. Its existing sending-only credential has
been copied securely into the report service; sender remains
`marketing@irbishvac.com`, with owner checks addressed to `it@irbishvac.com`.
No new account, credential, subscription or plan upgrade was created. The
recruiting deployment and its sender were not changed. Resend's read API rejects
this key as `restricted_api_key`, confirming sending-only scope; that does not
prove a successful send or the sender domain restriction. An attachment-free owner-only server test was accepted by Resend on November 3.
The sender was marketing@irbishvac.com and the only recipient it@irbishvac.com;
the owner confirmed actual inbox receipt. Hobby's blocked SMTP
preflight is the historical blocker, not evidence of delivery.

For a future mail-provider change, verify the selected HTTPS transport for
both coaching mail and owner alerts before enabling delivery; preserve recipient routing,
attachment hashes and durable duplicate prevention. Use the least-permissive
sending credential and an approved company sender. Keep credentials in Railway
variables only. A local configuration check must not be described as SMTP RCPT
validation or proof of delivery. Verify an owner-only connection test before
enabling staff delivery. Repeat the legacy-scheduler check below during recovery.

For Resend, configure `PERFORMANCE_REPORT_MAIL_TRANSPORT=resend`, `RESEND_API_KEY`
and the approved `EMAIL_FROM` in the report service. Use a domain-restricted
`sending_access` key, not a full-access account key. The adapter sends PDFs as
base64 attachments to the fixed HTTPS endpoint and records the provider message
ID. Identical in-process retries reuse exact payload bytes and an idempotency key.
Provider keys expire after 24 hours; the persistent `sent`/`sending` records remain
the authority and are never discarded after that expiry. Unknown results still
require reconciliation. No automatic SMTP fallback occurs for an HTTPS failure.
See the [sending API](https://resend.com/docs/api-reference/emails/send-email),
[idempotency rules](https://resend.com/docs/dashboard/emails/idempotency-keys) and
[key permissions](https://resend.com/docs/api-reference/api-keys/create-api-key).

Run `python3 scripts/verify_performance_mail.py --state-dir /data/performance/mail`
to check configuration without sending. Adding `--send-owner-test` explicitly
sends one attachment-free message only to `PERFORMANCE_REPORT_ALERT_EMAIL`.
Its durable state is `mail/connection-test.json`; a reserved or accepted test is
not automatically replayed. An accepted provider response is not confirmation of
inbox receipt: check the owner's inbox before enabling staff delivery. HTTPS
preflight checks configuration and address format; it does not authenticate with
the provider or claim recipient acceptance. SMTP preflight remains available for
environments that actually permit SMTP.

Owner alerts also reserve a message in the persistent scheduler/monitor state
before making a delivery request. Connection/configuration failures before that
reservation retry after five minutes. The HTTPS adapter retries identical requests
in process; after an unknown result or restart, `alertReconciliationRequired`
blocks automatic replay permanently, including after provider idempotency keys
expire. Reconcile the recorded Message-ID/provider key before any manual resend.
Accepted alert records and provider receipts remain in `alertDeliveries`.

## Legacy cutover — November 3, 2026

The owner confirmed the server test from marketing@irbishvac.com reached
it@irbishvac.com in the inbox. Resend accepted it at 08:23:52 UTC; provider message
ID `01a1a081-edd9-7912-bd78-777fdef1b338`. The durable receipt is
`/data/performance/mail/connection-test.json`; re-running the test must not resend.

The exact Mac LaunchAgents `com.irbis.service-tech-reports` and
`com.irbis.advisor-reports` were disabled in launchctl, unloaded and their plist
files renamed with `.disabled-server-cutover-20261103`. Backups were preserved.
Both exact jobs were verified unloaded and disabled; no other job was changed.
The four existing Codex automations `technician-reports`, `technician-reports-2`,
`comfort-advisor-reports` and `comfort-advisor-reports-2` were paused through the
app and their saved status verified. Their original prompts/schedules remain
available for rollback; no duplicate server fallback automation was created.

During rollback, first set server auto-send false and verify it is applied.
Reconcile any server `sending` or `sent` receipts before reactivating anything
local: the old and new installations do not share delivery state. Restore only
the required launch agent or automation after that reconciliation, never both
independent send paths without shared duplicate prevention.

## Monthly external documents — November 2026

The production service account can read `November 2026 - Call Center Report`
(`1m1EOFwz3B9Vh0IWopyJoan7jLhNbJXiGx8yGy6e0cj0`) inside the shared CSR Reports
folder. Its `Master Sheet` has the expected CSR/lead/channel columns and dated
November 1–2 records. Both API and worker month mappings now preserve September
and October and select this file for `2026-11`. The similarly named November
file last modified in December 2025 is historical and must not be selected.

Marketing refresh and planning use the same resolver. Explicit mappings take
precedence; otherwise only a matching, unambiguous month/year file from the
shared folder or its year-labelled quarter folders is accepted. Missing files,
duplicates and missing `Master Sheet` fail without using the August default.
CSR text-source discovery already follows the same shared folder and retains
coverage/missing-month status. Source documents were not edited during audit.

The November source has no Campaign Plan, Capacity Plan, Campaign Forecast,
Campaign Costs or Campaign Commissions tabs at audit time. Their absence does
not approve October targets or manual costs for November; retain the existing
missing-plan/source status. Automatic provider costs still use the selected
month's dates.

The accessible Membership root and all 13 descendant folders were inspected;
no separate November membership document was found on November 3. The live
membership dashboard gets its metrics directly from ServiceTitan and uses the
CSR snapshot for representative names. Do not connect an older membership
workbook as a substitute for November activity.

## Schedule and acceptance

Times are Asia/Bishkek: Thursday technicians, Friday Comfort Advisors. Preparation
starts at 18:00; only complete, QA-passed packages may send at 19:35–19:44. At 19:45
unfinished cycles become `missed_deadline`; there is no automatic late delivery.
Source dates use America/Los_Angeles. Yesterday must have closed in that timezone
before extraction. Smoke runs use the last closed Pacific day, live in a separate
`smoke/` tree, and never send messages. They do not prove a scheduled live cycle.
`PERFORMANCE_REPORT_SMOKE_CYCLE=both` validates both packages sequentially and
keeps the service available for inspection. Each package retains its own result;
a passed PDF check does not override a failed mail preflight.

Final acceptance additionally requires successful Thursday and Friday delivery
records while the owner's Mac is switched off. Record the dates, deployment IDs,
message/provider IDs, management packets and the owner's Mac-off confirmation before
marking the priority complete. Initial rollout is not this final acceptance.

## Personnel and goals

`GET /api/dashboard/personnel?month=YYYY-MM` is the shared directory with goals.
Server access uses `x-dashboard-access-token`. Refresh and goal writes additionally
require `x-dashboard-write-token`. Both values use the existing server auth secret;
never put either in browser code, URLs, tickets or logs.

Every refresh completes all source pages before inserting an immutable snapshot.
New hires appear without activity or goals; inactive staff leave current views and
future emails; transfers use their current department. No source failure replaces
the last complete snapshot. Consumers refuse a directory older than 60 minutes
(or with an invalid/future timestamp). Raw metric and personnel history is retained.
Current roster views are explicitly current; archived raw reports remain the source
for historical employment reconciliation.

Goals are append-only approval versions, keyed by ServiceTitan employee ID, month
and department. Missing goals display `UPDATED_GOAL_PENDING`; prior months and
roles are never borrowed. An approved goal requires positive primary targets;
unapproved secondary targets remain null. Replaying the same approval source key
is idempotent; conflicting content requires a new source key. Use the protected
`POST /api/dashboard/personnel/goals` or the reviewed import script. Do not edit old
rows. Refresh consumers after an approval and regenerate any prepared package.

November advisor rule: 75 opportunities; prior ten completed calendar months,
exclude months before the verified HR hire date, sales and weighted average ticket
×1.50, opportunity-weighted close rate ×1.15 (relative). A month employed without
sales counts as zero. The hire month counts as a month; no unapproved prorating.
Angelo has no closed-sale history, so sales, ticket and close-rate targets remain
pending. `calculate-advisor-month-goals.ts` requires an explicit HR employment
input and complete source months; it never approves by itself. Keep its calculation,
HR-date evidence and source caches with the approved release.

Staff metrics require the exact resolved reporting scope, including default MTD.
If it is missing, the API queues a refresh and returns unavailable actuals with
the current roster. It never substitutes an unscoped latest staff export. The
live coaching page preserves that availability flag and requests month-start
through its displayed cutoff explicitly, matching the frozen-report period.

Dashboards and PDFs use the same scoped normalized performance source. The PDF
sales figure is `totalSales`, matching the dashboard Sales/Goal metric. Influenced
revenue is a separate metric. Canonical extraction refreshes the scoped dashboard
snapshot and verifies IDs, dates and source timestamp before freezing it. Missing
activity is distinguishable from missing staff. Incomplete pagination fails closed.
Stale dashboard timestamps are visibly labelled; coaching delivery requires a new
complete extraction after its cutoff closed.

## Inspect a run

In the Railway `performance-reports` service inspect:

- `/data/performance/scheduler/YYYY-MM-DD-{technician|advisor}.json`: scheduled status.
- `/data/performance/{service-tech-report-delivery|advisor-report-delivery}/YYYY-MM-DD/`:
  `preparation-state.json`, `server-run.log`, `source/`, `individual-pdfs/manifest.json`,
  `individual-pdfs/qa-results.json`, department PDFs and `delivery/`.
- `delivery/delivery-plan.json`: current recipient routing and frozen attachment hashes.
- `delivery/delivery-state.json`: each message's status, recipients, Message-ID and HTTPS provider receipt when applicable.
- `/data/performance/scheduler/personnel-health.json`: central directory health.

Use Railway's service/volume file browser to inspect or download evidence. Service
logs emit cycle/status only; detailed package logs and staff data stay on the volume.
Failures notify `PERFORMANCE_REPORT_ALERT_EMAIL` (initially it@irbishvac.com).
Identical unresolved alerts are deduplicated. Failed notification attempts retry.
API readiness includes personnel freshness, DB, Redis and metric snapshot health.

## Recovery and duplicate prevention

The service and sender each hold file locks; run only one report service replica.
Safe preparation retries occur before 19:30 and only before delivery has started.
Sending revalidates live personnel, addresses, departments, monthly goals and cutoff
completeness. Changed staff/goals block the frozen package. Before the send window,
regenerate the package after checking that no SMTP state exists. During or after
that window, resolve the failure with the owner; never bypass validation to meet a
clock time. Packages and state stay together on the volume.

A `sent` record is skipped on replay and its attachment hash must match. `sending`
means the provider may have accepted the message: inspect its log using the recorded
Message-ID, provider receipt or idempotency key and recipients. Only after that reconciliation may
an operator mark it confirmed sent or proven unsent. Never delete `sending` state
or regenerate PDFs after any message has started. Partial confirmed runs can resume
only unsent messages before the deadline. Missed deadlines require an explicitly
approved recovery, not a forced automatic send.

For a source or directory outage repair the actual source access, refresh personnel,
check readiness, and regenerate a not-yet-sent package. Do not relax the 60-minute
bound or substitute old employee/goal files. Missing employee email is recorded as
an issue and its PDF remains in the department packet; invalid recipients block
SMTP preflight. Missing goals are visibly pending and require owner assignment.

## Deploy and rollback

`deploy/Dockerfile.reporting` is selected only for the reports service through
`RAILWAY_DOCKERFILE_PATH`. API, worker and web retain their existing build/start
commands. Additive schema installation is `scripts/install-performance-schema.ts`;
it creates only the two new tables/indexes and seeds a complete directory. It never
runs a reset, drops existing tables or removes history. Generate Prisma before
building all consumers. Report scripts use `tsconfig.reporting.json` for API imports.

Release API/worker/web together with the report service. Keep the personnel queue
running even when report generation fails. After each release verify API readiness,
29-staff baseline against the actual source (the count may legitimately change),
current month goals, and both smoke packages. For rollback select the previous
known working Railway deployment; leave additive tables and the persistent volume
intact. Disable server auto-delivery during a disputed SMTP state. Before enabling
server delivery, disable matching legacy Mac launch agents and Codex report
fallback automations to prevent independently scheduled copies.

Secrets belong only in Railway variables. The report service requires ST read
credentials, database/Redis access for canonical refresh, server API auth, asset
settings, the selected mail-provider credentials and approved management routing. Never copy unrelated
advertising credentials. SMTP preflight authenticates and validates recipients
without sending DATA. Do not send test reports to staff.
