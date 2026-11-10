# Inventory Beta — local release candidate, 10 November 2026

Status: integrated locally; not deployed or approved for live migration. The user's
priority is preservation of every existing record, app and unfinished field entry.
Earlier no-merge/no-deploy constraints remain in force during this preparation.

## What is being added

Use the existing navigation pattern: **Inventory · Beta**, alongside Cameras · Beta,
on desktop and responsive mobile navigation, and in native More/Field tools.
No new beta portal, login system, ERP integration or approval framework. Invite-only
access and the approved project roles remain unchanged.

The existing implementation supplies the approved project catalogue, fixed units,
desktop CSV template/preview/import, three-step receiving, stock requests, distinct
lead → PM → Supply Chain approvals when required, immutable history, cost entry,
5% annual capital carrying, >$50,000 contract-year review (approved commitments plus
request), likely-split flags and authorized cost CSV export. Org defaults are editable.
The catalogue is project-scoped; the CSV limit is 100 unique material codes per batch.

## Source and integration

- Base: current `origin/main` = `701849744457b529a7eaa292415a4b4867e11d4e`;
  remote main was checked on 10 November.
- Feature source: `feature/tco-inventory-phase-1` =
  `4c8b6c05dcf16a61bf2f0888084f2ae146fa121f`.
- Candidate: `feature/inventory-beta-release`, in a separate managed worktree.
  Source feature branch, original dirty checkout, main and live infrastructure are
  preserved. No Git merge, push, PR, deployment, TestFlight upload or invitation.
- Applied the feature diff to current main. Resolved four overlapping files, keeping
  the current progressive photo picker **byte-identical to main**, current security
  dependency overrides and release metadata; retained both DFR and Inventory exports.
- CI now includes the catalogue database suite and focused inventory suite alongside
  finance-bridge/contract/grant/auth/native checks. Branch deployment is disabled
  explicitly for both candidate and original feature branch in `vercel.json`.
- Fixed a startup race in the disposable finance-bridge test: connect/check readiness
  over loopback TCP, avoiding PostgreSQL's temporary initialization socket server.
  This changes test infrastructure only, not database or application behavior.
- The full lint gate caught a native CSV button updating a connectivity ref during
  render. It now updates in a layout effect, retaining the existing session,
  connection and user-scoped export revalidation. No storage/API change.

## Backend scope and preservation

This is an extension of the existing backend, not a replacement. Seven existing
migration files implement a dedicated inventory schema plus compatible finance
projection RPCs. There are 24 new inventory tables; existing projects and users
are referenced by their existing IDs. No seed, reset, bulk record replacement,
project duplication or data-deleting down migration is part of this release.

There are important shared boundaries: the initial migration adds composite unique
constraints to change orders/milestones, tightens direct financial column grants
and change-order/activity read policies, and introduces authorized finance RPCs.
Later files add inventory fields, broaden units and preserve old integer values
while allowing fractional quantities. These are **not** permission-neutral DDL.
New records/RPCs alone do not establish production compatibility. Do not run a
blanket `supabase db push`, replay a shipped caption migration or deploy the older
feature branch over current main.

Existing local evidence retained every original value across 66 public tables;
new candidate database tests use disposable synthetic PostgreSQL only. That local
evidence does not substitute for a fresh production backup, schema/ACL preflight,
restore rehearsal and comparison against the actual live database.

## Small rollout, only after production preflight

1. Confirm actual live web source, assigned mobile builds, production database
   identity and applied migration history. Capture existing grants/policies and
   finance RPC definitions for exact rollback. Take a fresh private backup and
   verify restoration into an isolated local database. No field records are test
   fixtures. Review row/ID/value preservation and constraint/lock requirements.
2. Apply the conditional finance preparation bridge first if pending:
   `20261103152824_inventory_finance_rollout_bridge.sql`. It preserves existing
   grants and never replaces existing final projection functions.
3. Put the compatible projection-based application/API in place before financial
   access is tightened. Coordinate beta entry with completion of schema checks;
   do not advertise Inventory as available while its tables/RPCs are missing.
   Confirm old clients' supported daily-log/photo/recovery/sync paths still work.
4. Apply **only missing** Inventory migrations, reviewed together with their
   dependencies, in this order after preparation:
   - `20261020161326_inventory_phase_one.sql`
   - `20261020172309_inventory_operation_settlement.sql`
   - `20261021170501_inventory_confirmed_contract_rules.sql`
   - `20261029192357_inventory_profile_access.sql`
   - `20261105160000_inventory_delivered_purchase_price.sql`
   - `20261105221954_inventory_catalogue_units_receiving.sql`
   Use a reviewed transaction/lock and statement timeouts. Record history correctly,
   refresh the schema and compare original rows/IDs/values. Stop on unexplained
   differences, permission failures or unsupported client behavior.
5. Verify Inventory Beta through desktop and the primary mobile online workspace.
   Native More/Field tools/bundled offline inventory require a new signed production
   mobile build; development build 610008 is not a team/TestFlight release. Reuse
   the existing account/infrastructure and approved no-extra-cost build path.
   Preserve installed apps and their user-scoped databases/queues in place.
6. Start with one nominated invited project and a small accepted delivery. Verify
   CSV replay, prices, role denial, lead/PM/Supply Chain order, strict >$50k, split
   review and no physical release before approval. No mass import or new invitations
   without explicit scope. Business pilot/intro remains Mark's follow-up.

Rollback retains all new receipts, stock, immutable evidence and pending drafts.
Do not restore an old backup over newer field work or drop inventory tables.
Rolling back to pre-projection web code after financial grants tighten also needs
an explicitly reviewed restoration of the exact previous ACL/policies. Prefer a
compatible application rollback, then fix forward. Never purge queues or identities.

## Platform and offline impact record

- Web: Inventory Beta navigation and existing responsive inventory screens, CSV
  setup, costs and role-restricted approval/export. Shared helpers read finance
  through authorized projections; current photo/auth/security code retained.
- Native: primary online workspace reuses web UI; dedicated More/Field tools UI,
  user-scoped cache/draft code and domain/API additions require a signed bundle.
- API/domain/database: existing versioned inventory commands and old-client
  projection retained. Revalidate membership, role, unit, stock/approval version,
  current policy and operation receipt on the server for every mutation/retry.
- Offline classification: **offline read-only** synchronized operational stock;
  **offline draft** field requests; **online-only** imports, receiving, prices,
  policy and approvals. Current-screen entry survives disconnection/Back/Continue;
  closing unsaved online-only forms does not create a durable receiving queue.
  Old drafts/outboxes, UUIDs, idempotency keys and conflict states are retained.
  Unsupported draft versions are preserved with a recovery message. Private data
  never enters the public service-worker cache; no full-offline-work claim.
- Cross-platform evidence: original feature's physical iPhone receiving and desktop
  refresh (build 610008) recorded in the 5 November handoff. This candidate's actual
  web/native receiving components pass the rendered mobile interaction check.
  This is not a new physical release/build acceptance claim.
- Pending physical checks: real network/restart and VoiceOver for the latest receiving
  flow; Android before Android rollout. Verify actual pilot build installation and
  populated-queue upgrade preservation before expanding beyond the agreed pilot.

## Current access blockers

The Vercel connector returned 403 for the existing RailCommand team; live deployment
identity could not be confirmed. Existing app team consent must be refreshed.
Neither connected Supabase account exposed production project `gwvftrrknusdfdgiwuij`;
one exposed only inactive Mobile Staging. No schema or customer row query was run
against a hosted database, and no inactive project was resumed or billed.

Production preflight, actual backup/restore acceptance, independent release review,
and the staged rollout remain pending. Local checks are evidence of readiness to
review, not a guarantee of zero migration risk or authorization to release.

## Candidate verification outcome

Passed: production web build and root TypeScript; 44 inventory tests; 359 auth/mobile
backend tests; 25 photo tests; native TypeScript and 278 native tests; iOS/Android
local bundle exports; real PostgreSQL grant, finance bridge, contract/profile/price
and catalogue suites; rendered actual web/native receiving interactions. Lint has
zero errors and 59 warnings. Action coverage records 130 web actions but remains
explicitly **not** full physical parity acceptance. The finance fixture's initial
bootstrap race was fixed and the real bridge test then passed.

Preservation check: original dirty checkout branch, HEAD, main, short status and
binary diff exactly match the start of this preparation. Original feature branch
remains clean at 4c8b6c0. Hosted databases, persistent local data and phone apps
were not mutated. Full production preflight and physical release acceptance remain
pending. Machine-readable results: `INVENTORY_BETA_RELEASE_20261110.json`.
