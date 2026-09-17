# Shared workspace release — September 17, 2026

## Scope and current status

Backend e717d5b8dcd81fb024b8a17a2c8c9e58483ca9ca is live as
`dpl_AH14LTcuJkBKqT7StPXdPwhysVgk`, promoted after staging auth checks.
Both reviewed migrations are applied and recorded in production. Build 300009
finished from native source 7bf201373afa0f30b9c530f20328fdc9da85a08e and has
been submitted to Apple; processing, internal assignment and physical acceptance
remain pending. The user's last confirmed installed version is 300008.

The app's primary online workspace uses the released responsive web UI inside an
isolated WebView. This reuses web editing, responses, status changes, uploads,
reports, search and administration with the same records and permissions. Native
Field tools retain the existing offline daily-log queue, photos, cached records,
RailBot and native account/sign-out controls. More-module links now open in-app.
Web updates reach the workspace on navigation/refresh; native bundled features
still require their own code change and signed build.

## Offline classification

- Workspace: **online-only**. Network loss leaves the page mounted under a visible
  pause cover. Saving/navigation/reloading resume when connected; there is no
  automatic reload. Native back/refresh/removal and web links warn about entered
  values. Closing/OS-terminating the app can lose unsaved web form input; the header
  explicitly says to save before closing. File selections/retry state live only
  for that page's lifetime. Use Field tools for durable offline work.
- Existing native logs/photos: **offline draft/queue**, unchanged by the workspace.
  Same-day conflicts use the previously tested explicit review flow and stable
  operation identities. Never uninstall, sign out, reset storage or discard the
  user's two pending September 16 logs to install this update.

## Authentication and private storage

Verified native bearer -> encrypted 30-second one-use OTP handoff by POST -> separate
web session. The native refresh token never enters the WebView or URL. Confirmed
existing email required; verified MFA accounts fail closed rather than downgrade.
Identity and production pilot membership are checked at issuance and exchange.
MOBILE_WORKSPACE_ENABLED=true is an entry gate, not a revocation mechanism for an
already-open web session. Existing web authorization/RLS still governs every record
operation; this does not grant additional project access.

WebView uses an ephemeral data store, no shared cookies/cache, account-revision
remounting, same-origin navigation, bounded export messages and account-scoped
native temporary files. Workspace sign-out opens the native account screen so its
pending-work checks run. External links require an explicit device confirmation.
The workspace skips service-worker registration. The backend worker is restricted
to public static assets and removes old RailCommand caches containing private HTML;
project records and native drafts/queues are not deleted by this cache cleanup.

## Data-safety fixes required before exposing web mutations

1. Daily-log create/recovery uses reviewed same-day confirmation and existing stable
   UUID/idempotency keys (prior patch).
2. Daily-log editing uses one SECURITY INVOKER transaction with an originally loaded
   parent/child snapshot. It rechecks permission/ownership, locks the log and rejects
   stale parent or line-item content. An invalid child rolls back the entire edit.
   Payload fields are preserved without silent truncation. Older open web forms
   without a baseline fail safely and need reloading. Existing native clients do
   not call this new edit RPC.
3. Photo/document retries retain page-scoped per-user/per-parent UUIDs and storage
   paths, reconcile exact attachment receipts, and never delete storage because an
   insert response was uncertain. Failed photos remain visible with Retry. Native
   queue behavior is unaffected. This is not durable offline upload support for
   the online workspace.

Native export bridge supports up to 20 MB per export; larger exports explicitly
require the website. Device picker, GPS, reports, permission prompts and physical
WebView behavior remain acceptance checks, not inferred from a successful bundle.

## Verification evidence so far

- Native: 230 tests and TypeScript passed; production iOS Hermes export passed.
- Backend auth/route tests use actual Supabase client/SSR cookie code and mocked
  network responses, including disabled/nonpilot/anonymous/unconfirmed/MFA cases,
  account mismatch, expiration, tampering, cross-site POST and one-use replay.
- Real Supabase Auth v2.188.1 in a disposable PostgreSQL-backed local container:
  synthetic password sign-in -> actual issued ticket -> actual exchanged cookies;
  independent web/native tokens; replay rejected; native refresh still succeeds
  after local web-session sign-out. Only one synthetic local account was created.
- Same-day create and atomic edit PostgreSQL tests passed with synthetic records,
  including rollback, stale parent/child, revoked permissions and copied live
  child RLS rules. No live field records were used as fixtures.
- Staging project identity confirmed via Supabase API as RailCommand Mobile Staging
  (rxuvchdqbzvovqijvfhx), with Synthetic US Track Renewal fixture manifest.
  Edit function installed in staging; staging deliberately grants only SELECT/INSERT
  on these tables, so authenticated edits fail closed there. No persistent edit
  grants were added. The attempted synthetic transaction rolled back; zero fixture
  users remained. Production grants/policies were inspected read-only and tested
  in the disposable local database instead.
- Staging admin-key retrieval is forbidden to the current CLI account. The real
  handoff test therefore used isolated local Auth, not a fabricated staging pass.
- Staging security advisor shows the same pre-existing account-deletion SECURITY
  DEFINER and leaked-password warnings; no new SECURITY DEFINER function is added.
- Final backend and candidate web production builds and TypeScript passed after
  the safety fixes. Backend: 291 tests passed. API client: 13 tests passed.
  The 126-action inventory passes; full device acceptance intentionally remains open.

## Migration and rollback

Only the two reviewed migrations belong to this rollout:
- 20260917135812_daily_log_same_day_review.sql
- 20260917145653_daily_log_atomic_edit.sql

Atomic-edit migration filename matches staging history. Its uncommitted function
was iterated in staging to preserve full field values; final source must match the
function deployed to production. No table rows are updated by applying either DDL
migration. No RLS policies or table grants are changed by either migration.
Schema-only live recovery metadata is privately saved in
/tmp/railcommand-workspace-live-before.json; this includes the prior create RPC,
constraints and grants/policies, not project contents.

Retain the same-day confirmation RPC if rolling back the UI. Do not restore date
uniqueness by deleting/merging records, and do not restore the old create RPC after
removing uniqueness. The new edit function is additive; older native clients do
not depend on it. Disabling workspace entry can fall back to existing Field tools.

## Deployment verification — September 17

- Production deployment: `dpl_AH14LTcuJkBKqT7StPXdPwhysVgk`,
  https://railcommand-ri2p8r9pm-dillans-projects-f662840b.vercel.app.
  `railcommand.io` resolves to this deployment; live and staged auth checks pass
  (401 missing/forged pilot credentials, 403 nonpilot and invalid handoff, no-store).
- Production `MOBILE_WORKSPACE_ENABLED=true`; existing three-user read/write pilot
  remains bounded. No project membership or edit grants were widened.
- Additive atomic edit installed before backend promotion. Same-day migration
  applied after promotion, guarded by the exact previous create-function definition.
  Both migration-history entries verified. Read-back confirms both function bodies
  exactly match source, SECURITY INVOKER, unchanged grants/RLS policies, enabled
  RLS, retained primary/foreign keys and author/idempotency uniqueness.
  Migration DDL did not update/delete any field records; no live mutation fixtures.
- Production advisor reports 19 warnings on existing helper functions and leaked
  password protection; neither release function appears. Those wider findings are
  a separate audit follow-up, not silently changed in this release.
- EAS build: `da211cfc-a497-4c4f-87e3-70b92c052005`, version 1.0.0 (300009),
  production STORE build. Submission: `b703435c-a98e-4f5c-a761-6c920f83b9c5`.
- IPA SHA-256: `1dbcab9677f1e343818975be1e3338000698296d4e81d6abc4ede9ab74e434f8`.
  Bundle `io.railcommand.app`, build/version and camera/photo/location/microphone
  purpose strings verified. macOS codesign could not validate the downloaded iOS
  distribution archive's trust/entitlement representation; do not call local signing
  validation passed. Apple upload/processing remains the distribution validation.
- App Store Connect browser session expired; the old review form is preserved.
  Existing EAS publishing credentials successfully read Apple status and verified
  internal group b92ba7eb-1a88-40ec-8af2-f38c499dee30 contains only dillanxx@gmail.com.
  Browser sign-in is not needed for that API path. Build 300009 is still queued for
  upload and not yet assigned; no external rollout inferred.
- Initial remote CI found 15 explicit-any lint errors in five test harnesses.
  Replaced those with typed mocks/module exports; focused 23 tests, lint and both
  TypeScript checks pass. This changes tests only, not the shipped runtime/build.
  Remote CI rerun remains pending after the fix push.
- Post-promotion runtime error scan returned zero entries. Disposable local Auth
  and database containers/network were removed after tests; no live service stopped.

## Remaining acceptance/release gates

- Finish Apple processing and assign 300009 to Dillan's existing internal group only,
  preserving installed app data. Verify availability; uploaded is not installed.
- Physical iPhone: sign-in, same projects, web/mobile write/readback using a test
  project, file picker/photo/document upload and export/share, GPS, offline form
  retention, native queued-log review, restart and account isolation.
- Caleb's feedback is still not supplied. Keep it in this task while active; a new
  task in this repository must read AGENTS.md and the web/mobile change policy.
- Mark/Caleb external distribution requires Apple review/demo-only credentials and
  privacy acceptance. Their draft email has not been sent by this work.
- The 126-action matrix remains unverified; shared UI is implementation reuse, not
  proof that every device workflow passed. Do not promise blanket full parity yet.

## September 17 subsequent status

Build 300009 is now VALID and assigned to Dillan’s existing internal TestFlight
group; the earlier upload-queue note is superseded. Backend CI 35241568752 passed.
Caleb’s DFR photo feedback has now been supplied and is being addressed in
`DFR_PHOTO_REPAIR_20260917.md`. Physical device acceptance remains open.

## Approved DFR release now live

After explicit user approval, dpl_36LoCT8KqjExbxukXS7GbMBpLhvX was promoted to
railcommand.io from runtime commit 8d78abd. Nine live auth/no-store checks passed;
post-promotion runtime error scan returned zero entries. Build 300009 Workspace
receives these web changes after navigation/refresh. No new mobile build, schema
change or automatic field-record modification accompanied this release. See
`DFR_PHOTO_REPAIR_20260917.md` for acceptance gaps and rollback.
