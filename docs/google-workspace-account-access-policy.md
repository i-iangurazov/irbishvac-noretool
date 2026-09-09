# IRBIS Google Workspace Account and Recovery Policy

Prepared: September 9, 2026. Owner: IT. Business owners: HR and department managers.

## Status and scope

This is an implementation-ready operating policy prepared from the September 9 IT meeting, not evidence of completed Google Admin changes. No Google Workspace user, role, recovery contact, password, or security policy was changed during this work.

The repository has no Admin SDK Directory integration or configured directory scopes in its integration code. The available connectors do not include Google Admin Directory. Existing access to Clerk, GitHub, and Google Sheets is not evidence of Workspace administrator authority. Current Workspace roles and recovery settings remain unverified.

The meeting mentioned approximately 150 accounts; this is not an audited count. Tim appeared to remove administrator access from the shared support account during the meeting. Verify the resulting state before proposing another change.

This policy does not introduce Dashboard roles or restrict the requested shared Dashboard account. Google Workspace permissions and Dashboard authentication are separate systems.

## Ownership and escalation

| Responsibility | Primary | Backup | Evidence required |
| --- | --- | --- | --- |
| New employee account | HR | IT | Manager approval and start date |
| Department/account ownership | Department manager | HR | Current roster and accountable owner |
| Password/recovery support | IT | Authorized HR administrator | Identity verification and incident ticket |
| Department recovery | Explicitly delegated manager | IT | Approved scope, tested non-admin recovery |
| Privileged-account recovery | Named super administrator | Separate authorized super administrator | Protected emergency-access procedure |
| Shared mailbox/service account | Named business owner | Named backup | No dependence on one unavailable employee |

Record actual names and contact methods in a restricted company register. Do not invent recovery addresses or reuse Tim's personal contact as the default for every account. A department manager is not automatically an administrator.

## Initial inventory

Start with support, IT, HR, accounting, and department managers; then review the remaining accounts.

Collect account identifier, account type, business owner, backup owner, department, manager, organizational unit, account status, assigned admin roles and scope, recovery-email presence, recovery-phone presence, 2-Step Verification enrollment, last review date, and required remediation.

The companion CSV is a blank schema, not an inventory. Keep populated copies in a restricted administrative location, not Git. Store actual recovery contacts in the approved password manager or restricted register; general reports should contain only presence/verification flags.

Classify each account as individual employee, shared mailbox, service/integration, privileged administrator, suspended, or pending closure. Do not delete suspended accounts merely because they appear unused.

## Account creation

1. Obtain a manager-approved request with owner, department, required services, and start date.
2. Create an ordinary account by default; add privileges only for an approved responsibility.
3. Assign the correct organizational unit and groups, without moving existing users blindly: OU changes can affect other policies.
4. Configure and test actual account recovery options. A contact/secondary email in the directory profile is not a substitute for verifying recovery settings.
5. Enroll the user in the applicable 2-Step Verification policy and securely deliver initial access.
6. Record ownership and backup; obtain confirmation that access and recovery work.

Google documents user creation and optional secondary contact fields separately from password-recovery configuration: [user creation](https://support.google.com/a/answer/33310), [password recovery](https://support.google.com/a/answer/33382).

## Recovery controls

Personal employee accounts need recovery methods the user can actually access when their company email is unavailable. Do not assume a Dialpad number can receive the necessary verification messages; test the selected method.

Shared accounts need company-controlled recovery ownership and a backup. Evaluate delegation or a collaborative inbox where it fits the workflow, rather than passing one mailbox password between all employees. Do not change the mailbox architecture without checking existing integrations.

Organization-level administrator/contact information, directory-profile contact details, and account recovery options must be reviewed separately.

Enabling self-service recovery is an administrator setting and requires usable recovery information. Google permits scoping supported recovery settings by organizational unit or configuration group. [Official guidance](https://support.google.com/a/answer/33382).

## Privileges

Remove unjustified super-administrator access only after verifying current assignments, dependencies, and alternate administrative access. Do not remove the last working recovery path or last usable administrator.

HR and selected managers should receive only the privileges required for approved account-support responsibilities. Prefer a narrowly scoped password-reset/help-desk role over broad user management where sufficient. Restrict supported roles to the responsible OU; not every privilege supports OU scoping. Test that an assigned manager cannot manage another department or privileged administrators. [Role assignment](https://support.google.com/a/answer/9807615), [privilege definitions](https://support.google.com/a/answer/1219251).

No bulk role changes or recovery-contact replacements should occur until the accountable owners and exact target accounts are verified.

## Incident procedures

### Forgotten password

Verify the requester's identity using an established channel. An authorized administrator resets the password and securely delivers the reset instructions. Record who acted, why, when, and which account was affected, but not the password. Follow Google's sign-in-cookie/session guidance when unauthorized access is suspected. [Password reset](https://support.google.com/a/answer/33319).

### Suspicious-login challenge

Distinguish a suspicious-login challenge from configured 2-Step Verification. After confirming identity and the legitimate login attempt, an authorized administrator can temporarily disable the login challenge for ten minutes. This is a targeted recovery procedure, not a policy to turn off organizational 2FA. Confirm successful sign-in and record the action. [Google troubleshooting](https://support.google.com/a/answer/10710447).

### Missing second factor

Use the approved backup/recovery procedure with authorized administrator support. Do not permanently relax organization-wide MFA to resolve one account. Confirm the replacement factor and remove the lost factor when appropriate.

### Suspected compromise

Escalate immediately to IT and an authorized administrator. Preserve relevant audit evidence, contain the affected account, reset credentials and sessions as appropriate, and examine recovery changes, email forwarding/delegation, connected apps, and privileges. Recovery procedures differ from ordinary password loss; do not assume a password reset alone removes all persistence.

### Primary support person unavailable

Use the named backup without requiring Tim's phone. If neither authorized support person is available, use the documented emergency administrator procedure. Never collect a password or OTP in a public group or general incident report.

## Transfers and offboarding

Require HR/manager confirmation, identify data/integration dependencies, preserve necessary business records, revoke access and administrative assignments, review recovery methods, and rotate shared credentials known to the departing employee. Data transfer and deletion require an owner and retention decision.

## Rollout and acceptance

1. Export/read the current user and role inventory with authorized administrative access.
2. Verify support's current administrator status and the organization recovery contacts.
3. Populate ownership and backup responsibilities.
4. Pilot recovery on a dedicated test employee account, not on a live support mailbox.
5. Test manager scope: own department allowed; other departments and admin accounts denied.
6. Test primary-person-unavailable recovery with the designated backup.
7. Apply reviewed changes in small batches with a before/after record.
8. Confirm login and integration health after each batch.
9. Review ownership quarterly and at every role change, departure, or access incident.

Acceptance evidence: account totals reconciled; no shared mailbox has unexplained admin rights; each critical account has a verified owner and backup; designated recovery staff pass the test; no business-critical integration is broken.

Rollback: retain the prior approved role/contact configuration in a restricted admin record. Restore only the affected setting if the change causes an unintended lockout, after confirming that restoration will not reintroduce suspected compromise. Never store old passwords.

## Sources and evidence limits

Official Google sources above were searched/accessed September 9, 2026. Some direct pages redirect to Google's Workspace knowledge portal; search-rendered official guidance was available. Publication dates were not established. This document separates provider capabilities from proposed IRBIS procedures and does not claim a completed tenant audit.
