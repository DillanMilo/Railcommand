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
