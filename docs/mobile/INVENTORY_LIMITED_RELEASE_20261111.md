# Limited Inventory Beta release — 11 November 2026

The owner approved web and TestFlight release for a limited pilot, with the first
pilot tester completing INV-REL-05 before wider distribution. Preserve existing
accounts, memberships, grants, data and installed-client/offline identities. Main
and the original dirty checkout stay untouched; release from the reviewed branch.

## Required pilot control before rollout

The prepared feature did not yet restrict activation to pilot participants. Add
one service-managed project/user enrollment table, empty by default. Its indexed
lookup further restricts the Inventory-only role predicate already used by RPCs
and table RLS. Enrollment never grants project membership or additional role/cost
privileges. No existing project/auth/finance policy is changed. A small permission
RPC lets the shared web/mobile HTTP handler show a clear 403 pilot message.

- Web: existing Inventory Beta screen and private HTTP handler; outside-pilot
  accounts receive a limited-pilot notice and no stock/cost response.
- Native: same shared API and database gate. The prepared native bundle needs no
  payload/storage change; distribute its build only to the nominated group.
  Existing installed clients retain all existing API protections and workflows.
- Database: one additive, RLS-enabled table with explicit service-only grants;
  Inventory-only role predicate plus a boolean access RPC. Direct table and RPC
  access must both be closed outside the selected project/user pairs.
- Offline: stock stays **offline read-only**, requests **offline drafts**, and
  receiving/import/cost/approval **online-only**. Pilot enrollment is rechecked
  online for every request, receipt and settlement. Closing pilot access preserves
  saved drafts/identities for later authorized recovery. No private cache change.

## Checks and order

1. Test default denial, enrolled access, cross-project/nonmember denial, direct RLS,
   service-only grants, field finance omission and old receipt replay on disposable
   synthetic PostgreSQL. Test HTTP denial before any business operation.
2. Rehearse all reviewed files, including the pilot gate, on the fresh disconnected
   backup; retain all 83 original tables and existing access definitions.
3. Confirm project/tester/group, Apple build number/distribution settings and live
   Vercel/Supabase targets. No new paid resource, public invite or shared login.
4. Stage the reviewed production web build without assigning live domains. Apply
   only the reviewed missing SQL in its tested order, with bounded timeouts and
   migration history. Enroll only explicitly selected existing members.
5. Verify protected web/API behavior, then promote the same staged build. Upload
   the verified native build to TestFlight with distribution limited to the chosen
   group; do not expire older builds or change existing tester access.
6. Record the first tester's physical iPhone checklist as pending until observed or
   reported. No wider rollout before that gate passes. Roll back application code
   compatibly if needed; retain new stock, receipts, evidence and drafts.

Pilot project/testers and release results are recorded below once confirmed.

## Verification before production staging

- `npm run test:inventory`: 47 tests passed, including default deny and fail-closed
  shared web/native routes, CSV, receipt and settlement protections.
- `npm run build` and `npx tsc --noEmit`: passed.
- `npm run check:db-grants` and `npm run test:db-grants`: passed.
- `node scripts/test-inventory-catalogue-db.mjs`: passed with real PostgreSQL pilot
  enrollment, membership, direct-table RLS, unchanged finance restrictions,
  receipt replay and disable-access cases.
- Fresh 11 November backup restored with all eight reviewed SQL files in an
  isolated, disconnected local database: all 83 original tables' values and
  existing access definitions retained. All 21 old missing-project history rows
  remain unchanged. No ownership repair was performed. The generated rehearsal
  container was removed; the original backup is retained privately.
- Vercel source inspection excludes generated native iOS and Expo build artifacts;
  the Next.js deployment retains all shared packages and native API routes.
- Apple account/team and existing manual-distribution TestFlight groups verified.
  Production build 610011 upload initiated; processing/assignment not yet claimed.
- Physical iPhone acceptance remains INV-REL-05, to be completed by the first
  field-beta tester before wider release. Simulator acceptance is recorded in the
  preceding release record and does not count as that hardware check.

## Limited release outcome

The owner approved release on web and TestFlight. The existing **RailCommand Field
Beta** group is the first audience; wider distribution remains blocked on
INV-REL-05. This is the same `io.railcommand.app` app and existing accounts, not
another local QA app. No new public link, tester, shared login or project
membership was created. Four existing testers have 11 existing project/member
pairs enrolled; the fifth has no project membership and receives no new access.
The owner explicitly confirmed the existing field-beta group first, retaining
each tester's existing project permissions. Wider access stays closed until the
first iPhone check passes.

- Web/backend source: `93210780ea4183dbd7c0522b5507276dfcbf7526` on
  `feature/inventory-beta-release`. The branch was pushed; `main` remains
  `701849744457b529a7eaa292415a4b4867e11d4e` and was not merged.
- Vercel deployment `dpl_CEZMYZPnCxCTihPx1H71jufWcqf3`: staged as production with
  `--skip-domain`, verified READY, then promoted without rebuilding. Login returns
  200; unauthenticated Inventory and mobile bootstrap return 401 with no-store.
  All 22 previously released mobile API routes are retained in deployment output.
- Correct existing Supabase project: `gwvftrrknusdfdgiwuij`. Only the eight reviewed
  SQL files above were applied, in rehearsal order, each with 3-second lock and
  30-second statement limits. All original 19 migration entries remain unchanged.
  The MCP tool's newly generated version identifiers were individually mapped to
  their exact reviewed source filenames; only those eight new history rows were
  adjusted, with exact name/version and collision guards. No bulk push/reset.
- Live before/after fingerprints matched for all 82 existing application/Auth/file
  metadata tables, existing table access/RLS policies, roles, memberships and
  default privileges. The 83rd original table is migration history: its original
  19 entries remain and the eight release entries were added. Known old orphaned
  history/assignments remain preserved and unresolved; no ownership was inferred.
- Live authenticated-role read: enrolled existing project returns an empty initial
  catalogue/stock snapshot, 5% annual carrying rate and $50,000 contract threshold.
  Other-project lookup returns false; an existing nonmember sees no stock. These
  are read-only checks, not new field records or real-user sign-ins.
- Security advisor comparison: no new anonymous-callable privileged function.
  New service-only finance/enrollment tables intentionally have RLS and no client
  policies; the five authenticated Inventory entry points intentionally revalidate
  membership, pilot, roles and finance rights. Inherited unrelated warnings remain
  tracked in the previous review and existing access was preserved.
- Native: verified production build **1.0.0 (610011)** uploaded successfully using
  local Xcode and the existing Apple account. Apple processing completed and the build is **Approved**, assigned only to
  the existing RailCommand Field Beta group (5 testers). After the owner explicitly approved notification, **Notify Testers** was
  activated once and Apple's status changed from Approved to **Testing**. The
  update is released to the existing field-beta group; actual installation and
  hardware acceptance remain pending. No public App Store submission.
  `availableMobileRelease` intentionally still advertises 300012: do not globally
  recommend the new build before Apple availability and the hardware gate.
- No paid branch/cloud build/new service/plan upgrade was used. The database backup
  and its restore evidence remain private on the Mac. Storage object bytes were
  not part of the database backup; this release does not change those objects.
- The original dirty checkout's branch/HEAD/main/status/binary diff match its
  saved baseline exactly. Existing local apps and private drafts were not cleared.

### First pilot iPhone check — INV-REL-05

Keep pending until a tester reports or demonstrates these checks on real hardware:

1. Update the existing RailCommand app from the selected TestFlight group to
   610011; sign in with the normal invited account and open its existing project.
2. Open **Inventory Beta**. Confirm readable lists/search, correct material code
   and units, and receiving controls fit the iPhone. Existing role/cost access must
   match the web. No tester should guess ownership or edit real stock as a test.
3. Save an intended stock request as a device draft, disconnect, close/reopen the
   app and confirm the input survives. Reconnect and explicitly submit once;
   verify it creates one request and shows its real approval state.
4. Check CSV import/preview and report sharing where that tester's role permits;
   commit only genuine approved material/stock information or records in an
   explicitly designated disposable test project. The catalogue starts empty and
   is not automatically populated from unrelated legacy records.
5. Record device/iOS/build, success or exact issue, and confirm no existing draft,
   account or project data disappeared. Keep wider enrollment/distribution closed
   until this gate passes. Remaining Android/hardware breadth is not claimed.

### Rollback

If a release issue appears, disable the affected new enrollment rows or restore
web traffic to `dpl_3YwL8jBF7B4yW8BiPXBmoxjt1WLy`; stop distributing 610011.
Do not drop Inventory tables, remove receipts/history, erase drafts/outboxes,
restore an old whole database over newer field work, or change project membership.
Retain both old and new records for a reviewed compatible forward fix.


### Apple approval checkpoint

Apple build ID `94623f25-277d-42ca-96c2-36ce568dd7c6` is Approved after
TestFlight submission. What to Test notes include the pilot hardware check,
CSV/material codes/units, 5% carrying cost, contract threshold, split flags,
approval order and offline draft restart. The single assigned group is the
existing RailCommand Field Beta external group, with 5 existing testers and no
individual additions. Automatic tester notification was deselected. No old build
was expired and the private group/settings were not changed. Apple requires manual
distribution after approval when notifications were deselected; **Notify Testers**
is the remaining owner-authorized messaging step, not an Apple review delay.

Official workflow: [Apple external beta distribution](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/).
The local screenshot and private upload logs record this checkpoint. The owner was
asked for permission to send Apple's standard notification to the existing five
field testers, as required by the agent's explicit-messaging rule.


### Confirmed field-beta distribution

The owner explicitly confirmed **existing field-beta testers first** and approved
**Notify Testers** for the five existing members of RailCommand Field Beta.
The button was activated once for build **610011**. A fresh App Store Connect
state shows **Testing**, confirming manual distribution completed and Apple's
standard notification was triggered. The release screenshot is retained locally
as `testflight-testing-610011.png`; no unrelated mail or invitation was sent.

Existing field-beta testers can now open TestFlight, update the existing
RailCommand app to 1.0.0 (610011), sign in normally and open **Inventory Beta** in
their authorized project. The fifth tester still has no project membership; no
membership or existing permissions were added or changed. No wider group,
individual tester or public invitation link was added. No previous build was
expired. No new database mutation or web deployment was needed in this step.

INV-REL-05 remains **pending**: release availability is not installation or a
physical-device pass. The first tester must report the iPhone check before wider
Inventory enrollment or TestFlight distribution. The global app update
recommendation remains unchanged during this limited pilot. Saved stock is
**offline read-only** and requests are **durable offline drafts**; receiving,
import, cost changes and approvals remain **online-only**. This administrative
release does not change any app code, offline database or queued work.
