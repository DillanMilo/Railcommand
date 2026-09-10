# Local source recovery — September 9, 2026

Baseline commit: 415c8fdd3660f1b5c25fe59bf9ee43c102ff2345.

Reconstructed separately using git archive from the existing parent repository.
All 732 regular tracked files were verified against their Git blob hashes; zero
missing or mismatched files. Four tracked gitlinks are not application files and
were not recursively restored. No Git metadata was initialized in this archive.

The incomplete original directory remains untouched. Thirteen surviving tracked
files differ from this baseline, including package.json, middleware, mobile shell,
reviewer verification script/tests, environment example, and readiness documents.
They have not yet been overlaid. Newer untracked source, tests, and migrations also
need reconciliation; this baseline alone is NOT the current release candidate.

Next: inspect the thirteen differences and newer files, preserve approved changes
in this separate reconstruction, then run local tests/type/build checks. Do not
copy secrets, customer backups, generated build output, or installed dependencies
into source control. Do not deploy this baseline.

Offline assessment: local source recovery requires no network and does not alter
device caches, drafts, or queues. Production and backup files are untouched.

## Safeguard recovery and verification

Restored src/middleware.ts and the two surviving pilot tests from the incomplete
copy. Recovered src/lib/mobile-api/pilot-gate.ts from the corresponding named
sourcesContent entry in its existing middleware build source map. This is source
recovery, not evidence that the build was deployed or that all later work survived.

Installed lockfile dependencies with npm ci --ignore-scripts --no-audit --no-fund
in this separate folder. Initial restricted-network attempt failed DNS and was
stopped; network-enabled attempt exited 0 (1544 packages). No install lifecycle
scripts were run. No production credentials or environment files were copied.

Actual local checks after this recovery:
- Pilot gate and middleware: 10 passing.
- Complete recovered mobile API suite: 257 passing (includes those 10).
- TypeScript: tsc --noEmit exited 0.

These checks cover only the recovered baseline plus the pilot files above. Other
surviving modifications, later bridge migrations, and release artifacts still
need reconciliation. Do not claim the previous 263-test suite or a complete
release candidate from these results. No build, deploy, or live acceptance was
performed in this verification pass.

## Mobile header restored

Restored the surviving web-shell.tsx and visual-foundation.test.ts changes:
the visible ONLINE/OFFLINE header badge and accessible connectivity announcement,
and a truthful beta search message instead of opening the unsupported web route.
This uses existing connectivity state and introduces no request/subscription or
offline queue changes. React review found no new effect or fetching lifecycle.

Actual checks: mobile workspace suite 210 passing; mobile TypeScript check
`tsc --noEmit -p apps/mobile/tsconfig.json` exited 2, reporting URL type conflicts
between native and Node declarations in test files. This remains unresolved;
the earlier root TypeScript pass does not prove mobile-specific typing. Tests include source
assertions, not a fresh rendered-device acceptance run.

Follow-up: resolved the test-only URL declaration collision by explicitly
importing Node's URL in the eleven Node filesystem tests. No casts, test
exclusions, compiler relaxations, or runtime application changes were used.
Re-ran mobile tsc --noEmit: exit 0; mobile workspace tests: 210 passing.

## Administrator compatibility candidate

User approved preserving existing administrator access without adding privileges.
Added `supabase/recovery/admin-daily-log-candidate.sql`, matching the existing
daily-log RPC administrator exception while retaining can_edit and allowed-role
checks for ordinary members. Security invoker and empty search_path retained.
No membership helper, Storage policy, grants, or hosted schema changed.

`local-admin-guard-smoke.sql` passed eight assertions in network-isolated local
Postgres under a non-owner role with synthetic profile/membership RLS: administrator,
editor, null project, revoked editor, viewer, foreign project, signed-out caller,
and demoted administrator. Exit 0, transaction rolled back, container stopped.
Initial fixture-transfer and dollar-quoting runner errors were corrected before
the passing run. This is helper-level RLS evidence, not full application acceptance.

Offline assessment: online-only server authorization during synchronization;
no device drafts, outbox, cache, or retry behavior changed. Full attachment/Storage
and reconstructed bridge integration tests remain required before staging changes.
Candidate is deliberately outside migrations and must not be deployed as-is.

## Storage metadata verification

Added local-storage-metadata-smoke.sql and a credential-free SQL renderer that
uses the captured assert_stored_object definition without modifying it. Actual
isolated Postgres run exited 0: valid metadata accepted; wrong size, MIME type,
RLS-hidden object, absent object, malformed size metadata, wrong bucket, and zero
size rejected. Fixture used non-owner role and SELECT RLS; transaction rolled
back and container stopped. No hosted data read or written during this test.

Remaining integration issue: can_write_object still requires explicit editable
membership before its daily-log branch, even when the daily-log RPC permits an
administrator. The candidate helper alone does not fix administrator uploads.
Do not broaden non-daily-log Storage access to solve this. Full policy/baseline
comparison and attachment-trigger integration are still required.
Offline behavior unchanged: these validations occur online during finalization;
no local queue or cache modifications.

## Photo upload compatibility candidate

Baseline 20260824185152 explicitly permits administrators' own daily-log photos
in project-photos and thermal-photos. Added a separate can_upload_object candidate:
do NOT modify shared can_write_object, because it also guards DELETE. Other bucket
and entity behavior delegates to the existing helper. Synthetic policy test passed
with the real baseline permissive policies and candidate INSERT guard: own two
photo buckets allowed, other owner/document/RFI/traversal denied, and existing
shared delete guard still rejects the no-membership administrator. Exit 0, rollback.

This test intentionally does not claim full staging-policy acceptance: captured
rc_project_object_read_guard still requires explicit membership, and UPDATE has
Storage-operation checks. Those must be reconstructed and tested together before
any hosted application. No production or staging changes made; container stopped.

Follow-up combined policy run: added a separate can_read_object candidate and
tested INSERT/SELECT/UPDATE/DELETE restrictions together with baseline permissive
photo policies. Own standard/thermal readback and upload_update passed; object.move,
object.copy, s3.object.copy, and s3.upload.part_copy exposed zero rows and updated
zero rows; unspecified update context updated zero rows; DELETE remained blocked
even with an intentionally broad fixture-only permissive delete policy. Both
synthetic objects remained present before rollback. Actual psql exit 0.

Storage operation context was mocked with a transaction-local setting; this does
not establish real Storage API acceptance. Reference-table fixture SELECT grants
also do not reproduce full production profile/log RLS. Attachment trigger and
full bridge reconstruction remain incomplete. No hosted changes; local container
stopped. Offline draft/outbox behavior unchanged.

Attachment-trigger follow-up: extended that same local policy fixture with the
captured check_daily_log_attachment and assert_stored_object definitions. Valid
own-log attachment finalization and notes-only update passed. Changing parent,
project, stored size, uploader, and inserting mismatched-size metadata all failed
with expected 22023 errors; original attachment remained intact and no rejected
insert survived. Actual psql exit 0, rollback, container stopped. Fixture does not
include full attachments-table RLS or the full synchronization RPC; neither is
claimed verified by this result. No hosted writes or device changes.

Full recovered RPC follow-up: fixture now executes captured sync_daily_log_create
and sync_daily_log_photo_attachment implementations together with candidate
Storage guards and the captured attachment integrity trigger. Valid creation,
one personnel/equipment/work-item child each, repeated log/photo delivery, and
conflicting log retry-key rejection passed. Counts confirm no duplicate log,
children, or attachment. Actual psql exit 0; rollback; container stopped.
This supersedes the earlier statement that RPCs were absent from the fixture,
but not the limitation that full production table RLS and real Storage HTTP
behavior are not reproduced. Still no hosted or device changes.

Captured-table-policy follow-up: read-only staging catalog query captured current
policies for profiles, memberships, daily logs, three child tables, and attachments.
The --staging-table-rls renderer enables those table policies locally (only SELECT
policies needed for reference tables; membership-invitation writes excluded).
Existing staging access helper semantics are reproduced, including their existing
security-definer attribute, for the fixture only. No production helper introduced.
Recovered log/photo RPC, child counts, replay and collision tests passed: psql 0,
rollback, container stopped. Initial renderer quoting error fixed before rerun.

Important: staging attachments has no permissive UPDATE policy. Notes-edit success
in the prior trigger-only fixture was not end-to-end app functionality. That block
is excluded from the captured-RLS mode, rather than broadening staging permissions.
Real Storage HTTP acceptance, schema reconstruction completeness and staging
candidate application are still outstanding. All hosted activity this pass read-only.

## Exact staging package and authorization checkpoint

CLI-generated migration: 20260909204413_staging_admin_photo_compatibility.sql.
Requires explicit staging acknowledgement and exact pre-change function/policy
fingerprints. New upload/read helpers deny PUBLIC/anon execution; original
Storage DELETE guard and membership helper unchanged. No record DML.
Exact migration tested with --migration renderer against captured table policies:
psql exit 0, RPC create/replay/collision checks pass, rollback, container stopped.
Hosted staging schema rehearsal also passed inside BEGIN/ROLLBACK, including
anonymous-execute denial. No persistent migration from the rehearsal.

Persistent staging apply was rejected by the safety reviewer: explicit approval
for this exact hosted migration is required. Do not bypass with execute_sql.
Await user approval to apply this package ONLY to rxuvchdqbzvovqijvfhx.

Pre-apply security advisor baseline: existing INFO for three RLS tables without
policies; WARN for two authenticated deletion SECURITY DEFINER RPCs and disabled
leaked-password protection. Not introduced or fixed by this narrow migration.
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
No full-build/launch approval implied by package checks.

## Build checks while awaiting staging authorization

Root tsc --noEmit exited 0. ESLint on both SQL renderers and both bridge-artifact
verifier files exited 0. Artifact verifier tests: 2/2 passing.
No runtime .env files found in recovery root before build.
Default npm run build failed fetching three Google Fonts inside sandbox.
Network-enabled retry exited 1 with Turbopack subprocess port-binding EPERM.
No configuration changed to hide these failures. Supported --webpack diagnostic
build was started separately; its result must be recorded before claiming success.

Webpack diagnostic result: `npm run build -- --webpack` exited 0; compiled,
TypeScript completed, all 34 static pages generated, build traces completed.
Warnings remain: middleware convention deprecated; dependency Edge Runtime
process.cwd/process.version warnings; Webpack cache serialization warnings.
Default Turbopack command is still not verified in this restricted environment.
No application build settings changed; no deploy performed.

## Approved staging application — 2026-09-09

User explicitly approved applying staging_admin_photo_compatibility to Mobile
Staging only. Applied successfully via Supabase migration tool to
rxuvchdqbzvovqijvfhx. Embedded definition/policy drift checks passed.
Post-apply read-only checks: anonymous execute denied on both new helpers;
authenticated execute enabled; all three changed/new helpers remain invoker;
existing shared write helper, membership helper and Storage DELETE policy hashes
unchanged. Security advisors show the same baseline findings, no new findings.
No application/customer record DML, production changes, or publication performed.
This supersedes the prior pending-approval checkpoint for this migration only.
Online-only authorization change; offline drafts, outbox and device cache untouched.
Real staging Storage HTTP/device acceptance and wider release gates remain pending.

HTTP runner readiness: old temporary .vercel/.env.preview.local and project.json
are missing. No sign-in or upload attempted. Reconciled the only surviving runner
and test difference (dated Preview nxpo544zw) into recovered source; 14 harness
unit tests passed. That target still requires live deployment verification and
staging-only configuration restoration before execution. Reviewer account is a
manager, so its test alone will not prove administrator-without-membership HTTP
behavior. No passwords reset, roles changed, or credentials searched for.

## Preview access recovered — 2026-09-09

Connected Vercel tool denied team access (403), but existing local Vercel CLI
authentication successfully inspected the exact Preview read-only. Deployment
dpl_BjSMKrY3dRCPfNH4viJz1uZbL5Ut, railcommand-mobile-staging, target preview,
status Ready, created 2026-09-02. No reconnect is required for CLI access.
Sandbox attempt failed network/cache permissions; authorized network-enabled
inspect exited 0. No deploy, credential changes, or application requests made.
Remaining: restore minimal local staging test configuration and perform signed-in
HTTP acceptance. Reviewer password must be entered privately by the user.

## September 10 — durable candidate and exact bridge recovery

Current worktree: /Users/dillanmilosevich/Desktop/IDE/Railcommand/.mobile-recovery/candidate
Branch: codex/mobile-beta-20260910, created from retained commit 415c8fdd3660f1b5c25fe59bf9ee43c102ff2345.
The unrelated Desktop checkout and prior incomplete/reconstructed copies remain intact.

Recovered all six bridge SQL artifacts from the original task's saved patch
history without executing historical commands. Each recovered file matches the
SHA-256 already recorded by verify-bridge-artifacts.mjs and the September 5
rehearsal. The artifact verifier now passes 6/6. No SQL was reapplied remotely.
Preserved the eight historical staging/recovery reports from surviving files and
saved patch history. Their historical results are not fresh hosted acceptance.
Backup bodies and credentials remain outside this source tree.

Fresh lockfile installation succeeded from the local npm cache with lifecycle
scripts disabled. In this candidate, all 516 mobile tests and root/mobile
TypeScript checks pass. Both iOS and Android beta-profile Hermes exports pass
using only explicit public staging configuration, with dotenv/network/telemetry
disabled. These exports are compilation evidence, not installable beta builds.

The direct staging hostname returned application JSON 401 with no-store without
credentials or a Vercel bypass token. This proves public API reachability, not
signed-in operation or that the hostname serves current candidate code.
Expo's live build inventory reports a FINISHED iOS STORE build, beta profile,
version 1.0.0 build 300002, build ID 839837c8-4439-482c-9bde-dcd7706bfbf6,
created August 30 from reported commit 7758aeb4d3bcd1e2026e9ea0a68e2e4f923b60ee.
This corrects the inference that signing has never been exercised; it does not
prove TestFlight submission or a current installed release candidate.

Offline classifications remain cached read-only data and durable draft/queue
for supported daily logs/photos. Recovery/build work changes no runtime behavior,
private storage, device records, or user accounts. Signed-in acceptance requires
the existing reviewer password entered privately; no password reset is planned.
