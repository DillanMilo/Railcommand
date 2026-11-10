# Phase 1 readable costs and approval history — November 4, 2026

The user found Evidence & conditions and Material cost & budget review difficult
to consume, and could not readily find price entry or distinguish spending from
material prices. This is a local presentation/editor improvement on
`codex/tco-inventory-audit-phase-1`, following the
[Beta label checkpoint](TCO_PHASE1_BETA_LABEL_AND_WALKTHROUGH_20261104.md).

## Basis and meaning of the cost model

The model follows Wendy's meeting taxonomy: log, mill, trucking, treating, drying
(4–10 months), oil-linked creosote, rail car, installation labour, inspection,
carrying and disposal. The confirmed defaults are 5% annual carrying and a second
distinct Supply Chain sign-off strictly above USD 50,000 per contract anniversary
year, using approved commitments plus the request. Admins can edit organization
rules. This patch changes none of those calculations or approval decisions.

Phase 1 uses manually entered, sourced cost revisions with estimate/actual/
commitment labels. It is not an invoice/payment import or a complete accounting
system. Full true cost remains visibly incomplete when sources/components are
missing. All walkthrough figures are synthetic, not Wendy's quoted prices.

## User-visible changes and scope

- Budget summary separates approved project budget, existing recorded spend,
  approved new material commitments and headroom before pending requests.
  Commitments are not presented as paid invoices.
- Lot summaries separate original-lot acquisition, installed subtotal excluding
  carrying, and capital carrying on remaining stock. Per-tie prices divide by
  the original opening quantity, not the declining on-hand count. Unknown amounts
  stay unknown, while actual zero remains visibly zero.
- Itemized prices show readable names, grouped amounts, per-tie amounts, basis
  and source. Carrying is shown separately from manual price rows.
- **Edit material costs** is prominent above each lot's price list. Entry is for
  original-lot totals. Existing prices, basis, source, purchase reference and
  reconciliation identity are prefilled, preserving reviewed version checks.
  Users select contracts, sources and project links by name rather than copying
  UUIDs. Native cost basis/funding/link controls use choices.
- Native private editor values are held separately per lot and configuration
  proposal. Switching editors does not blank an earlier unsaved lot. Opening an
  existing source preserves its identity, including its original currency and
  contract period if org defaults later change. No purchase is recommitted by
  this presentation change.
- Approval history shows action, actor, request number and a friendly date.
  Six recent steps appear first; older history remains available. Every original
  event reference, state, revision and exact timestamp remains in audit details.
  Request revisions, blocked attempts, financial snapshots and source evidence
  are retained in disclosures. No ledger content is edited or deleted.
- Annual review uses lot/contract names and plain release conditions. Split
  warnings remain visible and explain that a flag is not a fraud finding.

## Web/mobile/API impact and offline design

- Web: inventory workspace, financial summary/editor, contract review and audit
  history. Local Next runtime has these source files; its LAN/auth/proxy overrides
  were preserved. Top links make costs/spending and approval history findable.
- Native: equivalent financial summaries, price entry, choices and history.
  iOS and Android bundles compile. The installed Phase1 app 610004 is unchanged;
  it needs a new build and physical visual/interaction smoke check for this UI.
  Do not imply a web refresh updates bundled native code.
- Shared domain: presentation/default helpers and additive exports only. Existing
  material-cost, budget, carrying, approval and idempotency functions are unchanged.
- API/backend/database: no route, service, migration, grant, RLS, live settings or
  database mutation. No new data store or third-party integration.
- Offline classification remains **offline draft/queue for operational input**,
  **offline read-only stock**, and **online-only finance/settings/approvals**.
  Operational drafts, UUIDs, receipts, retries, version checks, membership/RLS
  revalidation and user-scoped cache boundaries are unchanged.
- Financial input stays only in owner-scoped current-session UI memory, across
  folding/switching editors and temporary disconnection. The editor explicitly
  says to save online before closing the app. Financial edits are not promised
  to survive app termination and never enter operational caches or public SW
  storage. Account/project changes reset the parent scope as before.
- Disclosures keep child input mounted. Previously installed clients and queued
  payloads keep the existing API/storage schemas. No queue purge or sign-out.

## Validation and remaining checks

- Web production build and root/native TypeScript pass.
- iOS/Android development bundle exports pass; no install/upload/OTA occurred.
- Inventory tests: 21 pass, including null/zero money distinction, original-lot
  denominator, preserving all existing price/source values, and original purchase
  currency/period after organization defaults change.
- Native suite: 273 pass, including real SQLite persistence, account isolation,
  stale session/permission behavior and existing offline recovery paths.
- Changed-file ESLint: no errors; two previously existing native hook-dependency
  warnings remain. No business-rule refactor was bundled into this UI work.
- Real local web PM view shows the separate totals, per-tie table, confirmed
  rules and split warning. Opening the second lot's editor displayed existing
  10,000 log / 35,000 labour values and the original purchase source. No save or
  price change was submitted during the visual walkthrough.
- Expanding history showed all 25 returned events; folding restored six recent
  steps. Technical evidence remains reachable.
- New native visual/choice/per-lot editor interaction and connection-transition
  smoke checks are pending on a rebuilt development app. The earlier
  [physical approval/offline acceptance](TCO_PHASE1_DEVICE_ACCEPTANCE_20261104.md)
  covers the unchanged core, not these newly bundled screens.

The budget projection does not provide a currency. Budget figures therefore keep
their recorded numeric units and show a currency-confirmation notice; source
prices use their known currency. Before live pilot setup, confirm the project
budget currency and its consistency with contract commitments. If multiple
currencies are needed, record currency explicitly in the shared budget contract
before comparing them; do not invent FX conversion in the UI.

The existing staged release, proper signed mobile build, tester assignment and
pilot opening-data/approver setup remain pending. Nothing was merged, pushed,
deployed or written to hosted data. The original dirty checkout is untouched.

## Instructional narration and promotional playback

The separate Desktop Remotion project now has male narration using the installed
macOS Daniel voice, generated locally. Nine MP3s are grouped with their respective
scenes. Scripts, measured durations and rates are in
`public/narration/manifest.json`; every clip ends at least 0.6 seconds before its
next chapter. Clips decode successfully with non-silent audio (sample peak −1.9
dB, mean −20.2 dB). The price-entry chapter now explains Edit material costs.

Studio's instructional preview showed narration tracks, advancing frames,
unmuted audio at volume 1 and no error overlay. The promotional tab had fullscreen
controls hidden; reload restored its visible Play button and advancing timeline
was verified. This is a player-state reset, not a changed business feature.
Both previews remain editable and local; no MP4 export or cloud voice/render
service was started. The promotional video remains silent.
