# September 9 IT Meeting: Delivery Report

Date: September 9, 2026. Repository: `irbishvac-noretool`. Branch: `main`.

## Status

| Requested outcome | Actual result |
| --- | --- |
| Eight HVAC Install technicians on one TV screen | Deployed in `f75b822`, with installer-initials contrast polished in `2b0cc28`. Both Railway web deployments succeeded. |
| Predictable page rotation | Implemented; first eight, remaining staff, then wrap; ten seconds per page. |
| Other boards unchanged | Four-card presentations retained; local regression checks passed. |
| Shared username/password account with full Dashboard access | NOT CREATED. The execution approval layer rejected the persistent Clerk configuration change. A specific approval request is pending. No read-only restriction was introduced. |
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

The isolated server also logged Clerk session-refresh redirect warnings during QA. Final browser scenarios and the live signed-in/anonymous checks passed; these warnings are not presented as an authentication issue resolved by this installer-only release. Shared-account authentication remains a separate unfinished task.

The first full-repository test attempts exposed isolated-environment prerequisites, not application changes: Turbo's default environment filtering omitted fixture variables, and Prisma's generated client was absent. The final run used synthetic environment passthrough and a locally generated Prisma client. No database migration or production connection was used.

## Shared Account: Exact Outstanding Boundary

The intended account is `irbis-tv`, with the same full Dashboard access as organizational Google users, including budgets and goals. It must not require a mailbox or Google second-factor prompt. Existing Google sign-in must remain available.

This account does not exist yet. No password was generated or sent. Attempts to enable username sign-in and broaden the app's account eligibility were rejected by the execution approval layer. The rejected changes were not deployed, and the partial local helper was removed without reverting pre-existing user changes.

The pending confirmation explicitly covers enabling username/password in the current Clerk Development instance and creating `irbis-tv` with full Dashboard access while preserving Google login. This is a persistent authentication change: anyone holding the shared password would have the account's full access, and activity would be attributable to the shared account rather than an individual employee.

After approval: bind the exception to this exact Clerk user, create the account securely, test username/password and existing Google paths, check full application access, and deliver the credential through an approved private channel. This report contains no credentials.

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
- Existing dirty authentication, reporting and integration files were not staged, reverted or deployed.
- No production environment variables, Clerk settings, Workspace settings, database records or budgets were changed.
- Railway automatically skipped API/worker deployment because their watched paths were unchanged.
- Temporary local servers on ports 3049/3051 were stopped. The two recorded QA-only Clerk sessions were revoked successfully (HTTP 200 each), and generated local credential/session files were removed. Existing human sessions were not revoked.
- Rollback, if required: revert `2b0cc28` and then `f75b822` in new commits and redeploy the web service; no schema rollback is needed. Do not reset the dirty worktree.

## Production Evidence

Final deployed source: `2b0cc28`. Railway reports a successful web deployment; API and worker remain unchanged.

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
2. Complete the pending execution approval for the full-access shared username/password account. No additional Dashboard roles or read-only restrictions are proposed.
3. Obtain authorized Google Admin access and approved recovery owners, then execute the documented staged Workspace inventory and remediation. The policy alone is not a completed tenant change.

No login credentials or completion email were sent to Tim or Vadim because the shared account is not yet created. This report does not mark all meeting actions complete.
