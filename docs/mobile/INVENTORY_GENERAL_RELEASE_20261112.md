# Inventory Beta — all existing project members, 12 November 2026

The owner explicitly requested Inventory Beta live for everyone using RailCommand,
subject to their existing roles. This supersedes the limited-pilot audience and
first-pilot-before-expansion condition in INVENTORY_LIMITED_RELEASE_20261111.md.
Physical iPhone acceptance remains recorded as pending, not retrospectively passed.

## Minimal change and data protection

Restore inventory_private.role(uuid) to its original explicit project-membership
predicate. Existing project/profile rows must exist; invited collaborators may
belong to another organization. Remove only the inventory_beta_participants
condition. Keep the pilot table and every existing enrollment row for history.
No membership, role, financial override, assignment, stock, request, cost, audit
history or existing password is created, repaired, reassigned or removed.

The compatible inventory_beta_access RPC now means current project membership.
All Inventory RPCs and operational RLS use the same predicate. HTTP errors say
project access is required instead of asking users to join a pilot. Existing
manager/admin management, field cost restrictions, can_edit enforcement, distinct
ordered approvers, 5% defaults, annual contract >$50,000 Supply Chain approval and
split-purchase flags remain unchanged. New project members inherit their normal
role rules without a separate pilot enrollment. No automatic import of old costs
or stock; a manager/admin still sets up catalogue, stock and named approvers.

## Web/mobile impact and offline classification

- Web: shared Inventory HTTP membership boundary and error wording.
- Native: same versioned Inventory endpoint and shared online workspace; no bundled
  UI change and no new native build. Retain older Inventory payload adapters and
  all existing mobile authentication/workspace/API protections.
- Shared domain/API: same RPC names, response shapes, UUIDs, operation IDs,
  idempotency receipts and version/conflict checks. One function replacement only.
- Update notice: advertise existing approved build 610011 generally only after
  confirming availability in both existing TestFlight groups. Existing Field Beta
  has five testers; Private Beta has one. No tester is added/removed, no public
  signup link, no App Store submission. Existing enrollment must be accepted once.
- Offline classification: stock is offline read-only; requests are offline drafts;
  receiving/imports/costs/approvals are online-only. Access is revalidated online.
  No draft, outbox, cache schema, sign-out cleanup or queued identity is changed.
  Sign-out still follows existing preservation/discard rules. No private data enters
  the public service-worker cache or global localStorage.
- Android: existing API contract preserved; no new Android store release or iPhone
  TestFlight routing. Physical Android distribution remains outside this change.

## Verification and rollout

Before live change: real disposable PostgreSQL migration tests confirm unchanged
rows and table ACL/RLS, unenrolled/previously disabled members allowed, nonmember
and foreign-project denial, finance/receiving/catalogue rights, old receipt replay,
contract thresholds, split flags, cross-organization collaborators and CSV dedup.
47 Inventory tests, release and mobile-boundary tests, build/TypeScript and explicit
grant checks must pass. Save the exact current live function for rollback and
fingerprints for application/Auth/Storage data and permissions. Use the existing
free project and Mac; no new paid resource or cloud-native build.

Stage compatible web/backend source on the existing Vercel project; preserve the
full released mobile API. Apply only the reviewed migration transaction, compare
data/access fingerprints, and promote the tested production build. Read-only live
checks must verify current members allowed regardless of enrollment, outsider and
foreign project denied, unchanged role/finance projection, and no public reads.
Use the owner's already open Inventory page for a read-only visual check.

Rollback: restore the saved previous role function if feature access must close;
this leaves every saved record and device draft intact. Roll web back to
629d619f03db61ee569619a552574c60a4bbdf55 / dpl_EWSRRTMojHCE3DWrc2gBet4tFZes.
Existing installed TestFlight clients and older supported API payloads still work.
Do not expire builds or reset apps. Record actual deployment/check outcomes below.

## Outcomes

Released source `e8bedeebeb4afd106b7fbd73c9858b6f40946506` to production deployment
`dpl_AMc95Btz3AuhioCQu8Mb27iE2KfV`; railcommand.io, www.railcommand.io and
both standard project aliases verified. Database migration 20261112210321 applied
as a guarded transaction: all 104 existing public/Auth/Storage table fingerprints,
table/column grants, RLS/policies, other function definitions/grants, database
roles/memberships and defaults matched inside the change. All 27 prior migration
entries and 11 pilot enrollment pairs retained; migration count is now 28.

Read-only live verification passed for all 35 existing project memberships,
including previously unenrolled members, with field finance exclusion and
anonymous/nonmember denial. The owner's previously blocked project opened the
live stock screen with no pilot message; no stock or other test records were
created. Staged and live smoke checks: login 200, unauthenticated Inventory 307,
unauthenticated native bootstrap/release 401. No error log entries returned in
the release observation window.

47 Inventory tests, 19 release/mobile-boundary tests, disposable real PostgreSQL
catalogue/availability tests, static and real grant checks, local/Vercel builds and
TypeScript passed. Native bundled code and released mobile route handlers remain
unchanged. Independent role hash outside the transaction changes when Supabase
CLI refreshes its own short-lived cli_login_postgres expiry; all non-role access
hashes match, and the transaction guard verified roles unchanged by this migration.

Build 610011 is Testing in both existing Field Beta (five testers) and Private
Beta (one tester). General update discovery advertises this available build.
First real-iPhone workflow/update-handoff acceptance remains pending and must not
be reported as passed. The owner explicitly authorized the wider audience today.
No new app user/project membership, public TestFlight link, App Store submission,
paid resource, cloud native build, main merge or RFQ deployment occurred. Original
dirty checkout matches its baseline. Local RFQ work remains untracked and intact
in the previous inventory-beta-release worktree.

The faithful restored backup from 11 November remains private and unchanged. This
small release saved the exact previous function separately and verified all live
rows stayed unchanged; it did not reset passwords or create another backup login.
See the adjacent JSON for machine-readable release IDs and outcomes.
