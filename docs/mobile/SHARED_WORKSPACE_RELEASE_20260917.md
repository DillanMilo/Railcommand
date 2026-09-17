# Shared workspace release — September 17, 2026

## Scope and current status

Implementation is local; deployment, signed build assignment and physical acceptance
must be recorded below before calling this released. The existing live release is
still backend 117e376 / dpl_EEtfNpANoeoMTwCzcSTVhSW1SpmS and iPhone 300008.

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

## Remaining acceptance/release gates

- Finish final checks, commit exact sources, stage compatible backend, run auth
  boundary smoke checks, apply only reviewed DDL, promote the verified deployment.
- Build/submit/assign a new production iPhone build to Dillan only, preserving his
  installed app data. Verify the App Store build/source/version and assignment.
- Physical iPhone: sign-in, same projects, web/mobile write/readback using a test
  project, file picker/photo/document upload and export/share, GPS, offline form
  retention, native queued-log review, restart and account isolation.
- Caleb's feedback is still not supplied. Keep it in this task while active; a new
  task in this repository must read AGENTS.md and the web/mobile change policy.
- Mark/Caleb external distribution requires Apple review/demo-only credentials and
  privacy acceptance. Their draft email has not been sent by this work.
- The 126-action matrix remains unverified; shared UI is implementation reuse, not
  proof that every device workflow passed. Do not promise blanket full parity yet.
