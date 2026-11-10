# Inventory release preparation and safest repair — 10 November 2026

**Prepared locally; not live, merged, pushed, installed or uploaded to TestFlight.**
This report supersedes the earlier proposal to clear invalid assignees. The real
copy requires an assignee on every punch item; the attempted NULL correction failed
and its transaction rolled back. No original data or access was changed.

## Preserve history; correct ownership only with evidence

The possible setup origin of the missing project is recorded as owner-supplied
context. It is not proof of organization, ownership, original access or disposable
data. Keep its 21 history entries and all remaining child records in place. Do not
recreate a guessed project, move records, delete duplicates or disable constraints
to force a clean result. Historical integrity remains unresolved.

Prepared `scripts/release/reviewed-assignment-repair.local.sql` as a manual local
rehearsal template, outside automatic migrations. It requires all 24 reviewed
original rows plus a separate, nonempty owner-confirmed assignment map. Each target
must be an existing profile and current member of the item's existing project.
A missing project, changed row, missing approval reference or restored original
profile stops the transaction. Only the assignee and normal update timestamp can
change. Complete before/after rows go to an operator-only, append-only journal,
with no access for anonymous, authenticated or service application roles. A retry
must match the accepted result exactly. No actual replacement owner was supplied,
so no customer-row reassignment was performed, even in the saved copy.

Synthetic PostgreSQL tests verify successful explicit reassignment of twelve test
items, rollback after an error following the update, stale/newly valid input denial,
empty/unknown/missing-project target denial, repeated delivery, evidence mutation
denial, application-role denial, unchanged history and normal FK enforcement. The
fixture retains the real NOT NULL assignment requirement. The saved copy's empty
approval map was verified to stop before any journal/schema/data mutation.

A private review CSV with 24 items, original IDs, project-presence flags and blank
replacement/approval columns is saved outside Git. Twelve items have an existing
project; twelve need authoritative parent recovery first. No people, memberships
or roles have been invented. A guessed repair is not a prerequisite for adding new
Inventory tables: preserve these as explicit existing exceptions while deciding
whether a limited pilot may proceed. That is a recommendation for review, not
acceptance of clean integrity or authorization to deploy.

## Existing access review

Using only the saved copy, with no customer-account sign-in:

- The two anonymous-callable reporting predicates returned false across all sixteen
  projects with no user identity. Direct invocation of the reporting trigger failed.
- A random nonmember identity could read zero projects, history rows and punch
  items, returned no project IDs and obtained empty search results. Positive member,
  invited cross-organization, finance and Supply Chain behavior is covered by the
  separate synthetic PostgreSQL suites, not by impersonating customer accounts.
- Reviewed the fifteen authenticated privileged helper bodies and trigger-only
  entry points. Reporting helpers scope to the current user; identity-sensitive
  helpers check their supplied user against the caller. Search intersects requested
  projects with membership. Account deletion requires recent authentication and
  preserves its existing safeguards. Existing function definitions are retained.
- The inherited 37 authenticated TRUNCATE grants remain unchanged. No public
  function body contains TRUNCATE; this does not prove every possible attack path
  absent. No blanket revokes or unrelated Auth setting changes were made. Disabled
  leaked-password protection remains an inherited configuration finding. These
  findings need explicit release-review disposition; they are not silently fixed
  or erased from the record.

The fresh local restore initially differed in extension ownership because the
container's session preload hook created extensions under its administrator role.
This was a restore setup difference, not an Inventory migration effect. A fresh
restore session omitted that local preload hook during bootstrap, recreated the
extensions under their archived owners, then restored normal connections. No
original ACL was edited afterward to manufacture a comparison pass. The
[Supabase extension delegation notes](https://github.com/supabase/supautils#privileged-extensions)
explain why a local preload hook can affect extension creation. The base
comparison matches all 83 tables and original access/policies/functions/roles.

The final seven-file Inventory rehearsal on that faithful base passed: all 83
original tables and all original access, policies, functions, constraints, roles
and role memberships remain equivalent, with the feature additions permitted.
The machine-readable record retains the exact final SQL source hashes. No live data, existing
account, persistent Phase1 database or installed app was used for disposable writes.

## One narrow release permission correction

The saved project's broad sequence defaults would have granted direct application
access to the new Inventory request-number sequence. The unshipped initial
Inventory SQL now explicitly denies all direct sequence privileges to PUBLIC,
anonymous, authenticated and service application roles. Request numbers continue
to be assigned inside the existing owner-executed Inventory command. No pre-existing
sequence, table grant, role membership or default privilege is changed.

The database test reproduces the broad inherited defaults, checks denial of read,
usage and update on this new sequence for every application role, and runs the
normal request/approval/posting workflow. Existing offline operation identities and
server-assigned numbering remain unchanged. The persistent older local backend
was not upgraded or replayed; its history must not be rewritten to pick up this
unshipped source change.

## iPhone release build

Locally compiled production-profile archive: **1.0.0 (610009)**,
`io.railcommand.app`, using the current native source and public production client
configuration. Nothing was launched against production. The archive was scanned
for the existing server credential values; none was included. No paid/cloud build,
remote app-version change, invitation or installed-app replacement occurred.

Archive retained privately at:
`~/Library/Application Support/RailCommand/Phase1Local/private/release-prep-20261110/RailCommand-610009.xcarchive`.
The local build number has not been reserved or checked against Apple's current
remote build list. The Apple Distribution identity is installed, but no matching
RailCommand App Store provisioning profile is installed in the inspected standard
profile folders. The archive is therefore **unsigned, not an installable IPA or a
TestFlight-ready upload**. A local export attempt used `destination=export`,
automatic signing with the existing Apple account, and remote version/build management disabled. Apple refused
membership/profile access with **PLA Update available**: the account holder must
review and accept the updated Developer Program License Agreement. Export exited
70. No IPA was produced or uploaded. Signing/export, build-number confirmation and
physical acceptance remain pending. No unrelated app's profile was substituted.

## Release checks and remaining decisions

The web production build and root TypeScript pass. Native TypeScript and 278 native
tests pass; 379 backend/auth tests and 44 Inventory tests pass. Explicit grant tests,
real PostgreSQL Inventory/contract/profile/catalogue/finance suites and rendered
receiving checks pass. Current web/native rules-screen browser checks also pass:
policy edit/readback, split warning, PM then distinct Supply Chain approval, cross-platform refresh, field
finance omission and offline cost controls. Browser-native adapters and synthetic
transport are not physical-device acceptance or database-authority proof.
The asset check's missing helper was restored from the existing canonical native
source. Store assets/configuration now validate. No runtime UI change was made.

Before live activation:

1. Review the known legacy exceptions and inherited privileges explicitly. Confirm
   genuine replacement assignees separately; leave unknown history intact. Do not
   turn cleanup into a destructive prerequisite or silently claim it completed.
2. Have the account holder review Apple's updated Developer Program agreement,
   then obtain the matching distribution profile, confirm the build number,
   sign/export locally, and perform final supported iPhone checks with synthetic
   records in a designated safe environment. Do not overwrite the owner's app or
   queues. Independent release review remains unperformed by a separate reviewer.
3. Obtain explicit rollout authorization, refresh the backup/preflight as needed,
   then perform the reviewed backend/web rollout and signed mobile distribution.
   This task does not authorize any of those live actions.

Android source/type checks and the earlier bundle exports remain recorded; this
round does not claim a new signed Android build or physical Android acceptance.
Keep Android distribution out of this pilot until those checks are completed.
Stored attachment bytes and project secrets/settings are outside the database
archive's recovery scope; the rollout must not modify existing Storage objects.

## Web/mobile/offline impact

Web and native UI: unchanged. Shared API/domain and installed-client payloads:
unchanged. Database: one explicit privilege restriction on a new, unshipped sequence;
existing objects/access are preserved. The optional correction template is not an
application migration. Test adapters now follow the current navigation/components;
server, native build, receiving and permission checks remain distinct evidence.

Offline classification: **online-only administrative correction**, requiring
reviewed operator inputs on a disconnected local copy. No app drafts/outboxes,
client UUIDs, retry keys, photos or sign-out behavior change. Existing Inventory
supports read-only cached stock and durable request drafts; receiving, CSV imports,
costs and approvals remain online-only. No full offline-project-work claim is made.

See [investigation](INVENTORY_HISTORY_INVESTIGATION_20261110.md),
[backup result](INVENTORY_BACKUP_RESULT_20261110.md) and
[release checklist](INVENTORY_BETA_RELEASE_20261110.md).
