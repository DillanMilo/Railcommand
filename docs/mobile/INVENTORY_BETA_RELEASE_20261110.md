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

The initial migration adds composite unique constraints to change orders/milestones
and finance compatibility RPCs. The 10 November correction removes the proposed
legacy financial grant and change-order/activity policy tightening. Existing table
and column ACLs and RLS stay unchanged; the compatibility RPCs are SECURITY INVOKER
and honor that existing access. New Inventory costs retain their separate role
and RPC boundaries. Explicit project membership admits invited collaborators whose
profile organization differs or is missing; organization-wide Inventory settings
still require an admin in the project organization.
Later files add inventory fields, broaden units and preserve old integer values
while allowing fractional quantities. The new feature adds its own access boundaries
without rewriting existing project access.
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
3. Put the compatible projection-based application/API in place after the
   preparation RPCs exist. Existing financial table grants are not tightened.
   Coordinate beta entry with completion of schema checks;
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
This revised candidate preserves legacy ACL/policies; its rollout does not require
an ACL rewrite on rollback. Do not apply the older pre-correction Inventory SQL
that tightened those grants. Prefer a compatible application rollback, then fix
forward. Never purge queues or identities.

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

## Read-only production preflight — 10 November

Vercel team consent was restored on 10 November. Read-only connector checks confirm
RailCommand project `prj_AKXr0Bz4LLmh3mWBwwbp1nQRvKfw` in team
`team_s16JIS0pr4dx8WxpQZ6jAD2R`, with verified domain `railcommand.io` pointing to
production deployment `dpl_3YwL8jBF7B4yW8BiPXBmoxjt1WLy` (READY). Its source is
`main` at `701849744457b529a7eaa292415a4b4867e11d4e`, matching this candidate's
base. Inventory Beta has not been deployed. Public HTTPS GET checks returned 200
for `/` and `/login`; unauthenticated `/api/mobile/v1/bootstrap` and
`/api/mobile/v1/app-release` returned 401 with `Cache-Control: no-store, max-age=0`.
These are identity and anonymous smoke checks, not authenticated workflow acceptance.

Supabase access is now restored to the correct **Railcommand** organization
(`ffzboakthmscpmrhafnv`) and **RailCommand** production project
(`gwvftrrknusdfdgiwuij`, ACTIVE_HEALTHY, PostgreSQL 17, us-west-2). The existing
connection was reauthorized after the user explicitly approved its standard
read/write OAuth scopes. All subsequent operations in this task were reads;
no API keys/secrets were retrieved and no general plugin permission mode changed.

The checks used `BEGIN READ ONLY` and an eight-second statement timeout, with
`transaction_read_only = on` confirmed. Only schema/ACL/function metadata and
aggregate counts were read; no customer record contents were exported. Findings:

- All 42 public tables have RLS enabled. There are zero Inventory tables, no
  `inventory_private` schema, no Inventory object/constraint name collisions and
  no `project_finance` or `milestone_finance` projection functions. The project
  and milestone projection columns required by the candidate are present.
- There are 19 recorded migrations, ending at `20261030173344_dfr_photo_captions`.
  None of the seven reviewed Inventory/preparation files is recorded. Do not
  replay the caption migration or infer that a later version includes the feature.
- Existing daily-log create, original/v2 photo sync and checked-edit function
  bodies match the latest corresponding candidate migration source, ignoring
  whitespace. Signatures and explicit authenticated grants remain present.
  No write RPC was invoked; this is static compatibility evidence, not a live
  authenticated sync or queued-client upgrade test.
- Aggregate baseline: 16 projects, 28 profiles, 35 memberships, 120 daily logs,
  125 milestones and five change orders at observation time. No orphan/duplicate
  memberships or null project IDs on milestones/change orders were found.
  These counts are not a full data backup or proof that all values are valid.
- **INV-REL-01 — backup/restore gate, open:** the organization is on the Free
  plan. The project's backup page explicitly says scheduled backups are not
  included; the overview reports no backups. A fresh private no-cost local
  logical backup and isolated restore verification are still required before
  any production migration. No upgrade, paid branch or backup purchase occurred.
- **INV-REL-02 — original organization finding, resolved locally:** six existing
  editable memberships would have failed the earlier candidate's same-org predicate:
  four manager memberships with a different profile organization, one manager
  membership whose profile organization is missing, and one superintendent
  membership with a different organization. Their project organizations are not
  marked as demos. Five are different-organization relationships, one is missing
  profile organization; no project organization is missing. Do not reassign,
  remove or automatically repair these memberships. Establish whether these are
  valid invited collaborators rather than rewriting their profile organization.
  The correction below preserves their membership and existing access. A successful
  DDL rehearsal alone would have missed the original access loss.
- **INV-REL-03 — inherited privilege review, open:** security advisors flag three
  anonymous-callable reporting helpers, 15 authenticated SECURITY DEFINER
  functions, and disabled leaked-password protection. Two anonymous reporting
  helpers constrain rows to `auth.uid()`; the third is a trigger function. Their
  presence alone does not demonstrate a public data leak. All three no-policy
  tables have RLS enabled; `email_events` is service-role-only. Separately, current
  authenticated ACLs include TRUNCATE on 37 public tables. RLS does not protect
  TRUNCATE; this catalog finding does not establish an exposed HTTP truncate
  endpoint. Review narrowly without blanket revokes that could break clients.
  [Anonymous helper guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
  [authenticated helper guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
  [password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Health advisor returned no findings. Existing performance notices include 34
  unindexed foreign keys, 111 auth/RLS init-plan notices, 103 unused indexes and
  63 multiple-permissive-policy notices. These are inherited observations, not
  Inventory regressions or a reason for an unrelated database overhaul.

Private metadata-only evidence is in
`~/Library/Application Support/RailCommand/Phase1Local/private/preflight/20261110/metadata-only.json`
(directory 0700, file 0600). It contains schema definitions, aggregate counts and
advisors, not a restoreable application-data backup. The original dirty checkout's
branch, HEAD, main, status and binary diff still match its preparation baseline.

**Release decision: hold.** Account reconnection and read-only inspection are
complete; the organization correction is implemented and tested locally. Actual
production backup/restore acceptance, privilege review, independent release review
and physical acceptance remain open. The checks did not mutate hosted rows, grants, policies or schema,
resume an inactive project, add costs, touch installed apps, merge, push or deploy.
Application web/mobile/offline impact and existing draft/queue behavior remain as
recorded above; this checkpoint changes documentation only.

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


## Local organization correction and backup preparation

The current `feature/inventory-beta-release` source fixes INV-REL-02 without
changing any production profile, organization or membership. All seven Inventory
files were confirmed **unapplied on production** before these source corrections;
no shipped migration was edited. Existing persistent Phase1 databases were not
migrated or reset. Do not replay revised migration history into an already-upgraded
local database; use a separately reviewed forward upgrade if that runtime is needed.

- Explicit project membership controls Inventory access, actor choices, lead/PM
  assignments and Supply Chain eligibility, independent of profile organization.
  Project-specific role, current `can_edit`, distinct people and ordered approval
  checks remain. Missing membership, revoked editing and nonmember projects deny.
- Organization-wide policy/cost-access/SC assignment administration still requires
  this project's organization's admin with editable project membership. A global
  admin from another organization does not inherit those powers.
- The candidate preserves existing projects/milestones/change-order/activity ACLs
  and RLS exactly. Project/milestone projections use SECURITY INVOKER and existing
  row/column privileges. New Inventory finance remains restricted independently;
  field Inventory snapshots still contain no finance. This does not retrofit new
  finance restrictions onto the older project's already-authorized API surface.
- Profile organization changes alone are no longer treated as project membership
  revocation. Real membership/edit revocation still revalidates after lock waits;
  all approver profiles are locked through their project membership, including
  external collaborators. No invitations, memberships or profile values are rewritten.

Passed after this correction: `npm run build`; `npx tsc --noEmit`; 44 Inventory
unit tests; 317 mobile-backend tests; real PostgreSQL initial/settlement, contract/
profile/delivered-price, catalogue and finance-bridge suites; static grant gate and
all three disposable grant fixtures. The catalogue suite runs the complete CSV,
fractional receiving and >$50k/Supply Chain/split workflow with a cross-org PM,
cross-org Supply Chain approver and missing-org lead, and asserts unchanged legacy
ACLs and policies. Foreign-admin denial and null-org manager continuity pass.
Targeted ESLint has zero errors and three existing warnings.

The new `scripts/test-inventory-backup-restore.mjs` passes a real, network-isolated
PostgreSQL dump/restore rehearsal with synthetic records and verifies values/UUIDs,
fractions, memberships, ACL/RLS/functions/constraints/history and denied access.
**No production data was backed up or restored.** The exact remaining capture and
isolated Supabase-compatible restore procedure, credential handling, consistent
snapshot requirements and storage/encryption limits are in
[the no-cost backup/restore checklist](INVENTORY_BACKUP_RESTORE_CHECK.md).
The real capture needs an existing DB password entered privately and the public
project CA; do not reset a password, create a hosted role or buy infrastructure.

Impact of this correction: web and native use the same existing Inventory RPCs;
no UI, bundled client, API payload, invitation or authentication changes. A new
mobile binary is not required for this backend access correction itself (the
original native Inventory UI release still needs its signed build). Offline
classification stays **read-only synchronized stock / durable request drafts /
online-only receiving, costs, CSV and approvals**. Cache scope, draft versions,
UUIDs/idempotency keys and outboxes are unchanged; current project permissions are
revalidated on retry. Database tests cover the shared web/native command contract,
not a new physical-device run. Production-data migration rehearsal remains a gate.
