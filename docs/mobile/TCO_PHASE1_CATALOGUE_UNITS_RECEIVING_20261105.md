# Phase 1: approved catalogue, units and receiving

Local branch only; no hosted database, paid service, push, merge or deployment.

## Bounded implementation

Reuse project material IDs as an approved project catalogue. Existing material rows,
stock, costs, requests and append-only evidence remain intact. Managers/admins add
catalogue items; editable assigned inventory leads and managers receive accepted
stock. Foremen/engineers select approved items and ask their project manager when
an item is missing. No automatic name matching, merging, conversions or item edits.

Fixed units: each, litres, US gallons, kilograms, pounds, metric tonnes, US short
tons, metres and feet. Each uses whole numbers; measured quantities allow three
decimal places. Codes identify specifications; different units/specifications need
different codes. Existing each items remain compatible with installed clients;
clients without inventory v3 receive only their original catalogue items.

Receiving uses three short steps: choose item, quantity/location, receipt and
inspection. Prices remain in the authorized Material costs workflow. Rail tie
manufacturing inputs remain tie-specific; other materials use delivered pricing.
Manager CSV import previews and atomically adds catalogue and optional opening
stock. Excel users save as CSV. A required import reference and a canonical batch
fingerprint prevent repeated imports; conflicts reject the whole batch. No XLSX
parser, price importer, supplier integration or new approval process.

## Platform and offline impact

Web and bundled native: catalogue search, fixed units, compact receiving, unit-aware
requests/counts/costs. Desktop web additionally provides bulk CSV setup; standalone
native Field tools directs bulk setup to web, avoiding another file-picker stack.
Primary native workspace uses the same responsive web UI. Shared API/domain:
additive metadata, v3 negotiation, quantity validation and safe CSV parser.

Catalogue reads are offline read-only using existing user-scoped operational caches.
Receiving/catalogue/import are online-only: entries survive connectivity loss and
step navigation while the screen stays open; save before closing. Existing request
drafts remain device-persistent. Server checks permissions, material/unit, stock
versions and operation IDs on every write. Import payloads are not added to a new
offline queue; uncertain writes retain only receipt identity and must be reconciled.
No authenticated data enters public service-worker caches. Existing queues remain.

## Preservation and verification gate

Test additive SQL in disposable local PostgreSQL before applying locally. Back up
persistent database and device documents; compare original row/column values after
migration. Never reset, seed or wipe the persistent database, uninstall apps, change
original dirty checkout or touch hosted data. Keep local routing/build overlays.

Acceptance: role/cross-project denials; duplicate names/codes; fractional and whole
unit validation; no automatic material creation on receipt; atomic import failure,
reference/hash replay and concurrency; original IDs/rows; existing approval,
carrying-rate/contract-threshold/split rules; installed-client projection; offline
input preservation; web/native types/build/focused tests and database grant checks.
Physical iPhone checks and any remaining platform gaps must be reported honestly.

## Implementation and initial verification

Implemented approved catalogue selection and fixed units on web/native, including
measured request/count/release quantities. Manager catalogue tools are folded under
Manage inventory. Receiving uses three steps; missing-item guidance routes to the
project manager/admin. CSV includes a preview, template, optional accepted opening
stock, atomic conflict rejection and canonical/concurrent deduplication. Finance
CSV adds material code and stock unit; spreadsheet formula protection is retained.

Passed: root/native TypeScript, web optimized build, 44 focused shared/HTTP tests,
278 native tests, iOS/Android local bundle exports, database grant static/real gates,
and disposable PostgreSQL catalogue/quantity/import/approval tests. The upgraded
schema passed exactly-$50k and over-$50k Supply Chain tests, split flags, fractional
issues, distinct approvers, concurrent imports, canonical retries, RLS and helper
access denials. No production rate/threshold or approval logic was replaced.

Persistent local database: full private dump taken before DDL. The first attempt
rolled back because this restored stack has no CLI migration-history table; local
manifest bookkeeping was corrected. The committed transaction then passed exact
original-column/row comparisons on all 66 public tables. No reset or seed ran.

Web and iPhone visual acceptance and in-place native installation are recorded in
an additional checkpoint after completion. Physical Android and VoiceOver remain
release follow-ups; local bundle export is not physical-device acceptance.

A rendered-component regression test now exercises the actual web and native
receiving components at a mobile viewport. It proves Back/Continue cannot save,
all entered receipt/quantity fields survive navigation and an offline transition,
and only the explicit Receive stock action sends one approved-material command.
A browser check caught and fixed a web form default-action issue before handoff;
only a new synthetic local test delivery was affected. The local proxy also now
validates the exact desktop/phone Host and Origin before translating inventory
POSTs to the private compiled server origin. Production guards are unchanged;
foreign/opaque/cross-site/missing origins remain rejected. The existing local
workspace-ticket positive, replay and hostile-origin tests still pass.

Physical iPhone review prompted one final presentation improvement: receiving,
catalogue and approver setup use the native screen directly, folding the main
inventory header/navigation/list out of the way while keeping those components
mounted. This reduces swiping and preserves other form state. Server operation
messages and uncertain-receipt recovery remain available. No storage or API change.

## Final local checkpoint

Local app source: `ed34436` (web explicit-confirmation fix: `d7631fa`). Separate
RailCommand Phase1 iPhone build **610008** installed in place using the existing
local signing identity; no cloud build/provisioning change. Original app 300015,
development 600001 and staging 300004 remain unchanged. All durable rows in ten
existing phone SQLite databases are unchanged after installation AND the physical
receiving check; only an operational cache refreshed. Private full backups retained.

Physical iPhone: selected the web-approved diesel item, entered **1.25 US gal**,
yard/reference `QA1105N4`, date 2026-11-05 and inspection acceptance. Back/Continue
preserved every field and did not save. Explicit Receive stock confirmed once.
All three steps fit without a swipe in this test. Refreshed desktop web showed the
same material/lot and 1.25 US gal; SQL verified exactly one opening movement.
Web CSV preview/import also passed: reused the approved fuel material, received
5.125 US gal and added a catalogue-only M20 bolt specification. No old row changed.

Final original-column fingerprint comparison: all original rows/values across
66 public tables preserved; only new synthetic QA records added. Original dirty
checkout branch, HEAD, main, short status and binary diff match the prior baseline.
The additional disposable DB assertion verifies pre-upgrade review tokens remain
valid. Local inventory Origin tests reject foreign, opaque, missing and cross-site
origins while valid desktop/phone origins reach normal input validation. No auth
or production-origin guard was relaxed.

Evidence: [iPhone receipt visible on web](evidence/20261105-catalogue-iphone-to-web.png).

Verification commands: `npm run build`, `npx tsc --noEmit`,
`npm run test:inventory`, native `npm run typecheck`, `npm test`, `npm run export`,
`npm run check:db-grants`, `npm run test:db-grants`,
`node scripts/test-inventory-catalogue-db.mjs`,
`node scripts/test-inventory-receiving-ui.mjs`.

Remaining release follow-ups: physical Android/VoiceOver and a real phone network
transition/restart pass for this new receiving UI. Receiving/import are explicitly
online-only with current-screen retention, not durable offline receiving queues.
Bulk CSV beta setup is desktop web; native Field tools supports manual catalogue
and receiving. Native WebView CSV file-picker acceptance remains unverified and
is not a supported bulk-setup path for this local handoff. The catalogue is project
scoped, not an organization-wide master library. CSV is limited to 100 rows with
one row per material code in a batch; receive additional yard lots separately.

## Local video and branch checkpoint

Renamed the local feature branch to `feature/tco-inventory-phase-1` at the user's
request; no remote ref, main, or original checkout changed. CSV preview now uses
the existing padded, horizontally scrollable inventory table styling. This is a
web presentation change only: desktop bulk setup and responsive WebView share the
style; standalone native receiving is unchanged. API, schema, RLS, installed-client
compatibility, and offline drafts/queues are unchanged. Import remains online-only
with current-screen input retention; field request drafts remain durable. No
phone rebuild is needed for this table styling. Videos use synthetic local data.
