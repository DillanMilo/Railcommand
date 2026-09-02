# Existing-backend readiness — 2026-08-30

**Decision: not ready to connect the mobile app to the live backend yet.**
The scoped Expo app is implemented, but current-source staging workflow and native
acceptance are unfinished, and the deployed web/staging contracts differ in
permission enforcement. No production database, deployment, account, or device was
changed by this audit. No migration was run or prepared for automatic execution.

The intended architecture is one existing RailCommand customer backend serving web
and mobile. Do not copy synthetic staging records/accounts into it or recreate the
reduced staging schema there. A subsequent bounded **read-only production catalog
inspection** confirmed the differences below in the existing `RailCommand`
project, `gwvftrrknusdfdgiwuij`. No customer records or file contents were read.

## Latest result and distance to launch

At **20:45:59 UTC**, the newly approved isolated Preview became **READY**:
[`railcommand-mobile-staging-h1a0dvnhe`](https://railcommand-mobile-staging-h1a0dvnhe-dillans-projects-f662840b.vercel.app),
deployment `dpl_Eav1bRAd7GS3Ci6bxkDg6JDu5EkK`. Health/login checks passed; all seven
tested unauthenticated mobile endpoints rejected requests with 401 and no-store.
The custom staging domain and staging project's production target are unchanged;
no alias was assigned. No application sign-in, account change, record creation,
record update, deletion, migration, or device operation was performed.

The latest authorization requires **zero user-data adjustment/deletion**. This
pass deliberately excludes record-creation and destructive acceptance tests. A
healthy deployment and safe unauthenticated rejection do not prove signed-in
workflow success, so that gate remains open. Do not run the full reviewer runner
under this narrowed boundary; its default mode creates synthetic fixtures.

The core Expo app is implemented. The remaining release work is three bounded
stages—not another app rewrite:

1. **Accept the current app against staging and start controlled beta testing:**
   signed-in workflows, original-ID replay/readback, device-reachable staging API,
   and a current TestFlight build's offline/reconnect regression. Complete remaining
   physical Android and supervised accessibility evidence before public release.
   Internal TestFlight can use staging; it does not require a production cutover.
2. **Connect safely to the existing backend:** resolve the specific deployed
   compatibility/security differences below and validate that the existing web app
   still behaves correctly. Apply only separately approved additive contracts and
   targeted policy/function corrections, with a web regression plan. Keep existing customer
   rows/accounts in place; never merge synthetic staging data into production.
3. **Release acceptance:** beta feedback and release-candidate regression, current
   screenshots and configuration, a rollback plan, and explicit cutover/publication
   approval. Uploading a TestFlight build is separate from public release.

A launch percentage or fixed date would not be evidence-backed yet. The two
critical unknowns for an engineering estimate are the signed-in staging round trip
and the focused fixes/regression required by the now-confirmed production differences.
Hardware/beta findings and store review add separate uncertainty. Local test count
is not a launch-readiness score.

## Evidence now available

- Exact Preview sign-in, refresh, token identity, direct profile/membership reads,
  and authenticated bootstrap passed in the 19:43 UTC diagnostic. The full runner
  at 20:08 UTC signed in and refreshed successfully but again stopped at bootstrap,
  before any workflow record was created. Read-only staging API Gateway logs
  identify the cause of that HTTP 403: the profile query returned 200 while the
  simultaneous membership query returned 401 / `PGRST303` (JWT claims validation).
  The mobile route incorrectly mapped that upstream authentication failure to a
  permission error. The exact rejected claim is not available in the logs; a
  clock/claim timing explanation remains unconfirmed. No permissions or credentials
  were changed. The backend error-classification correction is now in the new
  Preview above; its signed-in workflow acceptance is still required.
- The same error-classification defect was found and corrected locally in queued
  daily-log and photo authorization/finalization. A final 401 after the existing
  single refresh now preserves the current log/photos as retrying and pauses the
  remaining foreground batch. Genuine permission denials stay blocked. No retry
  loop, database policy, storage mechanism, or service was added; receipt checks
  do not replace the outstanding uploaded-object integrity verification below.
- After this bounded follow-up, mobile/shared/API suites total **494 passing**:
  domain 27, offline 5, API client 10, native client 204, mobile API 245, links 3;
  plus **14 verifier tests**. Root and mobile TypeScript checks, targeted ESLint,
  and diff checks pass. Fault tests use real route/SDK code with synthetic
  transports, and native worker tests use stubbed adapters—not physical devices.
  The earlier 26 environment/build-profile/release-gate unit tests also passed;
  their configuration is unchanged. These are code tests, not store-state or
  physical-device verification.
- `npm run build -- --webpack` passed. Local default Turbopack was blocked by the
  runtime's compiler-port binding restriction, including one elevated retry. The
  exact Preview's default Turbopack build already passed; do not repeatedly debug
  this local environment limitation or change application architecture for it.
- Earlier physical iPhone/iPad acceptance remains valid for those earlier builds.
  Installed Expo build `300003` does not include today's changes. Recent bundle
  exports/simulator checks do not prove the updated physical-device flow.
- Earlier iOS and Android Hermes exports also passed locally at
  `/private/tmp/railcommand-mobile-readiness-export-0fKrlw`. Metadata checks confirmed
  all 30 iOS assets and 34 Android assets exist. Only approved public staging values
  were supplied, with dotenv loading, network use, and telemetry disabled; the
  development profile was explicit. No native project regeneration, signing,
  installation, EAS upload, or store action occurred. These exports predate the
  final session-error and queue-pause follow-ups; they are not acceptance evidence
  for a new installed build.
  - iOS: 3,851,025 bytes; SHA-256
    `5af9fc37be92790168571f90a8ae83aa41ccb51910d61083f02b725ec4405a8e`.
  - Android: 4,140,482 bytes; SHA-256
    `c486729bee9c982fcfe4922a5b1e4fb9c76463b0bde3a388f737d644cb76c818`.
- Phase 4 recovery-email delivery and one-use password update are already verified
  in [the dated release gates](./PHASE_4_RELEASE_GATES.json). Do not repeat password
  resets or email delivery solely because a later checkpoint used ambiguous wording.

## Production definition inventory — read-only, 2026-08-30

The connector resolved the existing production project by its observed ID/name,
matching the repository's existing type-generation target. Inspections used
`BEGIN TRANSACTION READ ONLY`, a local ten-second statement timeout, catalog
`SELECT`s, and `ROLLBACK`. Returned rows confirmed `transaction_read_only = on`.
The queries inspected function bodies, table/RLS presence, privileges, policies,
indexes, and attached trigger definitions. They did **not** invoke application RPCs,
read `auth.users`, query customer tables/Storage objects, impersonate users, count
customer records, inspect current numbering counters, change grants, or run DDL/DML.

Confirmed foundations already present:

- `sync_daily_log_create` and `sync_daily_log_photo_attachment` exist and are
  security-invoker functions with an empty search path; `anon` cannot execute them,
  while `authenticated` can.
- Both daily-log and photo idempotency unique indexes exist. Daily-log child tables
  have RLS plus creator-insert/member-read policies. The daily-log activity trigger
  is attached and enabled, and the current create RPC leaves activity logging to it.
- RFI/Submittal numbering triggers and project/number unique indexes already exist.
- The existing invitation table is present; three mobile account/device tables and
  three mobile invitation/deletion functions listed below are absent.

This is definition-level compatibility evidence, not a production write test, a
complete security audit, or proof that any customer data has been accessed improperly.
The backend was not altered.

## Specific backend gaps before any future cutover

| Check | Deployed evidence and required action |
| --- | --- |
| Storage project isolation — priority | Existing `storage.objects` SELECT/INSERT policies for `project-documents` and `thermal-photos` accept `auth.role() = 'authenticated'` without membership/path constraints. They coexist with narrower member policies, but all observed policies are permissive, so the broader policies still allow access. RLS and authenticated SELECT/INSERT grants are enabled. Test a narrow correction against representative **synthetic** web/mobile flows before a separately approved live change. Do not read customer files to demonstrate it. Bucket public/private configuration and actual exploitation were not inspected. |
| Edit revocation | Deployed daily-log/photo RPCs check allowed roles but omit `project_members.can_edit`. Daily-log INSERT RLS is also role-based, and attachment INSERT RLS checks membership/uploader, not `can_edit`. The mobile HTTP routes check the flag, but direct authenticated RPC execution remains available. Align the intended rule at the database boundary and prove revoked-editor denial in staging; do not merely add another permissive policy. |
| Completed-photo integrity | Deployed photo finalization validates caller-supplied metadata/path but does not verify an uploaded object's existence, actual byte size, or MIME before recording success. The mobile finalization route also lacks that check. Prove missing/mismatched-object rejection in staging before trusting finalization. No production attachment RPC was executed. |
| Numbering | Deployed `assign_entity_number` uses fixed-width `lpad(_next::text, 3, '0')`; its RFI/Submittal triggers are enabled. Longer numbers can be truncated. Preserve counters and existing record numbers while testing the 999/1,000 boundary in staging. No live counter values or affected records were queried; none were changed. |
| Admin versus member access | Mobile permission helpers advertise an admin bypass, while deployed RFI/Submittal read/create and sequence RLS require membership. Establish the intended behavior and align advertised capabilities with it. The manager-member reviewer test cannot prove admin-without-membership behavior. |
| Missing mobile contracts | `mobile_device_registrations`, `account_deletion_requests`, and `account_deletion_audit` are absent, as are `accept_mobile_project_invitation`, `request_account_deletion`, and `cancel_account_deletion`. The existing `project_invitations` table is present. Review and apply only necessary, separately approved additive contracts—not the reduced staging schema or all pending migrations blindly. |

Policy combination follows PostgreSQL's documented [permissive-policy OR rule](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
These findings justify a focused compatibility/security pass; they do not require
copying customer data, rebuilding the backend, or widening the v1 feature scope.

Source pointers:

- [Daily-log RPC](../../supabase/migrations/20260813135342_offline_daily_log_sync_trigger_fix.sql),
  [photo RPC](../../supabase/migrations/20260814121049_offline_daily_log_photo_sync.sql),
  [mobile photo Storage rules](../../supabase/migrations/20260824185152_mobile_daily_log_photo_storage_policies.sql).
- [Web numbering](../../supabase/migrations/20260705150000_extend_entity_numbering.sql),
  [web schema/RLS](../../supabase/schema_snapshot.sql),
  [staging contract extension](../../supabase/staging/phase5_mobile_workflows.sql).
- [Mobile photo finalization](../../src/app/api/mobile/v1/daily-logs/photos/finalize/route.ts),
  [record permissions](../../src/lib/mobile-api/record-create.ts).

## Internal TestFlight preflight — prepared locally, not uploaded

The intended beta is a store-signed iOS build of **the staging runtime**, not a
switch to customer data. Existing `build.beta` uses `distribution: store`,
`environment: preview`, `EXPO_PUBLIC_BUILD_PROFILE: staging`, and
`MOBILE_DISTRIBUTION_TARGET: beta`. Local evaluation resolves:

| Setting | Verified local value |
| --- | --- |
| Display name | RailCommand Beta |
| Bundle ID | `io.railcommand.app` |
| Apple team | `PQAGLH9L66` — Creative Currents LLC |
| Associated domain | `mobile-staging.railcommand.io` |
| Pinned submission record | `6803576049` — existing Phase 4 App Store Connect record |

Three small preparations are now complete **locally only**:

1. The staging-host Apple association includes the store bundle ID used by beta;
   production and unknown-host handling are unchanged.
2. `submit.beta.ios` pins the recorded Apple app/team; this does not submit a build.
3. Profile tests evaluate beta and reject a development/production runtime paired
   with beta distribution. Subprocesses use the installed Expo CLI with dotenv,
   network, and telemetry disabled, without inheriting credentials.

**Nine build-profile tests and four association tests passed**, along with targeted
ESLint, root/mobile TypeScript, `npm run build -- --webpack`, and diff checks. The
build was local only, not a production deployment. No signing material, EAS
environment values, or device data
was changed. No native/cloud build or TestFlight upload was performed. The existing
Apple record/signing metadata is previously recorded evidence, not a new live
App Store Connect inspection. These configuration changes postdate the READY
Preview above and have not been deployed there or to the staging hostname.

Before one explicitly approved upload:

- Finish the focused signed-in staging acceptance below. Obtain explicit consent
  for new synthetic fixtures; do not modify/delete existing user data.
- Establish approved **device-reachable** hosting for the tested API and its staging
  association document. The unique Preview is protected and the existing custom
  staging host still points to its earlier deployment. Do not embed a deployment
  bypass credential or change a hostname/protection setting without approval.
- Verify only approved public staging API/Supabase values enter the beta bundle;
  build one current artifact and retain its source/build identity.
- Inspect the intended internal group and automatic-distribution settings, then
  request permission to upload that exact artifact to the pinned Apple app. No
  external testing, App Review submission, automatic submission, or public release
  is implied.

Expo distinguishes [TestFlight distribution](https://docs.expo.dev/submit/testflight/)
from ad-hoc `distribution: internal`; [Apple associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)
require the hosted association to match the app entitlement. Beta delivery and
account-link verification are **online-only**. Offline drafts, cached reads,
outbox persistence, and existing user/device isolation are unchanged.

## Lean finish sequence

1. The new Preview and non-mutating checks are complete. Next, verify signed-in
   reads using the existing reviewer account, without a reset or membership change.
   Before the full workflow runner, explicitly confirm that creating new isolated
   synthetic staging fixtures is compatible with the owner's latest zero-user-data
   boundary. That runner retains one synthetic log/photo/RFI/Submittal and verifies
   replay/readback/PDF behavior. Its single unexpected-401
   refresh now matches the app's existing behavior; 403 and transport failures are
   not automatically retried. A passing diagnostic is not a workflow pass.
2. After that passes, separately authorize one current **internal TestFlight beta**
   build and upload, still using staging. First establish a device-reachable staging
   API for that build:
   current HTTP verification uses Vercel CLI access to a protected unique Preview;
   a native bearer token is not evidence that deployment protection is satisfied.
   Never put a Vercel bypass secret in the app. Preserve the existing custom staging
   host unless changing its assignment is specifically approved.
3. Run one updated-device regression: rich log/photo offline → restart → reconnect
   exactly once, new record/detail/PDF sharing, account/project isolation, and a
   short iPad layout check while tablet support is enabled. No reviewer video or
   device fleet is required. Accessibility controls require supervised consent and
   an established exit method.
4. Resolve the scoped backend contract findings in staging, then approve a written
   production change/cutover and rollback plan. The read-only inventory above is
   not permission to apply changes. Do not merge main, upload to stores, or switch
   live services merely because local tests pass.

Positive RFI/Submittal attachment retrieval, inaccessible-existing-project HTTP
isolation, and authorized EarthCam playback remain distinct evidence gaps; missing
record denials or an unavailable camera screen do not prove them. Test only exposed
supported behavior; do not expand into record editing/reviews or new offline modules.

Physical Android/TalkBack and separately authorized beta regression remain
pre-public-release gates. The dated Phase 4 hardware exception permits the recorded
compliance acceptance; it is not physical Android evidence for Phase 5. Updated store
screenshots belong after the interface/build is accepted.

## Offline and rollback boundary

- Daily logs/photos: **offline draft/queue**; preserve owner scope, client identity,
  parent-before-photo ordering, retry state, and fresh server authorization.
- Cached project/team/record text: **offline read-only**.
- RFI/Submittal forms: **offline draft, online-only submission**.
- PDF/attachment retrieval and EarthCam playback: **online-only**.
- Roll back application deployment/configuration without dropping additive schema,
  counters, attachments, or idempotency records. Never silently repoint pending
  staging queues to production or erase unsynchronized field work.
