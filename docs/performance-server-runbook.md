# Performance operations

Production services: API and web serve dashboards; the worker refreshes the shared
ServiceTitan personnel directory every 15 minutes in a dedicated queue. The
`performance-reports` service owns coaching preparation and delivery. Its `/data`
volume persists frozen inputs, PDFs, SMTP state and scheduler history across releases.
No process depends on a Mac, a sibling checkout or a local env file.

## Rollout state — 2026-11-03

API, worker and dashboards are live. Reports remain in isolated smoke mode;
scheduled server delivery is not enabled. `PERFORMANCE_REPORT_AUTO_SEND=false`
must remain set until the mail channel has been configured and verified. The
owner chose to retain Railway Hobby and use an HTTPS mail API. Hobby blocks
outbound SMTP, so the current SMTP preflight failure is a known rollout blocker,
not evidence of a delivered cycle. No plan upgrade or paid mail account has been
created. A Resend HTTPS adapter is implemented and tested but is not selected or
connected in production; a different provider needs its own reviewed adapter.

Before enabling normal operation, connect and verify the selected HTTPS
transport for both coaching mail and owner alerts; preserve recipient routing,
attachment hashes and durable duplicate prevention. Use the least-permissive
sending credential and an approved company sender. Keep credentials in Railway
variables only. A local configuration check must not be described as SMTP RCPT
validation or proof of delivery. Verify an owner-only connection test before
enabling staff delivery. Then perform the legacy-scheduler cutover below.

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
SMTP message IDs, management packets and the owner's Mac-off confirmation before
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
- `delivery/delivery-state.json`: each message's status, recipients and SMTP message ID.
- `/data/performance/scheduler/personnel-health.json`: central directory health.

Use Railway's service/volume file browser to inspect or download evidence. Service
logs emit cycle/status only; detailed package logs and staff data stay on the volume.
Failures notify `PERFORMANCE_REPORT_ALERT_EMAIL` (initially it@irbishvac.com).
Identical unresolved alerts are deduplicated. Failed notification attempts retry.
API readiness includes personnel freshness, DB, Redis and metric snapshot health.

## Recovery and duplicate prevention

The service and sender each hold file locks; run only one report service replica.
Safe preparation retries occur before 19:30 and only before SMTP has started.
Sending revalidates live personnel, addresses, departments, monthly goals and cutoff
completeness. Changed staff/goals block the frozen package. Before the send window,
regenerate the package after checking that no SMTP state exists. During or after
that window, resolve the failure with the owner; never bypass validation to meet a
clock time. Packages and state stay together on the volume.

A `sent` record is skipped on replay and its attachment hash must match. `sending`
means SMTP delivery may have occurred: inspect the mail provider's sent-mail/log
using the recorded Message-ID and recipients. Only after that reconciliation may
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
settings, SMTP credentials and approved management routing. Never copy unrelated
advertising credentials. SMTP preflight authenticates and validates recipients
without sending DATA. Do not send test reports to staff.
