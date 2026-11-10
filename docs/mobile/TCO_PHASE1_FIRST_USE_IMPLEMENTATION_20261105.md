# First-use improvements · 5 November 2026

User approved UX-01–03 from the industry review. Implement locally on
`codex/tco-inventory-audit-phase-1`; hold video revisions until verification.
No paid service, hosted database, merge, deployment or installed-app replacement.

## Bounded plan and acceptance

1. Web/native: put Add stock and Approvers at the top, use invited project-member
   names for lead/PM/Supply Chain choices, and keep supplier dates in optional
   details. Preserve current role restrictions and distinct-person checks.
2. Delivered-price entry: one amount for the entire accepted lot, including
   delivery/treatment already billed, with invoice/reference and price status.
   Keep the seven upstream manufacturing inputs as an alternative; never add
   them again to an invoice price, invent zeros or rewrite old revisions.
3. Shared summaries/UI/CSV: acquisition, installation+inspection, future disposal,
   and accrued carrying of remaining book stock are distinct. Do not combine
   original-lot costs with current-stock carrying into a false lifetime total.
   Show the next required approver and label book availability clearly. Existing
   budget-currency warning remains until actual project currency is confirmed.

## Data, security and compatibility

- Add a nullable `purchase_price` JSON column to immutable cost revisions. Existing
  rows remain null; no backfill/update/delete. Validate amount/source/status.
- Extend the current RPC's existing authorized/versioned cost branch; preserve
  operation receipts, source/contract identities, policy and approval checks.
- Advertise cost-entry capability version 2 in the finance projection. New UI
  must not send invoice prices to an older backend that could ignore them.
- Older clients can continue field operations and legacy pricing. An old-style
  cost mutation against an invoice-priced revision must fail with an explicit
  update-required response rather than erase its invoice. New revisions keep all
  old component/source evidence; financial reads stay behind existing RLS.
- Named choices use the existing project roster, with additive edit-permission
  metadata. Server membership, roles and distinct actors are still revalidated.
- Default carrying 5%, contract-year >$50,000 second sign-off, split review and
  append-only history are unchanged. Budget currency is not inferred or converted.

## Offline impact

Requests remain **offline draft/queue (drafts only, online submission)**; cached
stock remains **offline read-only**. Setup/prices/approvals/export are **online-only**.
Setup and financial input survive folding and temporary connection loss in the
current user/project screen, but are not promised across app termination. Private
pricing never enters operational IndexedDB/SQLite, localStorage or SW caches.
Unconfirmed commands retain the original UUID/receipt identity. A confirmed new
lot clears only its own setup form and prevents an accidental duplicate click;
unknown delivery retains the same operation for receipt recovery.

## Required verification

- Shared independent examples: invoice includes delivery without double counting,
  manufacturer mode, unknown versus zero, nonzero installation/inspection/disposal,
  current-stock 5% carrying, original currency, deterministic latest revision.
- Real disposable Postgres: additive upgrade preserves old row values/history;
  valid/invalid invoice pricing, field/foreign denial, stale versions, receipt retry,
  old-client protection, source reuse and pinned approval invalidation.
- Web/native types/builds/focused tests, database grant checks, current local UI
  controls and browser CSV. Use synthetic fixtures only. Do not reset the persistent
  backend; back up and compare existing records before any local additive migration.
- Physical native setup/pricing/share/VoiceOver acceptance requires an updated
  separate Phase1 build and remains tracked if no device check is performed.
- Rollback UI if needed; after invoice revisions exist retain the compatible RPC
  and column. Do not restore a pre-invoice write function that could ignore pricing.

## Implemented impact record and verification

| Surface | Result |
| --- | --- |
| Web | Top-level stock setup and named approver choices; delivered invoice/breakdown editor; separated cost cards, next-step wording and CSV. Receipt date input survives rerenders and folding. |
| Native iOS/Android source | Matching setup, named choices, pricing modes, cost scopes, next steps and export report. Current-screen input stays in the existing user/project-keyed workspace. |
| Shared API/domain | Latest revision selected by version; delivered acquisition counted once; disposal separated; remaining-stock ACT/365 carrying unchanged. Updated web/native reads request `costEntryVersion=2`. |
| Backend/RLS | Nullable checked column plus existing guarded RPC extensions. No table/policy/role replacement, new login method or old-row rewrite. Existing source identities, receipts and authorization token checks retained. |
| Installed clients | Old API reads receive unknown upstream amounts plus an update explanation for invoice-priced revisions, preventing a competing manufacturing subtotal. Legacy writes to those revisions fail with an explicit update-required response. Other reads, receipts and operational payloads remain compatible. |
| Offline | Request drafts and stock cache unchanged. Setup/pricing/approvals/export remain online-only. Browser loss/reconnect preserved setup input and disabled sending; finance disappeared offline. No private price cache added. |

Passed on 5 November:

- 37 focused inventory tests, including independent invoice/manufacturing/zero/unknown
  examples, $12,000 acquisition + $2,000 installation + $300 inspection = $14,300
  installed, $500 disposal kept separate, and $300 carrying for half of a $12,000
  lot held 365 days at 5%.
- Root/native TypeScript, web production build, 278 native tests, and local iOS and
  Android JavaScript exports. Exports are bundle validation, not installed builds.
- Real disposable Postgres inventory and contract suites: populated upgrade,
  unchanged historical rows/ledger, validation, immutable invoice revision, receipt
  retry, stale edits, old-client guard, approval invalidation after a basis change,
  RLS/field privacy, distinct approvals, threshold/split and concurrency regression.
- Database grant gate and real grant/RLS tests for preview/reset/legacy-default paths.
- Persistent **local** backend backed up before additive DDL. The transaction
  compared counts and value hashes in 66 public tables before commit; all existing
  values matched. Initial guard-query attempts rolled back automatically before
  the corrected comparison passed. No hosted backend was accessed.
- Actual local web stock creation and invoice save used a new clearly labelled
  `QA1105` synthetic lot in the designated QA1029 test project. Existing stock,
  requests, profiles, settings and other rows were fingerprinted before and after;
  all were unchanged (13 new test rows only). No stock was released.
- Browser CSV downloaded successfully and parsed as 17 columns, with delivered
  12000, installed 14300, future disposal 500 and full lifecycle blank. Eight-profile
  web/native API export checks passed; unauthenticated request returned 401.
- Browser 320px/390px checks found no document overflow; stock-form folding,
  delivered/breakdown switching and real browser offline/reconnect preserved input.
  The date check caught an input-event issue; it was repaired and retested.
- Original dirty checkout, branch, HEAD, main, dirty-file list and diff hash match
  the preservation checkpoint. No existing app was replaced; no merge/push/deploy.

## Remaining small pilot gates

1. Install an updated **separate Phase1** native build and check these changed
   controls, receipt recovery, CSV sharing and VoiceOver on an actual phone.
   The existing installed app does not gain bundled UI changes from a web refresh.
   Android physical acceptance remains pending too.
2. Use the guided project/contract/baseline setup with the pilot; this change does
   not turn finance reconciliation into an accounting integration. The inventory
   lead still confirms receipt/inspection; PM/admin confirms contract, budget
   currency and source treatment before approvals. PMs see linked contracts;
   organization administrators handle initial unlinked-contract setup.
3. Show the new flow to Spike/Mark/Wendy for first-use feedback. The 5% interpretation
   (capital only versus a wider all-in holding rate) and actual budget currency
   remain explicit pilot questions; do not silently add storage twice or infer FX.
4. Redo promo/instruction media after the changed native controls are checked, using
   current desktop and phone screens. Existing videos were deliberately untouched.

No live-release readiness is claimed by source checks or a local web walkthrough.
Release still needs the reviewed additive backend first, matching web/API, an
updated native build and normal tester assignment. Keep the compatible backend
when rolling back UI after invoice revisions have been recorded.
