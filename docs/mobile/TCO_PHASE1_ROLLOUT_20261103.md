# Phase1 minimum rollout — proposed, not executed

The application is built and locally tested. Before an invited web/iPhone pilot,
finish the physical permission, Supply Chain and offline-draft smoke check, then
complete the production preflight below. No Phase2/3 features are required for this
pilot. Android is outside the initially specified web/current-iPhone pilot.

## Safe initial deployment order

1. Verify the actual live web revision, supported TestFlight builds, database
   migration history, finance RPC signatures/owners, current grants and relevant
   RLS policies. Capture a fresh backup and exact ACL/policy rollback script.
   Review the pending migration list; do not run an unreviewed blanket db push.
2. Apply **20261103152824_inventory_finance_rollout_bridge.sql first**, despite its
   later timestamp. This supplies missing projection RPCs using existing grants,
   RLS and legacy finance roles. It changes no records/table grants/policies and
   never replaces an existing final finance RPC. The old web/backend still works.
3. Publish and verify the compatible web/API candidate with the bridge present.
   Retain photo pagination, caption-v2 and legacy-v1 dispatch, recovery/auth,
   release metadata and existing sync endpoints. Use only approved synthetic
   accounts/records for acceptance; existing field records are not test fixtures.
4. Apply only these pending inventory migrations in order, in a reviewed
   transaction: 20261020161326, 20261020172309, 20261021170501,
   20261029192357. The new projection-based web/API is already available when
   direct financial column access tightens. Record/check migration history and
   reload the schema. Keep the already-shipped20261030173344 caption migration;
   do not apply its constraint twice. Verify permissions and existing clients.
5. Produce the next available production-signed TestFlight build from the reviewed
   native source; local610004 is a separate development app, not a TestFlight
   release. Verify processing, private tester assignment and installation. Start
   with the agreed invited pilot and the existing infrastructure; no paid database
   branch, shared login or automatic messages/invitations.

Bridge-before-app-before-tightening was exercised in disposable PostgreSQL,
followed by the real inventory migration/permission/concurrency suite. Applying
the bridge after final RPCs exist was separately verified as a no-op. This is
local evidence, not proof that production preflight or deployment happened.

## Rollback without losing work

Keep all inventory records, immutable history, receipts, grant history and additive
schema. Never restore an old data backup over newer field work, uninstall an app,
sign out users, purge queues or change operation identities.

The old pre-Phase1 web directly selects budget columns. Reverting to it after
column access tightens is **not** a safe standalone rollback. Before reverting,
restore only the exact preflight grants and affected financial read policies,
with explicit approval, then verify the previous web and supported mobile flows.
Retain the inventory ledger and caption/legacy sync support. A newer native client
must keep drafts pending if the inventory API is temporarily unavailable.

## Small pilot setup / acceptance

- Invite-only users; distinct foreman, inventory lead, PM and Supply Chain actors.
- Organization defaults5%/year and strictly aboveUSD50000 per contract year,
  approved commitments plus request. Admin can edit; PM cannot edit org rules.
- Confirm contract start, external approved baseline excluding tracked sources,
  project budget/change-order link and accepted opening stock. Unknown funding or
  missing reconciliation stays on hold.
- Check foreman finance omission; lead verification; PM decision; Supply Chain
  hold/release; likely-split warning; immutable actor/time/order trail; safe retry;
  and offline draft/reopen/reconnect. No release before required approvals.
- Mark/Spike participant/yard/date agreement remains a business setup follow-up.
  Exports, retention and flag-investigation ownership remain Phase3.

## 10 November release preparation

The current candidate and complete seven-file migration/dependency list are in
[Inventory Beta release candidate](INVENTORY_BETA_RELEASE_20261110.md). This older
checkpoint predates delivered pricing, catalogue/units/receiving and the approved
CSV export addition; its four-file list and older build numbers are historical.
No release or hosted mutation has been executed.
