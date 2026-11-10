# Local Phase1 workspace sign-in recovery — 5 November 2026

## Diagnosis and bounded plan

Phone reconnect exposed the workspace error page. Native authentication can create
its one-use workspace ticket (200), but submitting it with the correct public
HTTPS Origin returns 403. A separate synthetic probe without an Origin returns
303 with secure cookies. The development server constructs its request URL using
its loopback hostname, so its strict origin comparison rejects the external local
HTTPS address. Historical local proxy logs show the same 403 before today's USB
unplug. This is not evidence of lost inventory or expired native credentials.

Correct only the persistent local proxy: for the workspace POST over its fixed
local HTTPS listener, validate an explicitly supplied Origin and Host against that
listener, reject cross-site/opaque/unexpected origins, then translate the already
validated Origin to the loopback upstream's origin. Do not relax the application
origin helper or ticket authentication. Missing-Origin behavior remains as in the
existing handler. Back up the proxy before changing it, and restart only that
owned local process; retain Docker volumes, Next, app containers and sessions.

Web/native impact: restore the existing native WebView -> local web sign-in
handoff. No bundled UI, API contract, schema, RLS, role, price or approval changes.
Installed clients and persisted queues remain compatible; no mobile rebuild.
Offline: workspace stays online-only, with existing dirty-page protection and field
drafts retained. No auth or private response is added to a cache. No sign-out,
queue deletion, native credential replacement or extended ticket lifetime.

Acceptance: fresh native handoff succeeds, incorrect/opaque/cross-site origins and
missing/expired/replayed tickets remain denied, authenticated destination works,
phone opens its workspace and native Inventory Beta, and pre-existing public
records and saved device drafts/queues remain intact. No production, paid service,
push, merge or deployment.

A second local-only issue appeared after successful handoff: the browser Supabase
client was configured for `http://localhost:3108/supabase`. On an iPhone that points
to the phone itself. Keep the server/desktop configuration and cookie identity
unchanged; add a runtime-only browser-client overlay that uses the fixed trusted
phone HTTPS origin for `/supabase`, explicitly retaining `sb-localhost-auth-token`.
Back up the original client first. This prevents a cookie-name change or sign-out
from purging existing web device drafts. Restart only the separate Phase1 process
while its workspace is visibly empty and has no entered form input, to avoid
reusing the SDK's old singleton. No phone restart or app reinstall.

## Implemented and verified

- Corrected only the persistent local harness. The public phone origin remains
  `https://192.168.1.100:44321`; the original desktop origin remains
  `http://localhost:3108`, preserving its existing IndexedDB drafts/outboxes.
  The proxy retains its loopback 3107 alias and sends web requests to private
  loopback 3109. The persistent starter checks the private web listener at 3109.
- The proxy validates the exact HTTPS Origin/Host and rejects cross-site requests
  before translating the valid Origin to Next's observed canonical origin
  `https://localhost:3109`. The application handoff route and ticket helper are
  unchanged. No origin wildcard, authentication bypass or ticket-lifetime change.
- Local browser client and health-check overlays use the same public origin on
  the phone (and the 3107 loopback alias), retaining `sb-localhost-auth-token`.
  Server configuration and the original desktop cookie/storage identity remain.
- The development web bundle did not hydrate on the observed WebView; a compiled
  local build loaded the real synthetic project and responded to controls. Its
  persistent starter now runs the compiled build. The underlying development-mode
  hydration cause was not isolated; it is not labelled a released-app defect.
- Rebuild the local runtime with `npm run build` after future web source/overlay
  changes, then restart only its owned web process. Source edits no longer hot
  reload in this compiled test mode. No hosted deployment is involved.
- The phone's existing PM session reconnected without replacing native credentials.
  Physical workspace dashboard, More -> Inventory Beta, stock search `Native`,
  filtered QA1105-NATIVE / QA-SALT / 100 ties and retained search across Material
  costs -> Stock were verified. Separate native Inventory also opened with the
  bundled 610006 section/search controls and a current server snapshot.
- Workspace CSV export opened the actual iOS share sheet (20 KB synthetic report).
  It was cancelled without choosing a recipient; its temporary export directory
  contained no remaining file afterward. The separate native Field-tools CSV
  button path is still a distinct pending check.
- Desktop on its original 3108 origin loaded inventory and reopened the existing
  saved request with its original QA1105-NATIVE lot selected. No request was sent.
- Local HTTP acceptance: valid handoff -> 303 with secure cookies, authenticated
  inventory -> 200; foreign, opaque and cross-site origins, foreign Host, invalid
  tickets and consumed-ticket replay -> 403 with no cookies. Ten existing ticket
  and real-client route tests passed, including expiry/tampering/MFA/identity guards.
  Security probes use a separate synthetic admin identity so their one-use OTPs
  cannot supersede the phone's PM handoff.
- Runtime compiled builds and TypeScript passed. All temporary diagnostics were
  removed; root layout and the application handoff route match their backups
  byte-for-byte. Feature application source remains c09fb362; installed Phase1
  build remains 610006, with no reinstall this turn.
- All drafts, queues, photos and sync-history rows across 10 native SQLite databases
  remain unchanged and integrity checks pass. Only cached reads refreshed. All
  pre-existing rows in 66 local public tables remain unchanged; the earlier seven
  synthetic opening-stock rows remain the only additions from today's checks.
- Proof: [recovered iPhone stock view](evidence/20261105-iphone-workspace-recovered.png).
  This image contains only the synthetic project. Share-sheet contact suggestions
  were not copied into repository evidence or media. Keyboard capture is off.

Backups and detailed local acceptance/manifests remain privately under
`Phase1Local/private/backups/20261105-workspace-origin`; current local build/overlay
hashes are in `Phase1Local/private/compiled-web-source.json`. To roll back the local
harness, stop its owned proxy/web processes before restoring the backed-up scripts
and browser helpers. Preserve Docker volumes, app containers and compatible feature
backend; do not reset data. No push, merge, paid resource or deployment.

Native price-save, native Field-tools CSV path, exact-build offline draft restart,
VoiceOver and Android physical checks remain separate feature acceptance gaps.
This record resolves the reported local sign-in/loading errors, not those gates.
