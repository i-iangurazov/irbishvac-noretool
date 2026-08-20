# Service Technician Report Automation

## Delivery contract

- Business timezone: `TIMEZONE` from `irbishvac-marketing/.env`.
- Schedule: Thursday at 06:30 local business time; accepted start window is 06:30-06:49.
- Reporting window: month start through Wednesday, so an incomplete Thursday is never mixed into the report.
- Delivery: one PDF to each technician with no CC recipients.
- One combined HVAC packet routes to Ben, Vadim, and Tim in a single email with no CC.
- One combined Plumbing packet routes to Anton/Anthony, Vadim, and Tim in a single email with no CC.
- The SMTP sender is `EMAIL_FROM` from `irbishvac-marketing/.env`.

## Pipeline

`scripts/run_service_tech_thursday_delivery.py` performs the complete cycle:

1. Checks the weekday, time, timezone, enable flag, and process lock.
2. Exports current MTD ServiceTitan and Field Pro data.
3. Exports the prior three full months for personalized baselines.
4. Loads the active monthly goal file and validates every delivery-roster row before rendering.
5. Calculates appointment timing, time on site, Home Health completion, reviews, and audit signals.
6. Builds a frozen delivery snapshot.
7. Renders one Letter PDF per technician.
8. Runs overflow and broken-image QA on every page.
9. Validates all To/CC routes and attachment hashes.
10. Sends each PDF separately and records the result atomically.

## Duplicate prevention

Delivery state is stored under:

```text
var/service-tech-report-delivery/YYYY-MM-DD/delivery/delivery-state.json
```

- `sent` reports are skipped on retry.
- A changed attachment cannot be resent under the same delivery key.
- A report left in `sending` stops the run for manual reconciliation. This avoids an automatic duplicate when SMTP accepted a message but the process stopped before recording success.

## Commands

Full rehearsal with no email delivery:

```bash
python3 scripts/run_service_tech_thursday_delivery.py --mode dry-run --force-schedule
```

Normal scheduled invocation:

```bash
python3 scripts/run_service_tech_thursday_delivery.py --mode send
```

Install the macOS guard:

```bash
python3 scripts/install_service_tech_report_launchd.py
```

The guard checks every five minutes, while the pipeline itself runs only inside the configured Thursday window.

## Required configuration

```dotenv
TIMEZONE=America/Los_Angeles
EMAIL_FROM=marketing@irbishvac.com
TIM_EMAIL=tim@irbishvac.com
TECH_REPORTS_ENABLED=true
TECH_REPORT_SEND_WEEKDAY=THU
TECH_REPORT_SEND_HOUR=6
TECH_REPORT_SEND_MINUTE=30
TECH_REPORT_SEND_WINDOW_MINUTES=20
TECH_REPORT_HVAC_MANAGER_EMAIL=ben@irbishvac.com
TECH_REPORT_PLUMBING_MANAGER_EMAIL=anthony@irbishvac.com
VADIM_EMAIL=vadim@irbishvac.com
TECH_REPORT_VERSION=V7
TECH_REPORT_GOALS_FILE=/absolute/path/to/irbishvac-noretool/docs/august-2026-performance-goals.csv
```

SMTP and ServiceTitan credentials remain in the env file and are never written to delivery manifests or logs.

## Failure handling

- A ServiceTitan, build, QA, routing, or SMTP failure exits non-zero before unvalidated messages are sent.
- Partial SMTP success is resumable for reports already marked `sent`.
- Logs are written to `var/logs/service-tech-reports.log` and `var/logs/service-tech-reports.error.log` when launchd is installed.
- The generated package and visual QA images remain under `var/service-tech-report-delivery/YYYY-MM-DD/` for review.
