# September 9 IT Meeting: Delivery Report

Date: September 9, 2026. Repository: `irbishvac-noretool`. Branch: `main`.

## Status

| Requested outcome | Actual result |
| --- | --- |
| Eight HVAC Install technicians on one TV screen | Deployed in `f75b822`, with installer-initials contrast polished in `2b0cc28`. Both Railway web deployments succeeded. |
| Predictable page rotation | Implemented; first eight, remaining staff, then wrap; ten seconds per page. |
| Other boards unchanged | Four-card presentations retained; local regression checks passed. |
| Shared username/password account with full Dashboard access | CREATED after explicit approval and deployed in `830b76c`. Username `irbis-tv`; no email, phone or 2FA requirement. Full access retained, including budgets and goals. |
| Reply to Vadim, copying Tim | DRAFT ONLY. User cancelled sending before any message was sent. A private local draft contains the actual credentials and the experimental eight-technician layout update. |
| Google Workspace account/recovery policy | Prepared with official Google references and a blank inventory schema. |
| Actual Workspace account, role and recovery changes | NOT PERFORMED. No verified Admin Directory access or target recovery contacts were available. |

## HVAC Install

- Desktop/TV: four columns by two rows. Each card shows the full name, portrait or initials, rank, revenue, jobs completed, recalls, efficiency and average installation value.
- The remaining technicians appear on the next page. A partial last page keeps the same card dimensions; there is no random reshuffling.
- Previous/Next controls support immediate manual navigation and preserve date/TV filters.
- On tablets/phones, the layout changes to two/one columns with scrolling and manual page controls. Automatic advancement is paused below 1280 CSS pixels so the page does not move while someone reads it.
- The ten-second rotation timer no longer restarts just because a server refresh produces new navigation objects with the same routes.
- HVAC Service, Plumbing Install, Electrical Install and other boards do not receive the new eight-card presentation.
- No metric calculations, goal values, budgets, campaign settings or ServiceTitan records were changed.

## Verification

An isolated test copy used synthetic installer names/metrics and a local fixture API. Production was accessed separately, read-only, using a temporary session for the existing verified IT account. No customer communications were sent.

| Check | Result |
| --- | --- |
| Unit tests across repository | 144 passed |
| Test, typecheck and lint tasks | 27/27 package tasks passed |
| Production builds | 9/9 packages passed |
| Visual/rotation matrix | 27/27 scenarios passed on the final optimized-build run |
| Additional browser edge cases | 6/6 passed on both development and optimized builds |
| Viewports | 1920x1080, 3840x2160, 2560x1440, 1366x768, 1280x720, 1536x864, 1024x768, 768x1024, 390x844, 320x740 |
| Synthetic populations | 1 through 9; 13, 16 and 17; partial second and third pages |
| Image handling | Existing portrait URLs, missing portraits and failed image requests |
| Edge cases | Third-page final person, next/previous wrap, out-of-range page, mobile pause, empty state |

The checks inspect text overflow, card bounds, card overlap, horizontal overflow, desktop vertical fit, image loading, page order and real timer navigation. Representative screenshots were also inspected visually. This is a finite tested matrix, not a claim of perfection on every television or 1,000 independent tests.

One earlier optimized-build run emitted a React hydration error (#418). The subsequent full run did not reproduce it and completed with zero browser page errors. Its root cause was not established; live checks must also watch for recurrence. Existing build warnings about Browserslist data and Next.js ESLint plugin detection were not changed by this task.

The isolated server also logged Clerk session-refresh redirect warnings during the installer QA. Final browser scenarios and the live signed-in/anonymous checks passed; these warnings are not presented as an issue resolved by the installer-only release. The subsequent shared-account release is recorded below.

The first full-repository test attempts exposed isolated-environment prerequisites, not application changes: Turbo's default environment filtering omitted fixture variables, and Prisma's generated client was absent. The final run used synthetic environment passthrough and a locally generated Prisma client. No database migration or production connection was used.

## Shared Account: Completed Follow-Up

The intended account is `irbis-tv`, with the same full Dashboard access as organizational Google users, including budgets and goals. It must not require a mailbox or Google second-factor prompt. Existing Google sign-in must remain available.

After the user's exact approval, account `irbis-tv` was created in the existing Clerk Development instance. It has a strong generated password and no email address, phone number or second factor. Username sign-in is enabled; Google sign-in remains enabled. Email remains required for normal self-service registration. The temporary required-email configuration change needed for administrator provisioning was immediately restored.

The server exception is bound to the exact authenticated Clerk user ID in `apps/web/lib/dashboard-identity.ts`, not a username, request header or editable metadata. Both page middleware and API proxy use the same rule. Other users still require the existing corporate-email policy. There is no new read-only restriction or role system. Anyone holding this shared password has full account access; activity is attributable to the shared account rather than an individual employee.

Authentication release: `830b76c`. Railway web deployment succeeded; API and worker were skipped. No production budgets, goals or database records were changed to test access.

Verification:

- 165 unit tests passed across the repository, including 21 new identity/proxy tests; 27/27 test, typecheck and lint tasks passed. Unchanged package tasks reused their matching Turbo cache.
- 9/9 production-build tasks passed.
- Actual username/password sign-in succeeded in two fresh browser contexts without email or OTP. Both sessions remained usable concurrently after deployment.
- Final production run: 19/19 checks passed, zero browser runtime errors, completed at 2026-09-09 15:06 UTC.
- Full shared-account access to company, service, installation, advisor and campaign pages; enabled Plan & Capacity inputs; planning-status API HTTP 200.
- Budget/goal write authorization and unchanged upstream credentials were verified with mocked upstream requests, not real production writes.
- Anonymous boards redirect to sign-in; anonymous API requests do not return protected data. The Google sign-in button remains available. A new human Google consent flow was not completed during this follow-up.
- Live Install screenshots checked at 1920x1080, 3840x2160, 1280x720 and 390x844; eight cards, no detected overlaps, text overflow or broken portraits. Timed pagination remains 8 -> 3 -> 8.
- An initial QA request used GET on the existing POST-only web goals route and received HTTP 405. The harness was corrected to use the supported read-only planning-status endpoint; no unrelated route change was made.

The private credential file and ready-to-send reply are under ignored `local-data/access/`, with owner-only file permissions. Neither is committed. The user explicitly cancelled email sending; no SMTP message was sent. The configured mailbox is `marketing@irbishvac.com`, which did not contain Vadim's original thread; no original-message ID was fabricated.

Administration: reset this account's password through Clerk if needed and revoke its sessions when retiring a TV or following password exposure. Since it has no mailbox, email self-service recovery is unavailable. Deleting/recreating the account requires updating the exact server-bound ID through a reviewed change. Keep organizational Google sign-in enabled. The application still uses the previously approved Clerk Development setup; this release does not convert it to a custom-domain production instance.

## Google Workspace

Delivered:

- [Account and recovery policy](google-workspace-account-access-policy.md)
- [Blank inventory schema](google-workspace-account-inventory-template.csv)

The policy distinguishes directory contact information, actual recovery options, organization administrator contacts, login challenges and 2-Step Verification. It specifies primary/backup owners, scoped administrator responsibilities, incident recovery, onboarding/offboarding and staged acceptance tests.

Not verified: live account count, current support-account privileges, recovery coverage, manager role assignments or departmental organizational units. The meeting's approximately 150 accounts are not presented as an audited count. No secondary email/phone, administrator role, password, security setting or Google user was changed.

Execution requires authorized Google Admin access plus actual target accounts and approved recovery owners. A configured Sheets reader does not establish Workspace administrator access. No bulk changes were guessed.

## Deployment and Worktree Safety

- Main implementation: `f75b8222b8f0be44f2847d23bb530d5f6058c9e0`.
- Final source commit, initials contrast: `2b0cc2803109ea003e5b857d450fa86a5a6bf4a9`.
- Previous deployed source: `3ce4e3b295ad09416edfa4a91e745d8b679522c9`.
- Work was committed directly on `main`; no feature PR was opened.
- The main implementation commit contains ten scoped files; the follow-up changes only seven lines in the installer stylesheet. The source matched the isolated tested copy byte-for-byte.
- Existing dirty authentication, reporting and integration changes were not staged, reverted or deployed. The later auth release staged only the isolated shared-account hunks in middleware/proxy and three new identity/test files.
- The installer releases changed no production environment variables, Clerk settings, Workspace settings, database records or budgets. The approved auth follow-up changed only the documented Clerk account/sign-in configuration and deployed web code.
- Railway automatically skipped API/worker deployment because their watched paths were unchanged.
- Temporary local servers on ports 3049/3051 were stopped. The two recorded QA-only Clerk sessions were revoked successfully (HTTP 200 each), and generated local credential/session files were removed. Existing human sessions were not revoked.
- Rollback, if required: revert `2b0cc28` and then `f75b822` in new commits and redeploy the web service; no schema rollback is needed. Do not reset the dirty worktree.

## Production Evidence

Installer-specific deployed source: `2b0cc28`; subsequent authentication source: `830b76c`. Railway reports successful web deployments; API and worker remain unchanged.

The final read-only live run passed **14/14 checks**, with **zero browser page errors**:

- Five live Install viewport checks: Full HD, 4K, 1280x720, tablet and phone. Eight cards, valid images/initials contrast, no detected text overflow, horizontal overflow or desktop vertical clipping.
- Current MTD population: eleven installers. Actual timed rotation: first eight, remaining three, then back to the first eight.
- HTTP 200 for HVAC Service, Plumbing Install, Electrical Install, Advisors, Campaigns and Plan/Capacity (`/manual`). Existing card presentations retained. The date range's actual populations were four service cards, three plumbing installers, one electrical installer and three advisors.
- Anonymous Install visitors redirect to sign-in and do not see cards. The anonymous goals API request returns HTTP 307 rather than protected data.

The screenshot review found low contrast in the existing initials fallback and led to the seven-line installer-only correction in `2b0cc28`. The final live screenshots confirm that correction.

Open the deployed board: [HVAC Install](https://irbisweb-production.up.railway.app/installers?preset=mtd&tv=1&boards=installers&rotate=1).

Local evidence files, intentionally not published with employee images to the repository:

- [Full HD TV screenshot](../reports/it-meeting-2026-09-09/production-install-1920x1080.png)
- [4K TV screenshot](../reports/it-meeting-2026-09-09/production-install-3840x2160.png)
- [Second page, remaining three staff](../reports/it-meeting-2026-09-09/production-install-page-2.png)
- [Phone screenshot](../reports/it-meeting-2026-09-09/production-install-390x844.png)
- [Live check results and UTC timestamp](../reports/it-meeting-2026-09-09/production-results.json)
- [Synthetic visual matrix](../reports/it-meeting-2026-09-09/visual-results.json)
- [Additional edge-case results](../reports/it-meeting-2026-09-09/edge-results.json)

## Next Actions

1. Tim/Vadim can review the deployed Install screen on the actual office TV. Physical viewing distance and the TV's browser scaling cannot be validated remotely through screenshots alone.
2. The user can send the prepared private reply to Vadim and Tim. Shared-account creation and production verification are complete; no additional approval is pending for that account.
3. Obtain authorized Google Admin access and approved recovery owners, then execute the documented staged Workspace inventory and remediation. The policy alone is not a completed tenant change.

No login credentials or completion email were sent to Tim or Vadim, following the user's final instruction to prepare a draft only. Actual Google Workspace administration remains outstanding; this report does not mark all meeting actions complete.
