# Phase 1 industry fit and first-use review · 5 November 2026

Reviewed source: `codex/tco-inventory-audit-phase-1` at `a5ebec0`.
This is a research and usability review with one bounded accessibility repair,
not an accessibility certification. The web viewport no longer caps zoom at 1×.
No APIs, migrations, permissions or user records were changed. The separate
promotional edit is media only.

## Decision

The feature addresses a relevant rail construction/maintenance problem: knowing
what accepted tie stock is available, where it is, what costs are supported by
sources, and who authorized a commitment or issue. The distinct foreman →
inventory lead → PM → required Supply Chain flow is a sensible bounded pilot.

Current evidence supports a **guided, tie-focused local pilot**. First-use setup
and finished-tie price entry still need a small usability pass before calling it
self-service for an untrained crew/inventory lead. Research validates the problem
and direction; it cannot substitute for observing the target users.

Earlier implementation was based primarily on the user's October meeting
summary and subsequent decisions. This document records the additional external
research now completed; it does not retrospectively claim a complete industry
study was performed before the build. No meeting transcript or supplier quote
was supplied.

## Primary-source cross-check

| Evidence | Implication for RailCommand |
| --- | --- |
| [Koppers 2025 annual report, Railroad and Utility Products and Services / Backlog](https://www.sec.gov/Archives/edgar/data/1315257/000131525726000012/kop-20251231.htm): sawmill procurement, truck/rail transport, conditioning and large inventories; typical air seasoning is six to nine months. | Wendy's manufacturing/logistics buckets address real tie-industry costs. Her 4–10-month planning range must not be presented as a universal technical release rule. |
| [Koppers Camden plant](https://www.koppers.com/company/locations/camden-plant): incoming grading and drying to target moisture before treatment. | Readiness needs accepted supplier/inspection evidence; elapsed months alone do not establish that a tie is suitable for release. Phase 1's accepted-finished-stock boundary is appropriate. |
| [Koppers recovery and reuse](https://www.koppers.com/services/recovery-and-reuse): delivery, use, maintenance, recovery and end-of-life logistics. | Disposal/recovery belong in lifecycle planning. They should remain distinguishable from purchase or installed cost and paid invoices. |
| [FTA asset inventory guidance](https://www.transit.dot.gov/TAM/resources/assetinventory) and [asset management guide](https://www.transit.dot.gov/research-innovation/transit-asset-management-guide-2016-report-0098) connect inventory/condition information with lifecycle and budgeting decisions. | Supports the inventory/cost connection as a general transportation practice. FTA capital-asset guidance is context, not a claim that a contractor's tie-stock screen meets transit regulatory reporting requirements. |
| [GAO 2025 Green Book, pp. 65–66 and 73, transaction authorization, documentation and segregation of duties](https://www.gao.gov/assets/gao-25-107721.pdf). | Distinct authority, restricted access and recorded approvals align with established controls. This is a comparison framework, not a legal mandate for A5 or proof that fraud cannot occur. |
| [W3C clear labels](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p06-clear-labels/) and [forms guidance](https://www.w3.org/WAI/tutorials/forms/) emphasize familiar labels, associated controls and understandable instructions. | Plain workflow words and progressive disclosure fit the audience; UUID entry and an obscure opening-balance form remain first-use friction. |

The 5% rate, strictly-above-$50,000 contract-year trigger, spend basis and named
approval sequence are **customer-confirmed, editable organization rules**. They
are not represented as universal rail-industry benchmarks or legal thresholds.
The model currently labels the rate as annual capital carrying, with storage
separate; the pilot must agree this interpretation and which holding costs are
covered rather than assume all damage, shrinkage or obsolescence is in that figure.

## What already helps users

- Field profiles see operational stock, requests and history without financial
  data. Price entry and approval decisions remain online and permission checked.
- Acquisition, commitments, recorded spend and budget headroom are separated.
  Prices show per-lot/per-tie amounts, source and estimate/actual/commitment basis.
- Missing prices remain unknown rather than silently becoming zero. Current
  carrying uses the existing shared 5% default/override calculation.
- History shows actor/action/date first, with technical evidence in disclosures.
  Likely-split warnings are review signals; they do not announce a fraud finding.
- CSV is now one click for authorized cost viewers; web download and eight-profile
  API permission checks passed on November 4. Native sharing still needs physical
  device acceptance after a new separate Phase1 build.
- Request input has device drafts; stock caches are read-only offline; reconnecting
  does not silently authorize or release stock.

## Small first-use work to prioritize

These are **tracked recommendations, not changes completed by this review**.
Retain the current API/RLS, distinct actors, revisions, idempotency and invite-only
access. Implement applicable web and native changes together.

| ID / size | Concrete change | Acceptance before an unassisted pilot |
| --- | --- | --- |
| UX-01 / M | Make **Add accepted stock** visible to the current authorized manager, with a clear empty state and an understandable path to the existing lot form. Put receipt/inspection/source first; supplier manufacturing dates can sit in optional details. Replace approver UUID entry with named member choices. | A first-time manager finds the form without scrolling past finance/audit tables, registers a synthetic accepted lot using normal business fields, and assigns distinct invited people by name. Server validation/permissions remain authoritative; no shared login. Inventory lead does not gain new management powers. |
| UX-02 / M | Offer a **finished-tie purchase / delivered invoice** pricing path, retaining Wendy's manufacturing breakdown as optional advanced input for organizations that know those costs. This requires a bounded additive cost-basis design, not merely relabelling the raw-log bucket. | A buyer with one delivered invoice can enter a truthful acquisition amount without inventing log/mill/treatment costs or typing false zeros. Included freight/treatment is not added twice; separately charged items stay separate. Old source identities, currencies, approval snapshots and installed clients remain valid. Test both old and new cost revisions before release. |
| UX-03 / S–M | Tighten number labels and next actions: show book/available quantity clearly; identify the next approver; separate acquisition, installation, future disposal and current-stock carrying. Confirm the project budget currency before relying on cross-source budget comparisons. | A tester can explain each headline number without opening raw evidence. A future disposal estimate is not labelled installed spending. A current-stock estimate is not labelled total historical project carrying. No unsourced budget currency or FX conversion is invented. |
| UX-04 / S | Complete the focused accessibility/device pass on the actual updated build. | Keyboard operation and visible focus, phone reflow/zoom, VoiceOver/TalkBack field labels and selected/expanded states, large text, contrast and native CSV Save/share are checked. Record remaining gaps rather than certify from screenshots. |

Why UX-02 matters: it is an inference about **contractors buying finished ties**,
not a claim about every rail customer. A manufacturer's full breakdown is useful
for Wendy's purchasing/executive analysis, but should not be mandatory knowledge
for an inventory user holding a supplier invoice. Confirm the pilot's actual
purchase document with Mark/Wendy before choosing the cost-basis extension.

Do not add a manufacturing scheduler, full PO/invoice integration, FX engine,
asset depreciation/NPV suite or bulk importer to solve these first-use issues.
Those need evidence of demand after the small pilot.

## Data meaning and boundaries found in the source

- `materialCostSummary` requires all seven upstream buckets, with source/status,
  to form an acquisition subtotal. This is why a finished-invoice path needs real
  design rather than instructions to invent a breakdown.
- Its current `installedExcludingCarrying` sum also includes disposal. The UI
  discloses this, but the headline name is still easy to misunderstand. UX-03
  should correct the presentation or calculation explicitly on both platforms
  and in CSV, with an independent nonzero-disposal example.
- `operationalCarrying` estimates carrying attributable to **current remaining
  stock**, using receipt age and current balance. It does not integrate daily
  historical balances across all issues. Example: $10,000 opening value, half
  issued after 15 days, 50% remaining on day 30, at 5% ACT/365: current-stock
  estimate is $20.55; historical carrying across both holding periods is $30.82.
  Keep the former's scope clear; do not silently turn it into a historical ledger.
- Posting final authorization reduces the book balance. Physical handover is not
  a separate scanned issue/receipt workflow. Agree the pilot's recording practice
  and distinguish recorded availability from an independently verified physical
  count. Count differences already have a review path.
- Budget currency is still unconfirmed in the projection. Manual source revisions
  and commitments are not invoice payments; full lifecycle TCO remains incomplete.
- Phase 1 is tie-specific (`ties` quantities), not a validated unit model for
  ballast tonnes, rail lengths and all other material classes.

## Accessibility evidence and limits

**Fixed in this review:** `src/app/layout.tsx` set `maximumScale: 1`. That cap was removed, retaining the initial device-width layout. It could prevent zoom in user agents that honor it; removing it lets the browser/user choose an enlargement level. See [W3C meta-viewport zoom rule](https://www.w3.org/WAI/standards-guidelines/act/rules/b4f0c3/). The change is global web metadata and also affects the online web workspace, not native bundled controls.

Source inspection found associated web labels, native `accessibilityLabel` values,
radio semantics for choices, 44px web controls and 48-point native inputs/choices.
These are useful foundations. W3C's [AA target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
sets a 24×24 CSS-pixel minimum with exceptions; larger field controls remain a
practical target. [Contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
requires 4.5:1 for ordinary text and 3:1 for large text; [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
needs an actual narrow/zoom check. Source dimensions do not prove overall WCAG
conformance or good screen-reader use. Native date typing and the long setup
section remain practical areas to observe.

This round inspected current local web labels/navigation and web/native source. A fresh 320×800 web check showed the cost cards stacking and the in-page cost link/Export CSV remaining usable. The head now emits `width=device-width, initial-scale=1` with no maximum-scale cap. The main cost content reflows in that view, but repeated instructions and status text consume much of the first screen; the global project/search header is crowded at this width and needs UX-04 verification/polish. This is a narrow-breakpoint inspection, not proof of pinch-zoom or 200–400% zoom behavior. Evidence: `/Users/dillanmilosevich/Desktop/railcommand-tco-videos/review/nov5-costs-320px.png`. The temporary viewport override was reset. November 4 native bundle/functional checks remain historical evidence. No new physical-device, screen-reader or complete WCAG acceptance is claimed. No existing form/draft or stock record was edited.

## Pilot acceptance, using existing distinct invited test identities

Observe a manager, inventory lead and foreman performing these tasks with
synthetic data, without explaining each field first:

1. Find Add stock and register accepted material with a source and receipt date.
2. Enter the real form of purchase evidence supplied for the pilot; identify lot
   amount versus per-tie amount and estimates versus actual costs.
3. Foreman chooses stock and saves/reopens a request draft without connectivity.
4. Lead verifies; a distinct PM authorizes; required Supply Chain sign-off occurs
   before release. Test both sides of the configured contract-year threshold.
5. Review a likely split alongside a legitimate already-committed delivery, check
   the count discrepancy path, and export the cost report.

Record task completion, assistance needed, mistaken entries and the user's own
explanation of the displayed numbers. Agree practical task-time targets with the
pilot; do not invent validated productivity claims. Spike Sambol remains the
proposed inventory pilot contact, pending Mark's introduction. Research and a
passing build do not replace this first-use observation.

## Change impact / handoff

One web metadata change removes the zoom cap; the rest is documentation. Native bundled UI, shared domain/API/database behavior, installed-client contracts and offline storage/queues are unchanged. The online native web workspace receives this metadata when that web source is served and refreshed; it is not a native bundle update. Current classification remains offline draft/queue (drafts only; online submission) for requests, read-only
cached stock, online-only finance/approvals/export. No new mutation, idempotency
or conflict path exists in this review. Root build/TypeScript and a current local narrow-screen check validate the metadata change; referenced November 4 native/functional checks remain scoped to that commit. Physical pinch zoom, screen readers and native CSV sharing remain pending; no full WCAG sign-off is claimed.
No merge, push, deployment, paid service or production access was performed.

Validation of the zoom repair: root `npm run build`, `npx tsc --noEmit`, focused
ESLint for `src/app/layout.tsx`, and `git diff --check` passed. The existing Next
middleware deprecation notice is unchanged. No new unit test was added for a
reversible metadata-property deletion. The persistent local runtime layout was
backed up under `Phase1Local/private/backups/20261105-zoom` before applying the
same metadata edit. Rollback is restoring the prior viewport property/source
file; no database rollback or draft migration is needed. The original dirty
checkout and `main` head matched the saved preservation baseline after this work.
