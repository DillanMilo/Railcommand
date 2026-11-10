# Inventory Beta label and local walkthrough — November 4, 2026

The tested Phase 1 core remains locally accepted. This change marks the section
as **Inventory Beta**, using plain field wording and the existing Cameras badge
pattern. It does not make the feature available in the released team app.

Follow-up: [readable cost entry, history and male narration](TCO_PHASE1_READABILITY_20261104.md)
supersedes the earlier silent-guide and raw financial presentation described below.

## Change impact / offline assessment

- Web: the desktop sidebar and narrow-layout More menu expose Inventory with a
  Beta badge. Both signed-in and sign-in/project-selection headings show Beta.
  The narrow-layout entry was missing and is now included.
- Native: More → Inventory uses the existing Beta badge; both inventory screen
  headings say Inventory Beta. Routes and module identities are unchanged.
- Shared API/domain/backend/database: no changes. The 5% annual default,
  configurable USD 50,000 contract-year rule, split review, permissions and
  append-only ledger remain as previously tested.
- Offline: **offline draft/queue** for operational input; **offline read-only**
  cached stock; approvals, finance and settings **online-only**. Submission is
  explicit online. Labels/navigation change no draft schema, storage partitions,
  queued identities, idempotency, conflict checks, authorization or sign-out.
  Public service-worker/private-cache boundaries are unchanged.
- Installed clients: the separate iPhone Phase1 build 610004 retains its older
  bundled label until rebuilt. Its tested business behavior is unchanged. No app
  was installed, uninstalled, signed out or modified on the phone for this change.
  A signed native beta build with the label is a release dependency, not an OTA
  update. Android/iPad label installation remains unverified.
- Web/mobile verification: real local web route and More → Inventory Beta were
  exercised with existing synthetic PM data. Native TypeScript and focused
  inventory/visual tests passed. This display-only patch does not replace the
  [physical-phone approval/offline evidence](TCO_PHASE1_DEVICE_ACCEPTANCE_20261104.md).

## Local walkthrough

Open the existing persistent local backend and `http://localhost:3108`. The
walkthrough uses only `QA1029 ACCESS - LOCAL TEST ONLY`; no real stock/spend.

1. Select the project, then Inventory Beta (More on a narrow web viewport).
2. Review Stock by lot: yard, accepted inspection, quantity, received date and age.
3. Foreman: Request from this lot, enter ties/location/reason, Submit request
   online. Field drafts persist on the device while disconnected; reconnect and
   review before explicit submission. Submission alone changes no stock.
4. Assigned inventory lead verifies quantity/location; a distinct PM authorizes.
   New spending over the contract-year threshold waits for assigned distinct
   Supply Chain approval. Release requires all required approvals.
5. Authorized cost viewers see Material cost & budget review. Confirm all buckets
   have sources; incomplete totals remain labelled incomplete. The 5% capital
   component uses remaining opening acquisition value × rate × days / 365;
   storage is separate. An illustrative 10,000 held for 365 days gives 500.
6. Review annual commitments plus the request using contract anniversary bounds.
   Exactly 50,000 does not trigger the second sign-off; 50,000.01 does. Reused
   committed sources do not add duplicate spending. Likely split signals call
   for linked-source review and do not establish fraud.
7. Review Requests & assigned approvals and Evidence & conditions for posted
   state, distinct actors, timestamps, ordering and immutable history.

Foreman and inventory-lead views omit finance. Engineers/superintendents require
explicit project cost-view grants. Organization rule/access administration stays
with admins. Every actor uses their own invited account.

## Verification

- `npm run build`, root `npx tsc --noEmit`, native `npm run typecheck`: passed.
- Existing focused web inventory suite: 17 passed. Native inventory/environment,
  routes and visual foundation selection: 16 passed.
- Changed-file ESLint: no errors; two pre-existing native hook warnings remain.
- `git diff --check`: passed. No database/schema or hosted service changes.
- Original dirty checkout's branch, HEAD, main ref, porcelain status and binary
  diff hash still match the pre-test baseline.

## Videos and release boundary

Created a separate editable local Remotion project on the Desktop:
`railcommand-tco-videos/`. This keeps video dependencies out of the app build.

- `Inventory-Beta-Promo`: 40 seconds, 1920×1080, 30 fps.
- `Inventory-Beta-How-To`: 117 seconds, same format; nine chapters cover entry,
  requesting, approvals, access, carrying, threshold, split review, offline and trail.
- Preview-led, silent motion graphics with visible explanatory text. App captures
  are the local responsive web screen with synthetic data, labelled accordingly.
  Native navigation is explained; web screenshots are not claimed as native UI.
- Studio previews run at `http://localhost:3210`. Source, fonts, captures and
  repeatable start command live in that Desktop folder. No MP4 export, upload,
  paid assets, voice service or cloud rendering was started.
- Remotion TypeScript/ESLint and local bundle passed. All scene layouts were
  inspected through Studio; delayed image painting after a scrub was allowed to
  finish before accepting the captured image scenes.

The regular team app still needs the [staged rollout](TCO_PHASE1_ROLLOUT_20261103.md):
actual production revision/migration/ACL/backup preflight and release review,
finance bridge → compatible web/API → inventory migrations, then a signed native
build and invited tester assignment. No merge, push, deployment, hosted mutation
or tester invitation was performed. Mark's intro to Spike, pilot org/project,
named approvers, accepted stock and opening commitments remain business setup.

Keep the Mac awake while demonstrating the local app. The phone can be unplugged
and used normally. The local CA expires November 10; renew before later LAN phone
testing. Docker can be quit without removing persistent volumes when finished.
