# Confirmed inventory contract rules — local handoff, 21 October 2026

This supersedes only the unconfirmed operational rate/threshold and deferred
likely-split slice in the Phase 1 handoff. The user confirmed editable organization
defaults of 5% annual carrying and an additional distinct Supply Chain spending
sign-off strictly over USD 50,000 per contract year. The user separately confirmed
contract year and approved commitments plus the request. Protected preview/private
TestFlight preparation is authorized to the parent; this Build has not pushed,
merged, deployed, uploaded, distributed, invited anybody or changed hosted data.

## Platform, API and schema impact

- Web and actual native Inventory screens implement organization settings,
  organization contract registration with start date, verified opening annual
  commitment baseline, contract/source linkage, annual audit evidence and waiting
  Supply Chain approval. Shared descriptors, wording and carrying calculation are
  in `packages/domain/src/inventory.ts`; the existing controller/API is reused.
- Active policy rows are versioned organization defaults with Wendy-confirmed
  provenance. Existing and new organizations receive them. Old project proposals
  remain unconfirmed historical evidence; no proposed value is activated.
  Current same-organization project managers/superintendents/engineers with edit
  permission can configure this organization policy. Inventory-lead assignment
  never grants finance permission. Owners retain finance reads but cannot decide.
- Additive migration `20261021170501_inventory_confirmed_contract_rules.sql`
  creates RPC-only, RLS-enabled, append-only financial evidence with literal
  minimum grants. No authenticated direct table mutation or financial SELECT is
  granted on these new tables. All actor identity comes from `auth.uid()`.
  Existing execute/read/receipt/settlement signatures and supported mobile routes
  remain. New actions are additive and validated through both HTTP entrypoints.
- Stable organization contracts are shared across projects. Each contract has an
  immutable start date and unique organization contract key. UTC anniversary
  periods are start-inclusive/end-exclusive; Feb29 uses Feb28 in non-leap years.
  Sources and opening baselines identify the period by its start year and currency.
  Missing contract/start, wrong period/currency or missing baseline holds new spend.
- The verified external baseline explicitly excludes **all** sources tracked in
  this feature. An explicit verified zero is permitted; absence is never zero.
  This is manual reconciliation, not complete external procurement accounting.
  Source keys identify immutable purchase evidence per contract/period/currency;
  reusing them across projects must match amount/evidence exactly. Correcting a
  wrong immutable contract identity/start requires a separately reconciled correct
  contract/source and request rebase; evidence is never overwritten.
- Final posting serializes actor/UUID → organization → project → lot → request.
  Organization locking deliberately covers all contract periods, a stronger lock
  than the minimum contract-period boundary. Final source commitment and stock
  movement are one transaction. Pending approvals do not reserve procurement
  money or release stock. A changed aggregate/policy/baseline/assignment/source/
  cost/budget/lot forces explicit requester rebase and fresh approvals.
- Foreman → inventory lead → distinct PM remains. Above the strict annual limit,
  PM authorization records a waiting state and releases nothing. The explicitly
  assigned, currently eligible finance member must be distinct from requester,
  lead and PM and authorize online before final posting. No admin exception exists.
  Revoked current membership/edit permissions are rechecked under row locks.
- Funded/committed stock consumption adds zero new annual exposure. One canonical
  source commits once across projects and is recognized once in its committing
  project's budget. Reissues/retries/source links do not duplicate it. Two or more
  known distinct individually subthreshold sources whose sum exceeds the limit
  produce a derived finance-only likely-split warning, linked to approved/proposed
  evidence. The warning says purchasing splits are prohibited and is not a fraud
  verdict. Unrelated organizations/contracts/periods/currencies stay isolated.
- Carrying calculation values remaining stock proportionally from sourced opening
  acquisition totals and accepted opening quantity, using UTC receipt age and
  ACT/365. A 68,000 valuation at 5% for 60 days gives 558.90 annual capital.
  An explicit cost-revision annual override is allowed. Unknown acquisition/age/
  opening quantity stays incomplete. Storage is separate; no manual carrying
  amount is added twice. Other buckets and overall TCO remain incomplete until
  sourced. The old explicit 8% worked example remains isolated and labeled.

## Review corrections: permission waits and acquired stock

Every mutation re-reads the actor's current same-organization project role and
edit permission after acquiring organization/project/member/profile locks. The
actor's profile is locked even if it moved organization during the wait. Current
permissions are held through commit; revoked actors produce a denial without a
request, revision, count, movement, finance snapshot or successful receipt. The
initial checks remain an early denial only. Assigned-approver rechecks, original
operation identities, digest conflicts and immutable receipt recovery remain.

A canonical purchase committed in an earlier contract year remains already-funded
stock when subsequently consumed in the same lot or linked across projects. The
original source, currency, anniversary bounds and commitment evidence stay intact;
no new period baseline or duplicate annual/project-budget charge is manufactured.
Fresh requests still require current versions, requester rebase where needed,
inventory lead verification and distinct PM authorization before release. A new,
uncommitted purchase with a prior period, wrong currency or missing current
baseline remains held. Old pending annual-spend reviews must rebase and reapprove;
a rebase cannot convert an unreconciled purchase into funded stock.

The expanded disposable PostgreSQL regression covers thirteen lock-wait denial
cases (submit/revise/cancel/count; edit revocation, membership deletion and profile
organization change, plus submit role change), the inverse authorized-write-before-
revocation ordering, remaining historical stock within/across projects, immutable
source/commitment identity and unchanged annual/project spend. Synthetic historical
posting/review rows model rollover without replacing a server function or clock.
These server-only corrections apply identically to web/native and old compatible
clients; no bundled UI, private device storage or offline queue identity changes.

## Offline classification and installed clients

Operational field input remains **offline draft/queue, draft only**. Operational
quantities/status are **offline read-only**. Configuration, reconciliation,
financial/source input, approval, posting and same-identity settlement are
**online-only**. There is no automatic inventory outbox. Financial editors stay
only in current-account memory over connection loss; no private editor value is
saved to IndexedDB/SQLite/cache/service worker. Private operation envelopes retain
original UUID/scope/expected versions and require receipt or explicit settlement
before unlocking after restart. Field drafts, old log/photo queues, blobs and
operation identities are preserved. Account switching, quota, legacy scrub and
sign-out protections remain. Supply Chain operational events are deliberately
allowlisted without private reasons; private policy/source/baseline events remain
excluded from field/device projections.

The current completed iOS build300014 source is immutable
`ce2a1e67d913e931690f34982a45b334c7ae64db`, newer than Phase 1's imported75d914
baseline. Only reviewed native update notice/photo-copy/RailBot/device/plugin
changes and additive app-release shared/client/backend contracts were reconciled.
Its exact required `expo-application`57.0.2 is pinned in native dependencies/lock;
no runtime version was selected or upgraded for this feature. The backend still
advertises300012, matching released source's explicit availability gate; a completed
build is not proof of assignment/installation and was not promoted here.

Old installed clients retain bootstrap/auth/pilot/session/RailBot/log/photo APIs
and payloads. They do not gain the new bundled Inventory UI from a web deployment.
Old Phase 1 inventory clients cannot bypass the new server authorization, but do
not offer the new Supply Chain/configuration controls. A newly signed successor
is required; there is no configured OTA delivery. Device acceptance is pending.

## Local evidence and packaging

Root regression480 cases, native259 cases/typecheck, production web build and
standalone TypeScript, production unsigned Hermes iOS export, old and expanded
real PostgreSQL/RLS/concurrency/receipt tests, grants checks, persistent Chromium
privacy/recovery tests and actual web/native component handlers passed. The native
render harness uses explicit browser adapters for native primitives/Expo/session;
it verifies actual component behavior, not device typography or physical lifecycle.
Real native persistence is tested separately through production adapter/on-disk
SQLite. Synthetic public endpoints and HTTP/session transport are clearly labeled;
no hosted API/RLS acceptance is inferred. Source lint has0 errors; six existing
web/shared and two existing native hook warnings remain. An extra expanded native
test lint run found the unchanged Phase 1 `let raw` prefer-const error at line146;
it was recorded, not fixed outside the bounded repair budget.

`vercel.json` disables Git deployment only for
`codex/tco-inventory-audit-phase-1`; cron and other branches are preserved.
Root `.easignore` preserves root exclusions and translated native `.gitignore`
patterns, excludes tracker/evidence/private credentials/generated binaries, and
keeps required native/shared sources. EAS24.8.0 archive-stage inspection produced
`/tmp/tia-confirmed-eas-archive-safe`:664 files with no tracker/private env/signing
files; required source/assets/plugins/lockfiles remain. No build/upload occurred.
The parent supplies approved isolated public endpoints at test build time; no
service key or deployment-protection bypass belongs in a native bundle.

Exact revision, commands, logs, initial failures and three repair passes are in
`.codex-loop/reports/TIA-CONFIRMED-RULES/build.md`. Original dirty root and `main`
match `/private/tmp/railcommand-rule-defaults-original-20261021.json` exactly.

## Pending release and rollback gates

Independent Review of the exact commit is required. Parent handles authorized
branch push, protected preview and private TestFlight only after approval and
isolated backend prerequisites. Hosted schema/backend/web acceptance, signed
successor distribution/assignment/install, physical iPhone/iPad/Android restart,
network flapping, permissions/privacy/old queue recovery and bidirectional live
synthetic-record acceptance remain pending. Existing pilot identity/consent/roster,
project/yard/lot/date and broader parity gates remain. No full offline or live-pilot
readiness claim is made.

Deploy additive schema/gated API before exposing new controls. Rollback must retain
confirmed-rule server enforcement, safe finance projections, canonical commitments,
immutable approvals/receipts and device work. Disable new Inventory writes/UI if
necessary; never restore ungated posting, broaden finance grants, delete ledger/
receipt history, purge queues or reissue an uncertain UUID.
