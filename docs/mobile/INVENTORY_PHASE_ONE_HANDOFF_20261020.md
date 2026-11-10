# Phase 1 inventory and approval implementation — 20 October 2026

This is a local implementation handoff for TIA-P1, following the approved Phase 1 plan. It is not live-pilot acceptance, deployment authorization, or a mobile-distribution record. No hosted database was changed; nothing was pushed, merged, deployed, uploaded, or assigned to testers.

## Platform and API impact

- Web: project navigation now includes Inventory. The authenticated screen covers accepted stock, request drafts, quantity/location/reason, counts/recounts, lead verification, distinct PM authorization, rejection/cancellation/rebase, immutable revision evidence, and role-scoped manual cost, source, budget/CO and unconfirmed configuration review.
- Native: committed Expo source from `75d9145e47b9d7986eab495fe47621d20a7c190f` is integrated locally. More → Inventory opens an actual native Field screen using the same typed API/controller, with SQLite drafts and the corresponding operational/authorized financial views and controls. It is not an external web link.
- Shared domain/API: additive inventory DTOs, exact Wendy bucket keys, isolated example calculations, funding evaluation, operation-receipt lifecycle, and typed mobile inventory methods. The committed native `createWorkspaceSession` method was reconciled additively into the canonical API client. Existing supported routes, session/pilot/allowlist/RailBot behavior and daily-log/photo operation formats remain; bootstrap finance fields remain optional and are omitted for restricted roles.
- Database: `supabase/migrations/20261020161326_inventory_phase_one.sql` contains the feature's tables, minimum grants/RLS, internal predicates, immutable evidence, and authenticated read/execute/receipt RPCs together. A project/lot/request lock order and per-account/operation lock serialize posting. Actor IDs come from `auth.uid()`, current membership and organization boundaries are rechecked, and there is no admin or shared-account approval exception.
- Existing finance reads: project/milestone direct SELECT privileges are limited to explicit operational columns. Strict budget-role RPCs supply authorized money. A restrictive change-order read policy and the existing change-order activity-description boundary protect commercial evidence. Web project/schedule/dashboard, mobile bootstrap and RailBot reads use the safe projections; this is intentionally coordinated with the new grants.

## Offline classification and lifecycle

Field input is **offline draft/queue classification, draft only**. Web uses the committed user-scoped IndexedDB foundation from `650d144e38c13f609d77f2a426c785fe03f4cc65`; native extends the existing account-scoped SQLite `record_drafts` and `cache_records` tables. Lot, quantity, work location, reason, UUID and versions persist before “Saved on this device.” No inventory automatic outbox, Background Sync, arbitrary Server Action replay or material attachment queue was added.

Cached quantities/status are **offline read-only**, carry an as-of time, and never authorize posting. The neutral static service-worker fallback can explicitly open/edit saved inventory drafts, with no identity or project content shown before the user opens them. Cache Storage holds public assets only. Private operational cache is partitioned by user.

Submission and decisions are **online-only**. Exact operational pending command and operation UUID are saved first; a lost response remains unknown until receipt lookup or an explicit retry of that same operation. No new UUID is silently substituted. Storage/quota errors preserve current input and the last complete saved snapshot. Web sign-out inspects existing drafts/outbox and requires two discard confirmations when work remains; native's existing guard includes the new record drafts. Existing log/photo rows, identities, conflicts and blobs are not migrated or purged. Legacy financial cache sanitation modifies only cache records, preserving unsent work.

Finance is **online-only**. Financial editor input stays in the current account's memory across connectivity loss, and original expected cost/configuration versions remain pinned until an explicit review/rebase. Rates/threshold proposals stay unconfirmed and never affect operational calculations or the two required approvals. Monetary inputs are not written into device cache. An ambiguous financial edit or private rejection/cancellation decision retains its receipt identity and allowlisted original request/lot scope and versions across a process restart. The app can check the original receipt or explicitly settle that same identity online without replaying forgotten private values. This is distinct from the fully durable field-submit/approval command lifecycle.

## Cost, stock and budget rules

The eleven keys are `log`, `mill`, `trucking`, `treating`, `drying`, `creosote`, `rail_car`, `install_labour`, `inspection`, `carrying_cost`, `disposal`. Manual components retain status/source; unknown amounts stay null/incomplete. Supplier drying is 4–10 calendar months and separate from yard age. Creosote uses a manual oil-linked quote/reference snapshot; no live feed or repricing exists. The age review uses the plan's provisional 60-day condition and shows unknown age separately; it is not an activated financial threshold.

Configuration starts with null rates/thresholds/currency/bands and `unconfirmed` status. Proposed draft numbers can be entered, versioned and reviewed, but cannot be activated. An explicit isolated example gives 68,000 acquisition, 2,694.25 holding, 70,694.25 acquisition plus holding and 112,694.25 installed basic, without writing any operating record.

Every issue requires requester → assigned inventory lead → different assigned eligible PM before release. The requester cannot approve, and the verifier cannot give final authorization. Stock must be ready and inspection accepted. Recounts are observations, not ledger adjustments. Final authorization creates one movement atomically with state/event/receipt. Revisions, rejected/denied decisions and counts remain inspectable; posted ledger/evidence cannot be edited/deleted by application roles.

Budget/source evidence is restricted to existing budget roles, independently of inventory-lead assignment. Base budget plus each signed approved CO is counted once. Funded/committed stock adds zero new spend; unknown funding holds. Distinct new exposure is recognized once across linked material lines, and immutable request-finance snapshots prevent later cost revisions from rewriting posted exposure. A changed cost, budget/CO, configuration, assignment or lot baseline forces explicit review/rebase and both approvals again. Optional milestone/CO links have same-project database constraints.

## Local verification and limits

Required local checks passed: root production build and standalone TypeScript; 467 web/shared/offline/mobile-backend Mocha cases; 245 native Mocha cases and native typecheck; local production iOS Hermes export; real disposable PostgreSQL inventory/grants/RLS/concurrency/rollback/receipt tests; the existing 9 grant-unit cases and preview/reset/legacy-default disposable scenarios; grant static check; mobile parity inventory; actual Chromium/IndexedDB/service-worker/UI smoke; focused lint (0 errors, 6 deliberate omitted-value variable warnings).

The browser test renders the actual production component and uses actual persistent Chromium IndexedDB and the real static worker. Its identities and HTTP transport are isolated synthetic fixtures. The typed mobile client shares those synthetic records to exercise both visibility directions. This does **not** establish hosted Supabase or device acceptance. Database evidence comes separately from real PostgreSQL roles/RLS and transactions using synthetic data and the canonical legacy SELECT policies. Native persistence tests use actual SQLite through the production store adapter and a mocked Expo bridge; they do not replace an iPhone restart test. The screenshot is `/tmp/tia-inventory-phone.png`.

Reproducible commands and the exact reviewed source SHA are recorded in `.codex-loop/reports/TIA-P1/build.md`. Root test-only additions are pinned Playwright 1.64.1 and fake-indexeddb 6.2.5; runtime web dependencies are unchanged. Native-only `expo-asset` is pinned by override to SDK-57's 57.0.20 because an unconstrained transitive dependency selected SDK 58 and failed bundling.

## Release and rollback gates — pending

- Mark's introduction, Spike Sambol's actual participation/consent, named project/yard/material/lot, the foreman/lead/distinct PM roster/backups, and pilot dates are unverified.
- Record the actual currently installed TestFlight build, iOS version and device model. That binary is the regression baseline, not evidence that these new Field screens are installed.
- A newly signed iOS successor and actual TestFlight assignment/install are required. This local export is neither signing nor distribution. There is no configured OTA mechanism.
- Physical iOS restart, network flapping, permission denial, finance isolation, safe sign-out, and bidirectional web/native pilot acceptance remain required. Android/additional models remain TIA-05A before expansion.
- Hosted migration, source/grant review, backend/web deployment, designated synthetic hosted acceptance fixtures and rollback approval remain pending. No live fixture, invitation or production change occurred here.

Schema and column-safe backend reads must be released together. An old web/backend build that still selects raw financial columns cannot simply be rolled back against the narrowed grants. Keep the safe projections in any rollback, disable new inventory writes/navigation if needed, retain evidence/receipts and preserve device drafts/old queues. Do not restore broad finance grants or delete ledger rows as a rollback. Phase 2 procurement/receiving/transfers/split detection/outbox and Phase 3 lifecycle/retention/export/investigation remain out of scope.


## Bounded privacy correction after independent Review (R1/R2)

Operational device snapshots now use an explicit allowlist of event classes and
fields, with no event reasons and no cost/configuration events. Authorized online
snapshots retain full evidence only in current-account memory. Web IndexedDB and
native SQLite apply the projection on every cache write and repair legacy rows
on read; web's selective finance sanitizer applies the same boundary. Repairs
preserve field drafts, daily-log/photo outboxes, blobs and original operation IDs.
Unknown future event classes remain online until reviewed for offline inclusion.

Rejection and cancellation reasons are private decision evidence, matching the
server's event boundary. Their pending payloads join cost/configuration in
receipt-only device persistence. Operational submit/revise/count input and ordinary
verify/authorize payloads retain their exact durable retry behavior. An active
session still holds the original private input in memory. After restart, the
original UUID/action and allowlisted original scope/versions remain, with no
commercial payload. Redacted payload replay stays disabled. A null receipt alone
never unlocks work. Both UIs offer **Resolve original operation online**: the
additive `inventory_settle(project, operation)` RPC authenticates the current
actor, checks current same-organization project membership and write permission,
and takes the identical actor/UUID transaction advisory lock as execution. If the
original won, it returns that original immutable receipt. Otherwise it writes an
immutable `operation_not_applied` receipt before releasing the lock. A late
original then conflicts and cannot mutate stock/evidence. Only the durable receipt
unlocks preserved ordinary field work. Lost settlement responses retain the same
identity for receipt lookup/repeated settlement. Existing minimal receipt envelopes
settle without inventing scope or versions from a new snapshot. Changed-payload
conflicts retrieve the original receipt instead of clearing pending state.

The additive local migration `20261020172309_inventory_operation_settlement.sql`
must be deployed with the new server/API behavior before the client resolve control
is released. Existing execute/receipt signatures and old v1 requests remain intact;
new `settle` HTTP commands route to the dedicated RPC. No hosted migration ran.
Rolling back the resolve UI/server can leave the additive immutable receipt RPC in
place; never delete resolved receipts or retry those identities as fresh work.
Settlement is explicit and online-only; it is not a material outbox. New decisions
after a never-applied receipt require review of current data and use ordinary new
operation identities only after the old identity is durably resolved.

Committed regressions cover the exact commercial reason in raw Chromium IndexedDB
and on-disk SQLite, legacy sanitation and reopen/role downgrade, authorized online
evidence, lost responses, original receipt lookup and changed-payload prevention.
The disposable PostgreSQL test also verifies authorized reason retention, field
omission and permanent UUID/digest conflict protection. The settlement migration adds one narrowly granted RPC; no hosted data,
rate/threshold confirmation, existing installed-client payload contract or old queue
format changed. A new signed mobile build remains required; the prior physical/hosted/pilot
release gates above remain pending.

## R3 correction verification

Controller, actual Chromium/IndexedDB, and actual on-disk SQLite regressions cover
pre-execution loss, full restart, original scope/version retention, private-value
absence, legacy minimal envelopes, explicit same-identity resolution, and resumed
ordinary draft editing/actions. Real disposable PostgreSQL uses two connections and
a pre-commit barrier to prove both original-first and settlement-first lock orders
for reject, cancel, cost and configuration, plus changed-payload conflict recovery,
permission revocation and foreign-project denial. Accepted-response-lost and old
field/log/photo regression coverage remains. Exact results are in the current Build
report. This is local coding evidence; all signed-device/hosted/pilot gates above
remain pending and a new independent Review is mandatory.
