# True material cost, inventory and approval trail

**Draft specification • 20 October 2026 • plan and wireframes only**
Meeting basis: the user's summary of the 13 October meeting with Mark and Wendy at A5. No transcript, supplier quotation or A5 policy was supplied. All examples below are synthetic. Proposed thresholds, rates and role assignments require confirmation; none are presented as meeting decisions.

Planning branch: `codex/tco-inventory-audit-plan`, based on freshly fetched `origin/main` at `ffc83187500019592907493ecf03d084a38fdc47`. Work takes place in a separate managed worktree. The dirty `codex/offline-foundation-day-1` checkout and separate native checkout are read-only inputs. This change adds documentation and static prototypes only: no app code, migrations, live database, main, PR or merge changes. The authorized final action is committing and pushing this branch. After review of the existing automatic Vercel Git integration, the user explicitly permitted a deployment of this branch on 20 October, while retaining the no-merge instruction. The push may therefore create an automatic preview; no deployment guard or project-setting change is added, and no manual production deployment is requested.

## 1. Outcome and scope

Give a track crew a simple way to request ties from a known yard, give an inventory lead a reliable quantity/location/age view, and give authorized managers a defensible account of true cost and who approved each action. Wendy's priority is the traceable approval trail. “TCO” belongs only in purchasing/executive views. This feature must reach **both the web application and the native mobile application**; a responsive web page alone does not complete native Field tools.

### Phase 1: one useful pilot slice

One invited project, one yard, one tie material and one opening lot; a crew foreman requests an issue of stock to a work location, an assigned inventory lead verifies it, and a different assigned project manager authorizes it. The requester, verifier and final approver are three different named people. The two primary testers are the crew and inventory lead; use one existing invited manager for a short final-approval session. If that person is unavailable, the request remains waiting rather than bypassing a step.

Seed an opening balance through an authorized, audited acceptance operation; do not build a receiving/procurement system first. Show a basic material cost estimate, storage/capital carrying estimate, approved balance, age and manual count discrepancy. Pending requests are visible separately. No stock is consumed until final authorization; the pilot therefore requires approval **before physical release**. Record an observed early release as a discrepancy, never fabricate a prior approval.

The first-week pilot is five days of use after the security, draft-persistence and device gates below pass. Aim for 20 minutes of onboarding, one request under two minutes, each approval under one minute and a daily five-minute stock check. This is a small validation exercise, not a promise that all three phases can be engineered or store-approved in a week. If “within a week” means delivery from today, confirm it in Q1: the missing web offline foundation and physical-device distribution are real prerequisites.

Pilot week: day 1 confirm invites, opening count and cost basis; day 2 request/check/authorize the first issue; day 3 restore a field draft after an offline restart; day 4 exercise denied/stale/duplicate outcomes; day 5 reconcile stock and review the evidence with Wendy. Use the same short script on web and native; no additional beta cohort is required.

Success: one crew and one inventory lead complete ten synthetic/designated-pilot requests without lost drafts or duplicate issues; an existing manager completes final approvals; an observer can reconstruct each request from actor, time, exact revision and stock outcome. One explicit rejection and one stock-count discrepancy are exercised. Production pilot records are never disposable test fixtures.

### Phases 2 and 3

| Phase | User outcome | Included | Explicit boundary |
| --- | --- | --- | --- |
| 1 — ties pilot | Request, verify, approve and reconcile one stock issue on web and native | Opening lot, issue requests, two ordered approvals, plain quantity view, basic cost/storage/capital estimates, age/count flags, finance authorization, durable field drafts | No purchase ordering, supplier integration, cross-project transfer, material upload or automatic offline submission |
| 2 — purchasing and controls | Follow spending/change orders and more inventory movements through one trail | Existing change-order adapter; purchase/spend requests; receipts, returns, transfers, adjustments; threshold policies; split-purchase review; partial delivery; full cost component allocation and actual-vs-estimate reconciliation; inventory-request outbox | No replacement of existing accounting/payroll systems; no claim of automatic fraud determination |
| 3 — lifecycle and assurance | Compare ownership choices and investigate the portfolio | Maintenance/replacement/disposal/salvage forecasts, optional discounted scenarios, approved carrying-rate versions, portfolio drill-down, tamper-evidence exports, independent review of overrides | No certified accounting valuation, immutable external archive or predictive fraud promise without separate validation |

The full requested feature is delivered across these three phases. Phase 1 does **not** claim to have spending/change-order approval routing, split-purchase detection or lifecycle forecasting implemented. Those are tracked by TIA-06 through TIA-09, and are clearly labeled in the wireframes.

## 2. Repository evidence and reuse

These are source findings, not claims about inspected live grants or currently installed app versions.

| Existing area | Evidence | Reuse / necessary delta |
| --- | --- | --- |
| Finance permissions | [`src/lib/permissions.ts`](../../src/lib/permissions.ts), [`permissions-helper.ts`](../../src/lib/actions/permissions-helper.ts) | `budget:view` belongs to manager, superintendent, engineer and owner; `change_order:manage` excludes owner. Org admin currently bypasses helper checks. Inventory lead and purchaser are **assignments**, not existing role enum values. Preserve role restrictions; do not grant budget access merely because somebody handles stock. |
| Change orders | [`change-orders.ts`](../../src/lib/actions/change-orders.ts), [creation SQL](../migrations/2026-04-12_change_orders.sql), [`schedule/page.tsx`](../../src/app/(app)/projects/[id]/schedule/page.tsx) | Current update directly sets `approved_by`/`approval_date` when status is approved. There is one approver, editable status and deletion, not a sequential ledger. Preserve IDs/numbers/milestone links; Phase 2 routes in-scope transitions through the new engine and closes old/direct write paths. |
| Budget | [`dashboard.ts`](../../src/lib/actions/dashboard.ts), [`dashboard/page.tsx`](../../src/app/(app)/dashboard/page.tsx), [`types.ts`](../../src/lib/types.ts) | Existing adjusted budget is `projects.budget_total + approved change_orders.amount`; spent comes from `projects.budget_spent`. Milestone planned/actual values also exist. Reuse these baselines; no authoritative procurement ledger exists in inspected source. |
| Activity history | [`activity-log.ts`](../../src/lib/actions/activity-log.ts), [`permissions-helper.ts`](../../src/lib/actions/permissions-helper.ts), [historical schema](../../supabase/schema_snapshot.sql) | Reuse activity feed navigation and redacted summaries. Current actions call `logActivity` after the mutation; this is not proof of atomic approval evidence. New events must commit with the domain transition. The historical snapshot is not a current bootstrap or live-policy attestation. |
| Financial RLS precedent | [`20260730170000_up_weekly_reporting_foundation.sql`](../../supabase/migrations/20260730170000_up_weekly_reporting_foundation.sql) | Reuse the project/org boundary and finance-role meaning, not every historical function privilege. Check minimum grants together with RLS. |
| Invitations | [`invitations.ts`](../../src/lib/actions/invitations.ts), [`onboarding.ts`](../../src/lib/actions/onboarding.ts), mobile invitation route | Reuse individual invite-link onboarding and project membership. No master/shared login, automatic approver account or expanded signup flow. Existing owner assignment is limited by `project-roles.ts`; do not add a new path around that rule. |
| Shared contracts | [`packages/domain/src/index.ts`](../../packages/domain/src/index.ts), [`packages/api-client/src/index.ts`](../../packages/api-client/src/index.ts), [`src/app/api/mobile/v1`](../../src/app/api/mobile/v1) | Add typed, additive contracts and common validation; web actions and bearer-authenticated native routes call the same services. Preserve existing v1 routes, mobile pilot gate, session bridge, RailBot and sync behavior. |
| Native source | Separate read-only checkout `.mobile-recovery/candidate`, branch `codex/mobile-beta-20260910`, inspected HEAD `75d9145e47b9d7986eab495fe47621d20a7c190f` | `apps/mobile/src/app`, `src/lib/offline-store.ts`, `src/providers/mobile-data-provider.tsx`, shared packages. SQLite is user/profile scoped. New native inventory list, request, status and approver navigation require bundled changes and signed builds. This checkout is not merged or modified by this plan. |
| Web offline source gap | AGENTS describes `src/lib/offline/storage.ts` on offline development; **that file is absent at this origin/main baseline** | TIA-00 must integrate an independently reviewed committed foundation before adding web private drafts. Do not import the user's uncommitted branch wholesale or pretend the foundation is already on main. |

### Release-blocking privacy finding for this feature

UI hiding is insufficient. `getChangeOrders` and the dashboard action authorize membership before reading monetary values; `/api/mobile/v1/bootstrap` populates `budgetTotal` and `budgetSpent` without a `budget:view` check. The inspected native dashboard reads those bootstrap values. TIA-01 must inspect their underlying grants/RLS and all related project/schedule/activity/export/RailBot read paths in a designated test environment, then protect monetary data at the server and database boundary. Do not claim this plan repaired the existing behavior.

The field projection must contain no prices, cost rates, carrying amounts, budgets, thresholds or financial audit evidence in JSON, hidden DOM, accessibility labels, exports, logs or offline caches. Cache upgrades must selectively remove previously cached finance fields for a restricted user while preserving all unrelated drafts and queued operations. An older native UI may show its existing zero/“Restricted” fallback when optional finance fields are omitted; verify the actual supported binaries before rollout.

## 3. Web, native and shared implementation map

| Capability | Web application | Native mobile application | Shared contract / release |
| --- | --- | --- | --- |
| Inventory | Project Materials/Inventory list, quantity/location/age and filtered costs | Native Field Materials list and cached lot detail; manager may also use the online Workspace | One stock projection and permission model; foreground/manual refresh after mutations |
| Request issue | Responsive quantity/work-location form; user-scoped IndexedDB draft | Native form, user-scoped SQLite draft; Field entry does not depend on WebView | One request schema, client UUID, baseline and receipt lookup; P1 submission online-only |
| Approval queue/trail | Assigned-step queue and immutable timeline | Native assigned-step queue/detail and same decisions; online Workspace mirrors authorized web behavior | Same ordered state machine and server events; no separate native business rules |
| True cost / TCO | Material detail, project roll-up; vocabulary depends on audience | Authorized manager/purchaser cost summary/detail in native navigation, with matching totals; same pages usable in online Workspace | Explicit finance DTO, never attached to field payload; P1 basic estimate, P2 full allocation, P3 lifecycle |
| Audit flags | Dashboard evidence cards and authorized detail | Native dashboard cards with role-safe evidence and links into native detail; restricted crew sees only stock/request problems | Same flag IDs/rules, scope and acknowledgement events |

Native manager summaries need not reproduce wide desktop tables; they must expose the same authorized values, sources, revision and actions. All six HTML screens reflow for mobile review; the crew screen separately depicts the native Field flow. HTML is an interaction specification, not an Expo implementation or device acceptance.

## 4. Proposed data model and RLS

Names are proposals; future schema work needs its own reviewed migrations. Use UUID identities, server timestamps (`timestamptz` UTC, displayed in project time zone), a currency per project, canonical units and numeric decimal quantities/rates. Reject negative/NaN/infinite amounts except explicit credit/reversal types. Store money as integer minor units or `numeric(18,2)` with a single shared rounding rule; calculations retain higher precision until final allocation. Do not use binary floating point for posted monetary totals.

### Entities and invariants

| Object / phase | Core fields / relationships | Invariants |
| --- | --- | --- |
| `materials`, `stock_locations` / 1 | `id, organization_id, project_id, code, name, canonical_unit, active`; location name and work-location reference | Unique code per project, no prices in field-readable rows. P1 unit = tie (`each`), no unit conversion. |
| `inventory_lots` / 1 | `id, project_id, material_id, location_id, received_at, age_source, version`; receipt reference; opening quantity derived from ledger | A lot is one receipt cohort; retain original age on transfers/returns. Unknown receipt date = “Age unknown”, never zero age. P1 opening balance is audited, dual-reviewed setup. |
| `inventory_movements` / 1 then 2 | Append-only `id, project_id, lot_id, request_id, kind, signed_quantity, posted_at, effective_at, actor_id, reversal_of`; P2 paired transfer legs | P1 opening and approved issue only. Unique posting per request/revision; sum posted legs = on-hand. Pending requests are not posted or silently reserved. Lock lot at final approval; reject insufficient stock. No negative balance. |
| `material_cost_revisions`, `material_cost_components` / 1 then 2 | Restricted revision ID, project/lot/material line, quantity basis, unit price; component category, amount, actual/estimate/commitment, source reference, allocation basis and effective time | P1 manually entered unit/freight/handling/storage/capital assumptions. A submitted request pins the revision; edits create a new revision and require reapproval. P2 full line allocation and actual reconciliation. |
| `carrying_rate_versions` / 1 then 3 | Project/material/location, validity interval, per-unit daily storage, annual capital/shrink/obsolescence rates, valuation basis, author/approver | No overlapping effective rates; P1 only storage/capital enabled. Missing rate = incomplete, not zero. Rates are not accounting/fiscal policy until approved. |
| `approval_policies`, `approval_policy_steps`, `approval_assignments` / 1 then 2 | Versioned project, request type, currency, threshold basis/bands; ordered step eligibility and named assignments | P1 fixed inventory check → manager authorization on every issue. No configurable threshold editor. P2 policy snapshots; threshold bands have complete, non-overlapping boundaries. |
| `approval_requests`, `approval_request_revisions` / 1 then 2 | Request ID, server number, project, submitter, target lot and quantity/location, pinned immutable payload revision, policy/cost/budget versions; P2 link existing `change_order_id` or spend request | Mutable draft has a version; submitted revision is immutable. Separate operational fields from restricted commercial payload. Requester must be actual authenticated actor. A missing change order never becomes a fabricated one. |
| `approval_events` / 1 | `id, request_id, revision_id, project_id, sequence, step, event_type, actor_id, actor_role_snapshot, server_received_at, client_occurred_at, operation_id, reason, previous_event_id`; restricted evidence stored separately | Unique `(request_id, sequence)` and `(actor_id, operation_id)`. Append only: submitted, approved-step, rejected, returned, superseded, canceled, posted, blocked-attempt, reassigned. Server time determines ordering; client time is contextual. |
| `stock_counts`, `audit_flags`, `audit_flag_events` / 1 then 2 | Count observation, lot baseline/version, counted quantity, observer/time; flag type, rule version, evidence references, severity, owner; append-only acknowledged/resolved/reopened events | Counts do not adjust stock. Same finding deduplicates by project/type/evidence; resolution preserves original evidence. P1 differences require investigation; P2 authorized adjustment creates compensating ledger entry. |
| `request_receipts` / 1 | User/project/operation UUID, payload digest, request/result IDs, result code and accepted version | Same operation + same payload returns same receipt. Same key + different payload is a conflict. Business receipt and posting commit in one transaction. No expiring identity permits replay duplicates. |

Every child uses project-scoped composite foreign keys, such as `(lot_id, project_id)`, and org/project consistency checks. A forged cross-project ID cannot attach evidence or stock to another project. Use restrictive deletion for requests, events, posted movements and linked costs; archiving a project must retain required evidence rather than cascade it away. Historical profile deletion can null the live profile reference while retaining a minimal stable actor ID/role snapshot per the approved retention policy; do not store email addresses unnecessarily.

Indexes: `(project_id, material_id, location_id)` for stock, `(project_id, received_at)` for age, `(lot_id, posted_at, id)` for ledger, `(project_id, state, current_step)` for queues, `(request_id, sequence)` for trails and `(project_id, supplier_id, category_id, submitted_at)` for Phase 2 split review. Index membership/assignment predicates. Recompute projections from the ledger and reconcile them; totals are not client-editable columns.

### Authorization and write boundary

| Caller | Operational stock / own request status | Cost, budget and commercial evidence | Writes |
| --- | --- | --- | --- |
| Anonymous, uninvited, wrong project/org, revoked member | Denied | Denied | Denied |
| Invited crew member with explicit request capability | Assigned-project quantities, locations, age, own/crew-authorized status | Denied, including indirect aggregates and finance event reasons | Own drafts and issue submissions; count observations if assigned; no approvals |
| Assigned inventory lead | Project stock and assigned verification evidence | Only if existing `budget:view` independently allows it | Current inventory-check step; never own request or another person's final step |
| Existing finance viewer (`budget:view`) | Project read scope | Authorized project costs, rates, budgets and financial flags | Read-only unless separately eligible to submit/manage/approve |
| Assigned manager approver with existing management permission | Assigned request/stock scope | Requires `budget:view` for monetary review | Current final step only; cannot approve own submission or both stages |
| Org admin / support | Existing org support scope assessed in TIA-01 | No new cross-org reach | No bypass of separation-of-duties, sequence or immutable-event rules; reassignment is recorded |

Enable RLS and minimum role-specific grants in the same table-creation migration. RLS filters rows, not sensitive columns; separate operational and financial tables/projections. No anonymous grants. Client roles get only intended SELECT access and narrowly scoped draft writes; revoke direct event/movement/posted-state mutations. RLS SELECT checks current membership, project/org consistency, relevant capability and for finance the existing budget role; draft UPDATE checks both `USING` and `WITH CHECK`, immutable scope and ownership. A role name or user-editable JWT metadata is not an authorization decision. Views must preserve caller restrictions. See [Supabase RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security).

Prefer SECURITY INVOKER for read/draft operations. **Do not specify an invoker RPC that requires table writes revoked from its caller.** For atomic append-only posting, propose a minimal privileged executor in a non-exposed private schema, owned by a dedicated non-login role with only required access, behind a reviewed public invoker wrapper. Deny default PUBLIC/anon EXECUTE, pin empty search paths, schema-qualify relations, derive actor from `auth.uid()` and explicitly recheck membership/assignment/sequence within the executor. Because privileged execution can bypass RLS, its predicates and grants require direct adversarial database tests; no generic service-role endpoint accepts a client-supplied actor or project authority. Validate this exact wrapper/executor privilege design in disposable PostgreSQL before approving a migration. [Function security guidance](https://supabase.com/docs/guides/database/functions).

All authenticated clients, including old web actions, direct REST calls and RailBot tools, must be unable to mutate pilot posting/event tables outside that boundary. For Phase 2 change orders, protect enrolled records against legacy status updates/deletion **at the database boundary**; UI routing alone is bypassable. Leave legacy un-enrolled records readable with “Legacy approval — staged evidence unavailable”; do not invent past approvals or block unrelated older client workflows. Export reads enforce the same finance scope as screen reads.

## 5. Approval workflow and durable evidence

1. **Draft:** requester enters quantity, lot, destination and reason. Autosave locally; no server commitment or stock reservation. Submitted actor comes from the session.
2. **Submit:** online server validates membership, request capability, positive quantity/unit, available lot, baseline versions, policy completeness and eligible distinct approvers. Server assigns the visible number and snapshots request/policy/cost/budget versions. A draft remains until a receipt confirms acceptance.
3. **Inventory check:** assigned lead confirms quantity, condition and location. A count variance may hold the request. Requester cannot perform this step. One step event commits with its state transition.
4. **Manager authorization:** another assigned manager reviews the exact revision, cost exposure and budget evidence. Recheck current membership, policy eligibility and stock. Same submitter, same prior approver, out-of-order action, stale revision or revoked access is rejected.
5. **Post:** final approval, lot lock, insufficient-stock check, one negative movement, status projection, immutable evidence and receipt commit atomically. Failure rolls back all accepted effects. After commit, invalidate web data and refresh native foreground/manual views; return the posted balance/version.
6. **Return / reject / cancel:** require a reason. Returned requests become a new draft revision; any changed quantity, destination, amount, attachments or cost basis supersedes previous approvals. Rejection is terminal for that revision. Cancel before posting creates a cancellation event. After posting, correct with a linked reversal and new approval, never edit/delete history.

State vocabulary: `draft → awaiting_inventory → awaiting_manager → posted`; alternate `returned`, `rejected`, `canceled`, `superseded`, `held`. Approval states are projections rebuilt from events; clients cannot write them directly. “Approved” is not “posted” if an external Phase 2 system still has to acknowledge execution. P1 posting is local database stock posting and has no external payment effect.

Concurrent final approvals lock request and lot in a consistent order, compare `expected_version`, and return an explicit conflict to the loser. For multi-lot Phase 2 transfers lock sorted lot IDs and post equal/opposite legs atomically. PostgreSQL [row locks](https://www.postgresql.org/docs/current/explicit-locking.html) provide the database mechanism; the request-level expected version remains necessary for the user-facing conflict.

Blocked self/out-of-order attempts need auditable records too: the executor records a minimal **denied-attempt event and typed rejection result in a committed transaction**, without posting or advancing the request. The API converts that result to a denied response. Raising an exception after inserting the event would roll it back. Unknown/unauthorized request probing must not disclose existence; keep its minimal security telemetry outside project-readable history and rate-limit repeated attempts.

Each accepted event records who, server time, previous/next state, policy version, step, immutable request revision, reason, source channel, operation ID and evidence references. Show project time zone and exact UTC time on expansion/export. Request payload hashes identify the approved content; correction/reassignment is another event. No shared accounts; an unavailable approver gets an explicit delegated assignment event from an authorized distinct manager, not identity substitution. P1 has no emergency override: insufficient staffing blocks release.

Existing activity history receives only a safe summary and a trail link through the same transaction or a durable transactional notification outbox. A lost notification cannot lose the evidence or change approval state. Financial values/free-text finance reasons never enter the generally readable activity feed. Append-only means protected against ordinary application roles; a database owner can still alter storage. Phase 3 can add chained event hashes, signed manifests and independently retained exports, with key/retention controls. Do not call Phase 1 “tamper-proof”.

## 6. True cost and carrying calculations

### Definitions and allocation

- Acquisition/landed cost = purchase amount + freight + handling + nonrecoverable tax/duty − supplier credits. Inventory transfers do not create another purchase cost.
- Installed true cost = landed cost allocated to installed work + storage + capital opportunity cost + installation labor/equipment + incremental waste/disposal/rework cost. Distinguish actual booked cash from management estimates/opportunity cost.
- Lifecycle scenario = installed true cost + future maintenance/replacement/disposal − salvage credits. Phase 3 optionally discounts dated future cash flows: `PV = cash_flow / (1 + annual_discount_rate)^(days/365)`. Undiscounted and discounted totals have different labels; never sum both.
- Carrying cost over each interval = `quantity_on_hand × storage_rate_per_unit_day × days + inventory_value × (capital_rate + expected_shrink_rate + obsolescence_rate) × days/365`. Rates are decimal annual rates; day basis is actual/365 including leap years by proposed policy. P1 enables storage and capital only. Damage/shrink and obsolescence are estimated risk components in P2, never booked actual losses automatically.
- Compute intervals at receipts, issues, rate changes and corrections. Use half-open time intervals in project time zone, with fractional-day proration; stop accrual when the last unit leaves. `age_days` uses elapsed whole days from original receipt to as-of time; weighted average and oldest lot age must be labeled separately. Unknown dates/rates produce incomplete estimates. No future-date or negative-duration accrual.
- Carrying valuation proposal = remaining landed acquisition value, excluding storage, capital and lifecycle estimates (no interest on interest). P1 one-lot proportional allocation; Phase 2 FIFO physical lot selection with explicit overrides and documented valuation policy, not an implicit accounting certification.
- Shared shipment cost: assign explicitly by weight, volume, quantity or chosen fixed shares; store basis and input values. Never allocate by quantity across unlike units without a reviewed conversion. Allocation must conserve the invoice amount to the cent; deterministic remainder goes to stable line order. Zero quantity or unknown installed denominator gives “Not available”, never divide by zero.
- Unit “purchase price”, “landed cost”, “true cost per purchased unit” and “true cost per installed unit” are distinct. Waste purchase value is **already inside** acquisition: show the waste attribution, do not add it twice. Replace a risk estimate with actual loss for the same exposure period, rather than stacking both. Returns and credits reference the original entry and reduce the correct bucket.

### Worked tie example — deliberately illustrative USD scenario

Receive **1,000 ties on 21 August** and hold the unchanged lot for **60 days to 20 October**, then install **950** and record **50** as expected installation waste. No interim movements; the real engine integrates interval changes. This full-lot scenario is distinct from the pending 100-tie pilot request. Prices, rates, waste and lifecycle costs are illustrative assumptions, not A5 quotes. No taxes or currency conversion are assumed.

| Component | Basis | USD | Classification / phase |
| --- | --- | ---: | --- |
| Purchase | 1,000 × $50 | 50,000.00 | Recorded acquisition / 1 |
| Freight | One shipment | 12,000.00 | Recorded acquisition / 1 |
| Handling | One lot | 6,000.00 | Recorded acquisition / 1 |
| **Landed acquisition** | Sum above | **68,000.00** | $68 per purchased tie |
| Storage | 1,000 × $0.03 × 60 | 1,800.00 | Estimate / 1 |
| Capital | $68,000 × 8% × 60/365 | 894.25 | Opportunity-cost estimate / 1 |
| **Basic carrying** | Storage + capital | **2,694.25** | Phase 1 estimate; $44.90/day rounded |
| Expected damage/shrink | $68,000 × 2% × 60/365 | 223.56 | Optional risk estimate / 2 |
| Expected obsolescence | $68,000 × 1% × 60/365 | 111.78 | Optional risk estimate / 2 |
| **Carrying including risk** | Basic + two risk terms | **3,029.59** | $50.49/day rounded; distinct from actual loss |
| Installation labor | 950 × $40 | 38,000.00 | Work estimate / 2 |
| Incremental waste/disposal | Flat expense | 1,500.00 | Work estimate / 2; no second tie purchase |
| **Installed true cost, basic** | $68,000 + $2,694.25 + $38,000 + $1,500 | **110,194.25** | $115.99 per installed tie |
| **Installed true cost with risk** | Basic installed + $335.34 risk | **110,529.59** | Do not label as fully booked actual spend |
| Future maintenance/replacement | Undiscounted scenario | 30,000.00 | Lifecycle estimate / 3 |
| Salvage credit | Undiscounted scenario | (5,000.00) | Lifecycle estimate / 3 |
| **Projected lifecycle TCO** | $110,529.59 + $30,000 − $5,000 | **135,529.59** | $135.53/purchased tie; **$142.66/installed tie** |

Acquisition price is 36.89% of projected lifecycle cost; other costs total $85,529.59. The $2,500 purchase-price attribution to the 50 wasted ties is informational and already included in $50,000. The optional annual storage-risk rates cover a separate expected yard exposure, not another charge for those same 50 installation-waste ties. If losses overlap, remove the corresponding estimate before substituting actual loss.

Phase 1's displayed lot subtotal is **$70,694.25 = $68,000 + $2,694.25 basic carrying**; per purchased tie is $70.69. The full $135,529.59 scenario in wireframes is marked Phase 2/3 preview. Recompute using unrounded interval values and round totals to cents. Independent cent-rounded components in this example reconcile exactly.

### Project roll-up and budget flags

Roll material lines up by stable source IDs and revision/as-of time. Each bucket is separate: posted actuals, open commitments, pending requests, remaining forecast and lifecycle. A linked change order changes the authorized budget once; its amount is **not also a cost component** unless it represents a separately sourced cost. A cost entry included in `projects.budget_spent` is mapped to that baseline and excluded from incremental material actuals. Without that reconciliation, label coverage incomplete and do not show an authoritative project total.

Proposed project control forecast = authoritative posted spend + non-overlapping open commitments + remaining forecast + incremental pending exposure (only if not already in another bucket). Adjusted budget = baseline + final-approved change orders. Flag forecast over budget when the comparable **project-control** total exceeds adjusted budget; lifecycle-only amounts must use a separately approved lifecycle budget. Missing reconciliation or a stale baseline produces “Budget comparison incomplete”, never a green all-clear.

Synthetic full-scenario wireframe: a separately labeled lifecycle allowance of $130,000 compared with $135,529.59 yields a **$5,529.59 lifecycle gap**, not an accounting project-spend overrun. Phase 1 issue control example: project-control forecast $126,000 plus a genuinely incremental $6,800 issue exposure against $130,000 adjusted budget yields **$2,800 over**. If that $6,800 was already committed, incremental exposure is zero and the result remains $126,000. Mark/Wendy must confirm attribution and blocking policy before production use.

## 7. Audit rules and follow-through

Flags are review evidence, not accusations. The dashboard shows type, severity, as-of time, exact rule/version, source events, assigned reviewer and status. Acknowledgement/resolution needs an explanation and appends an event; it cannot erase evidence. Crew sees only operational flags. Sensitive rejected-attempt and purchasing patterns require authorized managers/auditors.

| Rule / phase | Deterministic trigger proposal | Behavior and acceptance example |
| --- | --- | --- |
| Budget overrun / 1 | Comparable forecast + nonduplicated incremental exposure > adjusted approved budget | Hold final posting pending a distinct authorized budget revision or a rejected/revised request; P1 has no override. $126k + $6.8k > $130k produces $2.8k evidence. Recheck under project budget lock; do not authorize against a stale total. |
| Out-of-order approval / 1 | Attempted step differs from next eligible step, or prerequisite belongs to another revision | Reject, append denied-attempt evidence, no state/stock change. Step 2 before step 1 fails even via direct API. |
| Self / repeated approver / 1 | Actor equals request submitter or any prior required approver | Reject even for org admin. Show the reason and next eligible person; do not offer “approve anyway”. |
| Aged stock / 1 | Known original lot age ≥ provisional 60 days and on-hand > 0 | Flag the sample at day 60; quantity zero clears current exposure while retaining old evidence. Unknown age gets a separate data-quality flag. Threshold requires Q5. |
| Missing / unexplained stock / 1 | Latest valid physical count differs from ledger at the captured baseline; or required count is overdue | Expected 1,000 vs observed 980 produces 20 unaccounted ties. Hold affected issue until recounted/investigated; do not silently reduce inventory. Provisional count cadence = seven days; pending movements require recount/rebase, not a false missing-stock claim. |
| Split purchase / 2 | Two or more positive requests, each below the policy threshold, same normalized supplier + category + project in a rolling seven-day window, aggregate ≥ threshold | Example threshold $10k, $6k + $5k = $11k triggers review. Include related pending/approved requests once, exclude canceled/void/duplicate deliveries, preserve original submissions/revisions. Serialize supplier/category policy bucket checks so simultaneous splits cannot pass unnoticed. Block/review policy, cross-project scope and false-positive handling need Q4. |

P2 threshold basis proposal is committed landed acquisition including freight/nonrecoverable tax, not just unit price. Exact threshold equality enters the higher band. Credits do not shrink gross-positive purchase exposure to evade approval; authorized credits remain visible separately. P1 has no monetary threshold bypass because every issue takes both steps. Cross-project/supplier-entity split review is Phase 3 unless specifically approved; do not claim the P2 project-level rule covers it.

## 8. Offline design review

**Overall classification: offline draft/queue for field input (P1 draft only; P2 explicit queue), offline read-only for previously synchronized inventory/status, online-only for approvals and authoritative posting.** A draft or queued request never means stock has been reserved or an approval accepted. Current WebView pause behavior does not provide restart-safe drafts; new web form persistence is an explicit requirement.

| Concern | Phase 1 requirement | Phase 2 extension / tests |
| --- | --- | --- |
| Available data | Cache only authorized operational material/lot/location and own request-status DTOs, with as-of time, current user/project and version. P1 finance screens remain online-only; last values disappear behind a reconnect state when not fresh. | Explicit limited finance cache needs separate approval and purge tests; not assumed. |
| Draft persistence | Web uses reviewed user-scoped `src/lib/offline/storage.ts` foundation after TIA-00; native extends user-scoped SQLite `record_drafts`. Persist before confirming “Saved on this device”; preserve last complete snapshot. Project/lot/quantity/destination/reason/UUID/version survive close/restart. | P2 atomically draft → material-request outbox; no arbitrary service-worker request replay. |
| Submission | P1 “Reconnect to submit”; approval buttons disabled offline with reason. Online timeout retains draft/operation ID and checks server receipt before retry. Unknown outcome is “Checking submission”, not “Failed, start again”. | Foreground retry with bounded backoff/jitter, same UUID/key and payload digest; no dependence on Background Sync. |
| Dependencies | Project membership and material/location/lot IDs must already be synchronized; unavailable options remain visible as unavailable, never remapped. Numbers assigned only by server. | Parent request receipt precedes any attachment operation. No attachment capture/upload in P1. |
| Freshness/conflict | Proposed operational refresh: foreground/manual and after posting, max 15-minute cache freshness; offline stale banner. Discard operational cache after 30 days, never unsent drafts. Submission/approval revalidates lot, request, cost and policy versions; stale data requires review, with entered values preserved. | Queue reconnect can return insufficient stock, superseded policy or revoked membership; visible failed/conflicted state and explicit amendment, never silent overwrite. |
| Permissions | Every submit/approve/post rechecks authenticated membership and assignment on server; role downgrade blocks finance reads and clears only restricted cached projections on reconnect. Offline access to previously authorized operational data is bounded by cache age; immediate remote revocation while disconnected cannot be promised. | No client cache is an authorization boundary. Cross-user A→B→A access and revoked-member sync tested. |
| Close / sign-out | Restart restores owned drafts. Sign-out lists drafts/queued work and requires synchronize, reopen, cancel or two-step discard; then deletes only that user's private database/temp files. No other account sees drafts. | Upgrade is additive and preserves old daily-log/photo outboxes, UUIDs and retry/conflict states. Unsupported future operation versions stay quarantined with recovery/export guidance, never deleted. |
| Storage / flapping | Warn at 90%; quota/SQLite failures show “Not saved — keep this screen open” and retain current fields. No false saved badge. Serialize saves; pause retry on auth refresh failures and preserve operation identity. | Exercise quota exhaustion, forced close during save, repeated drops, ambiguous receipt and retry limits. |
| Public caches / files | `public/sw.js` remains static assets only; no authenticated HTML/RSC/API/Supabase data/signed URL/project records in Cache Storage or global localStorage. Neutral `/offline.html` remains identity-free. Workspace has no worker. | P2 blobs require size/quota/compression, retry state, parent-before-attachment and safe removal only after confirmed receipt. Existing lossless thermal policy remains intact. |

State copy: **Saved on this device**, **Reconnect to submit**, **Checking submission**, **Awaiting inventory check**, **Awaiting manager approval**, **Conflict — review required**, **Could not synchronize**, **Posted / refreshed at …**. Save failure, waiting for approval and completed synchronization are different states. Cache/request status can be viewed offline but cannot be represented as current stock authority.

## 9. Audience wording and wireframes

| Audience | Navigation / labels | Allowed content |
| --- | --- | --- |
| Crew / foreman | Materials, On hand, Request ties, Work location, Approvals, Saved on this device | Quantities, unit, location, condition, last refresh, own request steps. No finance values, risk scores, thresholds or TCO label. |
| Operations / inventory lead | Inventory, Material cost (only if permitted), Holding time, Stock check, Approvals | Quantity/location/age; carrying amounts only with independent budget access. “True cost” explains more than unit price without implying “cheap”. |
| Purchasing | TCO overview, Landed cost, Cost assumptions, Approval policy | Authorized costs, commitments, rates, supplier/source/allocation detail. |
| Executive / auditor | Project TCO, Cost exposure, Audit flags, Approval trail | Authorized roll-ups, completeness, evidence and exceptions; flags say “Review required”, not “Fraud found”. |

Open [`wireframes/index.html`](wireframes/index.html) directly in a browser. No bundler, network, CDN, login or backend is needed. All fixtures and people are fictional. Prototype actions affect only the open page and reset on reload; there is no claim of actual local persistence or server approval.

| Screen | File | Review focus |
| --- | --- | --- |
| TCO overview | [tco-overview.html](wireframes/tco-overview.html) | P1 basic subtotal, separately labeled future lifecycle scenario, source/coverage and budget basis |
| Inventory list | [inventory-list.html](wireframes/inventory-list.html) | Search/filter, lot age, stock discrepancy, basic carrying with budget access |
| Material cost detail | [material-cost-detail.html](wireframes/material-cost-detail.html) | Worked tie basis, 60-day carrying calculation, actual/estimate distinction and future costs |
| Approval queue and trail | [approval-queue-trail.html](wireframes/approval-queue-trail.html) | Ordered distinct approvers, revision, refused attempts, append-only timeline |
| Dashboard audit flags | [dashboard-audit-flags.html](wireframes/dashboard-audit-flags.html) | All six requested flag types, evidence, owners and phase labels |
| Field crew mobile | [field-crew-mobile.html](wireframes/field-crew-mobile.html) | Native/web mobile quantity-only request; offline draft, reconnect, confirmation and conflict states |

All screens need loading, empty, denied, unavailable-source and retry states before implementation is accepted. Wireframes provide reviewable examples of these states using expandable notes/scenario controls; they are not a complete interaction test suite. Use semantic headings/forms, visible focus, text alongside status colors, 44px touch targets, screen-reader announcements and no horizontal page overflow at 390px. Wide finance tables may scroll within a labeled region. Validate larger text/VoiceOver/TalkBack in actual builds.

## 10. Ordered build backlog — all DRAFT, no Build authorization

Stable IDs below are local planning records, held in this requested document instead of creating external tracker issues or `.codex-loop` files. User has authorized planning, commit and push, not implementation. S = bounded change usually ≤ half a day; M = roughly 1–2 engineering days; L = roughly 3–5 days and should be split at implementation spec review. Sizes include both platform impact and relevant tests, exclude store waiting, and are estimates rather than a one-week delivery commitment. All have `claimed_by: null`, `claim_started_at: null`, `branch: null`, `worktree: null`; the current branch contains only this plan.

| ID | Phase / size / priority | Objective / dependency | Acceptance summary |
| --- | --- | --- | --- |
| TIA-00 | P1 / M / high / DRAFT | Establish safe web draft foundation; no dependencies | Reviewed committed foundation on canonical source; account-isolated draft survives restart; existing queues untouched. |
| TIA-01 | P1 / M / high / DRAFT | Restrict finance at shared read boundaries; depends on TIA-00 for cache checks | Crew receives no finance data from server/DB/exports/cache; authorized totals retained; supported-client regressions pass. |
| TIA-02 | P1 / L / high / DRAFT | Request/check/authorize one tie issue through immutable stock ledger on both platforms; depends TIA-01 and business decisions Q2/Q3/Q6 | One posted issue after two distinct ordered approvals; retries/concurrency create one movement; evidence cannot be edited. |
| TIA-03 | P1 / M / medium / DRAFT | Explain basic material/holding cost and count/age evidence in web + native; depends TIA-02 and Q5/Q7 | Example $70,694.25 reconciles; nonfinancial lead sees quantities only; 20-tie count variance is flagged without adjustment. |
| TIA-04 | P1 / M / high / DRAFT | Finish durable web/native request drafts and reconnect recovery; depends TIA-00/TIA-02 | Close/restart, quota, loss of network and unknown submit outcome preserve input; approvals online-only. |
| TIA-05 | P1 / M / high / DRAFT | Accept the bounded pilot on web, iOS and Android; depends TIA-01–04 | Ten requests, role/privacy checks and device restart/bidirectional evidence pass; assigned build availability recorded. |
| TIA-06 | P2 / L / high / DRAFT | Route existing change orders and spending through the same trail; depends TIA-05, Q3/Q4/Q8 | Existing IDs retained, enrolled legacy/direct writes cannot bypass policy; approvals invalidate on changed revision; old unrelated routes remain compatible. |
| TIA-07 | P2 / L / medium / DRAFT | Receive/return/transfer/reconcile multiple lots with full allocated costs; depends TIA-05/Q5/Q7 | Paired transfer conserves quantity and value; actual-vs-estimate costs reconcile per invoice and project; corrections use reversals. |
| TIA-08 | P2 / M / high / DRAFT | Surface potential threshold splitting and queue requests safely; depends TIA-06/TIA-07/Q4 | $6k+$5k triggers one review under $10k policy, including concurrent submissions; request outbox retries once logically, preserving old queues. Split detection and queue extension may be separated into two reviewable issues before READY. |
| TIA-09 | P3 / L / medium / DRAFT | Compare lifecycle scenarios and retain portfolio evidence; depends TIA-06–08/Q7/Q9 | Reproduce $135,529.59 undiscounted scenario, separate discount view, permission-scoped portfolio and verifiable signed export; no tamper-proof claim. Split scenario/export slices before READY. |

Implementation review should split TIA-02 into independently reviewable contracts as needed without releasing a partial approval security boundary. TIA-03 and TIA-04 can proceed after TIA-02's stable service contract, but shared domain/API/offline files require coordinated sequential edits. No parallel-agent execution is requested by this plan.

### Phase 1 issue contracts

#### TIA-00 — safe web drafts

- **Need/current:** crew input must survive close; main lacks the named web foundation although offline development contains it.
- **Required:** integrate only a reviewed committed foundation, additive user-scoped schema and neutral fallback. Likely areas: `src/lib/offline`, providers, `public/sw.js`, sign-out; no copy of dirty root files.
- **AC-1:** A's draft survives restart/offline; B cannot read it; A's sign-out removes only A after pending-work confirmation.
- **AC-2:** Public Cache Storage contains no authenticated HTML/RSC/API/private records; neutral fallback exposes no account identity.
- **AC-3:** Pre-existing daily-log/photo drafts, IDs, queued payloads and conflicts survive upgrade/rollback compatibility tests.
- **NG-1:** No general offline ERP or automatic inventory posting. **Risks:** source divergence, destructive schema upgrade. **Tests/manual:** IndexedDB restart/quota/account-isolation tests and real browser network-offline restart. **Open:** which reviewed offline foundation commit can be integrated (Q6)?

#### TIA-01 — finance-safe reads

- **Need/current:** current UI permissions do not establish a complete monetary response boundary; bootstrap includes budget values.
- **Required:** shared capability evaluation and separate operational/finance projections, column/table grants and RLS for new data, safe related legacy reads/cache sanitization. Likely areas: permissions, project/dashboard/change-order reads, bootstrap, native dashboard, domain/API types, activity/export/RailBot paths.
- **AC-1:** Foreman/contractor/inspector, nonmember, wrong-org and revoked accounts cannot obtain monetary fields or infer them from financial flags via routes, direct data access, rendered/a11y content, exports or local cache.
- **AC-2:** Existing authorized finance roles retain correct values; assignment as inventory lead alone adds no finance permission; owner read does not grant change-order management.
- **AC-3:** Supported old mobile binaries tolerate omitted optional restricted finance fields; daily-log/photo sync, pilot gate, invites and session bridge remain working. Cache sanitation leaves unsent work intact.
- **NG-1:** No global role rewrite, signup or master login. **Risks:** legacy RLS/read leakage and cached finance; tests must fail on actual payloads, not CSS checks. **Tests/manual:** role-matrix integration and real DB allow/deny queries; inspect field network/cache and authorized manager screens on both platforms. **Open:** assignment roster and support scope (Q2/Q9).

#### TIA-02 — trace one issue end to end

- **Need/current:** no material ledger/staged approvals in inspected main; current CO approval is single-step.
- **Required:** minimal one-lot setup and issue transaction, fixed two-step policy, web and native list/request/queue/trail, scoped cost exposure and audit evidence. Likely areas: new shared domain/service/routes, future schema/grants, project navigation and `apps/mobile/src/app`.
- **AC-1:** Opening 1,000 ties plus request for 100 stays at 1,000 until lead and manager approve; then ledger and both clients show 900 after refresh with one movement and ordered actor/revision/time evidence.
- **AC-2:** Same submitter, same prior approver and out-of-order attempts return denied, append safe evidence and leave stock/state unchanged; direct table/event mutation is denied, including old route attempts against new records.
- **AC-3:** Duplicate submit/final-approval operations return the same receipt; mismatched payload reuse conflicts; concurrent 600-tie requests cannot take stock below zero; stale revision/membership/cost/budget rejects preserve user input.
- **AC-4:** $126k + incremental $6.8k vs $130k budget holds posting, while already-committed $6.8k is not counted twice; all state/ledger/event effects roll back on failed posting.
- **AC-5:** Revisions, cancellation and reversal leave prior evidence readable; notifications are recoverable without a second stock posting.
- **NG-1:** No PO/receipt UI, transfers, external payments, threshold configuration or emergency override. **Risks:** privileged executor bypass, races, budget double counting, absent approver. **Tests/manual:** disposable DB grants/RLS and transaction tests, simultaneous clients, web→native and native→web using synthetic IDs. **Open:** Q2/Q3/Q5/Q8.

#### TIA-03 — basic cost, age and discrepancy

- **Need/current:** budgets exist but no line-level carrying calculation or inventory count evidence.
- **Required:** authorized lot cost card, native cost summary/detail, crew-safe quantities, count observation and dashboard evidence. Reuse budget baselines with explicit reconciliation coverage.
- **AC-1:** Supplied 60-day fixture gives landed $68,000, storage $1,800, capital $894.25, basic carrying $2,694.25 and basic subtotal $70,694.25 on both clients; future lifecycle terms are excluded from P1 totals.
- **AC-2:** Partial issues reduce subsequent carrying intervals; missing dates/rates and zero installed quantity show incomplete/not available; allocations/credits cannot double count waste, invoices or approved CO amounts.
- **AC-3:** 60-day on-hand stock flags aged; expected 1,000/count 980 flags a 20-tie variance and holds issue pending investigation. Stale-count baselines require recount; no automatic adjustment.
- **NG-1:** No capitalized accounting book, automatic shrink charge or lifecycle tool. **Risks:** ambiguous basis and counts captured during movement. **Tests/manual:** independent decimal arithmetic, interval/rounding/unknown inputs and row-level finance checks, lead walk-through of age/count evidence. **Open:** Q5/Q7/Q8.

#### TIA-04 — preserve field input and receipt recovery

- **Need/current:** existing native SQLite is durable; WebView page lifetime alone cannot meet restart preservation.
- **Required:** hook request forms into approved user-scoped persistence, finite-state submission/receipt recovery and visible conflict states. No new material outbox in P1.
- **AC-1:** Save quantity/location/reason, go offline, terminate/restart, restore on web and native; show “Saved” only after persistence succeeds.
- **AC-2:** Offline submit/approve is clearly unavailable; network loss before/during/after submit keeps fields and operation identity; reconnect receipt lookup prevents a duplicate request.
- **AC-3:** Quota failure keeps entered fields with a clear unsaved message; repeated connectivity changes, auth-refresh failure and role revocation never discard or silently resubmit input.
- **AC-4:** A→B→A, sign-out guard and additive upgrade/unsupported-version recovery tests preserve existing daily-log/photo work. User sees draft/pending/retry/failed/conflicted/synchronized distinctions accurately.
- **NG-1:** No automatic queue for material requests/approval decisions, attachments or Background Sync dependency. **Risks:** asynchronous save races, stale statuses and unsupported native build. **Tests/manual:** browser and SQLite persistence tests plus physical iOS/Android close/reopen, restart and network tests. **Open:** Q1/Q6.

#### TIA-05 — accept the two-platform pilot

- **Need/current:** documented shared-workspace action coverage is not functional/native device acceptance.
- **Required:** invite-only named tester roster, approved baseline/count/cost fixture, one script per role and release evidence. Verify full flow in both directions and preserve installed data.
- **AC-1:** Build/TypeScript/focused shared/API/permission/calculation/grant/transaction/offline tests pass; `npm run check:db-grants`, `npm run test:db-grants` and mobile parity inventory pass with new actions listed. Native typecheck, tests and iOS/Android production exports pass.
- **AC-2:** Physical iPhone/iPad and Android evidence covers restart/network, field no-finance response/cache, native approvals, role denial, conflict, deep links and in-place upgrade retaining old queues. Record exact build/OS, commit, test identity/project, timestamps and result; untested means pending.
- **AC-3:** At least one web-created issue is approved/refreshed on native and one native-created request is checked/refreshed on web with same IDs/revision/events; ten pilot requests and daily count review meet section 1 success criteria.
- **AC-4:** Signed build is available and assigned to named invited testers; backend/web keeps released mobile v1 routes/protections; rollback retains ledger/evidence and never clears devices or reopens legacy bypasses.
- **NG-1:** No external promise of full parity or offline stock posting. **Risks:** tester/store delays and inconsistent source branches. **Tests/manual:** complete QA script with synthetic or expressly approved pilot records. **Open:** Q1/Q2/Q6/Q9.

### Phase 2/3 contract addenda

These remain concept-sized DRAFT records and must be refined/split with full platform test scripts before READY.

- **TIA-06:** Current CO writes bypass staged history; required adapter preserves existing IDs/number/milestone and consumes one approved budget delta. **AC-1:** enrolled CO cannot approve/delete via old action, direct REST or RailBot; **AC-2:** changed amount restarts policy and retains old events; **AC-3:** legacy rows show no invented evidence. **NG-1:** no ERP integration. **Risk/tests:** old-client bypass and downgrade; database and old/new API tests, web/native revision walk-through. **Open:** Q3/Q4/Q8.
- **TIA-07:** Current main has no multi-lot ledger; add receiving/return/paired transfer/reversal and source-based allocation. **AC-1:** quantities/value conserved per atomic transfer; **AC-2:** two materials sharing one invoice allocate exactly once to the cent; **AC-3:** actual loss replaces overlapping estimates with linked evidence. **NG-1:** no cross-org transfer. **Risk/tests:** backdating, units, partial delivery; randomized ledger/allocation and two-device retry tests. **Open:** Q5/Q7/Q8.
- **TIA-08:** No split-review/outbox exists for new requests; introduce deterministic supplier/category windows and durable request-only queue. **AC-1:** concurrent $6k/$5k submissions flag one $11k exposure; **AC-2:** cancellation/credits/duplicates follow section 7; **AC-3:** close/restart/retry sends one logical request, approval still requires online action and current permission. **NG-1:** no automatic fraud verdict. **Risk/tests:** false positives and fresh-stock conflicts; DB concurrency, window boundaries, mobile/web queue upgrade. **Open:** Q4/Q6.
- **TIA-09:** No lifecycle/scenario or external evidence assurance exists; add the separately budgeted forecast and export pipeline. **AC-1:** $135,529.59 example and dated PV scenario reconcile independently; **AC-2:** all export rows obey project/finance scope; **AC-3:** altering an exported event fails manifest verification while corrections remain linked. **NG-1:** no claim database administrators cannot tamper. **Risk/tests:** uncertain costs, retention and signing-key custody; decimal/scenario and artifact-verifier tests plus authorized mobile/web export review. **Open:** Q7/Q9.

## 11. Rollout, compatibility and impact record

- **User-visible change:** currently only a written plan and static wireframes. Future releases add inventory, true-cost and approval/audit functions on web and native, in the phases above.
- **Web impact:** planned project navigation, inventory/request/cost/approvals/audit screens and draft persistence; no application implementation in this branch.
- **Mobile impact:** planned native Field list/request/status, authorized cost/queue/trail/dashboard views; shared online Workspace adaptation; new signed iOS/Android build needed for bundled changes. No OTA is configured; web deployment alone cannot add native screens.
- **Shared API/domain/database:** planned additive DTOs, capability checks, service/RPC boundary, events/stock/cost/rate/policy objects and explicit grants/RLS. No schema or database work in this branch.
- **Offline:** P1 drafts + cached operational reads, online submission/approval/posting; P2 explicit request queue. Preserve current daily-log/photo operation payloads and identity. TIA-00 is a real dependency, not a passed gate.
- **Older mobile builds:** main is canonical backend after the October 5 reconciliation; native source remains separate. September notes mention 300010 but do not establish today's installed fleet. Q6 must produce the actual supported build list. Add a capabilities response/feature gate; new endpoints return explicit unsupported-version errors and clients retain drafts. Old clients keep current v1 routes, bootstrap compatibility and queues; they do not gain new native features automatically.
- **Permissions / idempotency / conflict:** role/assignment matrix and transactional receipt/version rules in sections 4/5/8; all are proposed and unimplemented.
- **Web→mobile / mobile→web:** TIA-05 records exact same-ID bidirectional tests, refresh visibility and denied access. No such runtime acceptance has been claimed for this planning branch.
- **Tests/builds/device checks:** this documentation-only change uses local links/content checks, arithmetic checks, JavaScript syntax and browser wireframe review. `npm ci` completed in the isolated worktree (842 packages); it reported 21 existing dependency advisories (5 moderate, 15 high, 1 critical). No dependency or lockfile remediation is authorized here. Application build/TypeScript/runtime suites are not applicable to these static-only edits under the web/mobile policy and PR template; they remain mandatory implementation gates in TIA-05. Physical-device implementation acceptance is pending, not passed.
- **Planning validation completed:** seven HTML files (six requested screens plus index), 98 local links/assets/anchors, unique IDs, inline JavaScript syntax and independent decimal arithmetic passed. Browser review used desktop and 390px phone widths; exercised out-of-order/self-approval rejection, distinct two-step posting (1,000 → 900), future-cost toggles, empty inventory filter, phase-filtered flags, and offline/conflict states with fields preserved in the open prototype. This verifies static interactions only; real persistence, authentication, server posting and physical devices are unimplemented.
- **Deployment/build/assignment / rollback:** no manual deployment, native build or tester assignment is created by this round. The existing Vercel integration has automatic deployments enabled and no ignored-build command; the user explicitly allowed a branch deployment before push. An automatic preview can therefore build the unchanged application with these added documentation files. This is not implementation or release of the proposed feature, and main is not merged. Future feature rollout order: approve business decisions → resolve source/foundation prerequisites → reviewed additive schema/contract in test environment → backend/web with finance and approval protections → signed native builds/tester assignment → gated one-project pilot. Retain old API/outboxes, migrate no unsent identity, verify actual deployed source and available/installed build IDs. A server-side pilot gate disables new submissions, never erases accepted records; rollback keeps new events/ledger readable and forbids legacy write bypasses. Disable entry, allow safe read/recovery, and roll UI back to a compatible revision; no down-migration that deletes evidence.
- **Deliberate gaps and tracked follow-ups:** web foundation absent on main (TIA-00); finance boundary (TIA-01); physical device/fleet evidence (TIA-05/Q6); CO/spend routing (TIA-06); broader inventory/full cost (TIA-07); split detection/material queue (TIA-08); lifecycle/assurance (TIA-09). No app feature is complete merely because the wireframe exists.

## 12. Questions for Mark and Wendy

| ID / owner | Decision needed | Proposed starting point / effect |
| --- | --- | --- |
| Q1 — both | Does “within a week” mean five days of pilot use or a working release delivered within seven days? Which crew/project/yard will test, and what single success would make them keep using it? | One tie issue at one yard; 20-minute onboarding and ten requests over five pilot days. Delivery date remains conditional on offline/device gates. |
| Q2 — both | Who are the named requester, inventory verifier and final manager, with distinct backups? May the inventory lead see monetary amounts under their existing role? | Three distinct invited identities; no shared/master login and no new finance access from assignment alone. No eligible person means waiting, not override. |
| Q3 — Wendy | Which actions need approvals before execution: purchase commitment, spending/payment, CO, receipt, issue, transfer, write-off? Is two-step verification required for every Phase 1 stock issue? | Fixed lead → manager for P1; approve before physical release; separate Phase 2 routes by action. Confirm return/rejection/delegation requirements. |
| Q4 — Wendy | What are the threshold amounts/currencies and bases, required approvers, aggregation windows and split-purchase exceptions? Should a flag block, warn or send to an independent reviewer? | No threshold bypass in P1. P2 illustrative $10k gross landed spend, seven days, same supplier/category/project; threshold equality enters higher band. Examples are not approved policy. |
| Q5 — Mark | Which quantities/units, opening counts, receipt dates, yard/work locations and handoff evidence are reliable? Who owns counts, damage and missing-stock investigation? | One tie SKU/lot; 60-day age trigger, weekly count; missing dates are unknown, discrepancy holds issue until reviewed. No automatic stock adjustment. |
| Q6 — both + technical owner | Which exact web-offline foundation commit and native build fleet may the pilot use? Who can test physical iPhone/iPad and Android, and confirm in-place upgrades preserve existing queues? | Review committed offline foundation before integration; obtain installed/available build IDs. No assumption shared web UI satisfies native/offline acceptance. |
| Q7 — Wendy | Which cost components/rates and source documents should be actuals vs estimates; what valuation basis, storage allocation, horizon, salvage and discount rules apply? | USD, landed basis, actual/365, P1 storage/capital only. Obtain a real tie invoice/freight/storage example to replace the illustrative rates before business acceptance. |
| Q8 — both | Who owns the budget/spend baseline, approved CO adjustment and commitment reconciliation? Does stock already purchased count as new project exposure on issue, and which budget should lifecycle estimates be compared with? | Source-based no-double-count reconciliation; separate project-control and lifecycle budgets. Missing baseline blocks authoritative budget claims. |
| Q9 — Wendy + technical owner | Who investigates flags, how long must evidence be retained, who can export it, and is external tamper-evidence/independent retention required? | Minimal actor snapshot and append-only events for application roles in P1; no certified fraud finding. Approve retention/privacy, account deletion and admin-access rules before rollout. |

These questions are intentionally deferred for review of the concrete plan/wireframes. No implementation issue is READY and no Build is started. Next step is approval of a refined Phase 1 issue set after Q1/Q2/Q3/Q5/Q6/Q7/Q8 decisions; the `$loop-run` handoff belongs only after that approval.
