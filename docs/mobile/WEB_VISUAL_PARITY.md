# RailCommand native/web visual parity map

This document makes the native design target explicit. The authoritative visual
reference is the signed-in RailCommand web command shell and its sign-in experience,
not a generic Expo starter or a separate mobile brand.

## Current checkpoint — 2026-08-30

The bounded client-polish pass is complete; full web parity and release acceptance
are not. See [the current client handoff](CLIENT_FINISH_CHECKPOINT_2026-08-30.md)
for verified simulator behavior, build results, and the next staging-only integration
gate. Newer local code is not yet in Expo build 300003 or deployed to staging.
The follow-up client account/project-lifecycle and record-request safeguards are
also locally complete: **250 tests** across the mobile chain pass. Delayed responses
cannot replace newer project/account state; cached project projections preserve
offline returns; record creation/details/exports use the existing account and
storage-lifetime guards. TypeScript, lint, the local webpack web build, and iOS/Android
Hermes exports pass. The earlier staging simulator update restored its existing
session and ten-value draft; the final record-wiring follow-up has only been tested
and exported locally, not installed. This does not close real-server or physical-device
acceptance. Further integration is paused for staging-only approval; production is
out of scope.

## Shared visual contract

- Use the same navy, orange, cream, paper, border, success, warning, and danger color
  system as `src/app/globals.css`.
- Use the bundled Plus Jakarta Sans, DM Sans, and JetBrains Mono families that mirror
  the web typography roles. Native UI must not load fonts from the network.
- Preserve the web hierarchy: a full-width white 66-point utility bar containing a
  compact navy project selector, mono uppercase eyebrow, strong editorial page title,
  sharp bordered cards, orange primary action, and compact status badges.
- Keep native controls at least 48 points tall and retain Dynamic Type. Visual parity
  does not justify copying inaccessible web sizing or contrast.
- Reuse the RailCommand rail mark. Do not introduce an unrelated Expo or mobile-only
  identity.

## Screen map

| Web surface | Native route | Current parity state | Offline classification |
| --- | --- | --- | --- |
| Sign in | `/sign-in` | Shared brand, wording, hierarchy, field icons, password visibility, primary action, remembered-device status, recovery action, and pricing treatment aligned. Google sign-in is rendered only when the target Supabase environment publicly reports that provider enabled; staging currently reports it disabled, so no dead OAuth control is shown | Online-only; provider discovery and failed authentication requests remain recoverable and never discard entered credentials |
| Dashboard | `/(tabs)` | Measured white utility bar/navy project control, breadcrumb/title/status, six-card two-column KPI composition, recent activity, milestones, and quick actions aligned; KPI values come from the authenticated staging bootstrap rather than fabricated fixtures | Cached project/log/team/module summaries are offline read-only; new logs are offline draft/queue |
| Daily logs list/detail | `/(tabs)/logs`, `/daily-log/[id]` | Project header, web-style New Log action, Calendar/List switcher, month grid, cached record cards, weather metadata, and detail sections aligned for the available mobile data | Offline read-only; new-log navigation opens the offline draft/queue workflow |
| New daily log | `/daily-log/new` | Local native form now includes temperature/conditions/wind, personnel, equipment, and work-item rows, summary/safety/location/photos. Ten synthetic values survived simulator updates/reopens. Richer server round-trip/detail acceptance remains pending | Offline draft/queue |
| Project team | `/team` | Project header, cached-state notice, roster heading, member cards, initials, email, and role treatment aligned | Offline read-only |
| Sync Center | `/(tabs)/sync` | Native-only operational surface now uses the same project header, page status, KPI, action-card, and activity-row language | Offline-capable status and retry control |
| Profile/privacy/support | `/(tabs)/account` | Identity, session state, device services, support/compliance, and safe-sign-out sections aligned to the web settings hierarchy | Mixed; deletion and remote links are explicitly online-only |
| Invitation, recovery, and secure callback | `/invitation/[token]`, `/reset-password`, `/auth/callback` | Shared secure-access hierarchy and live verification/recovery status treatment aligned | Online-only; failed requests remain recoverable |
| Account deletion | `/account-deletion` | Privacy heading, 30-day recovery status, retention explanation, local-work inventory, and identity confirmation aligned | Online-only request; local work is never silently discarded or queued |
| Submittals | `/(tabs)/submittals` | Cached list, count, filters/search/cards; native text-create, read-only detail, and PDF export implemented locally, not yet deployed/end-to-end accepted. Attachment/review/edit parity remains unfinished | Offline read-only cached data; text draft persists locally; creation/export require connectivity and are not outbox mutations |
| RFIs | `/(tabs)/rfis` | Cached list, count, filters/search/cards; native text-create, read-only detail, and PDF export implemented locally, not yet deployed/end-to-end accepted. Attachment/response/edit parity remains unfinished | Offline read-only cached data; text draft persists locally; creation/export require connectivity and are not outbox mutations |
| More/navigation | `/more` | The visible native navigation mirrors the web priority order and opens the same nine-item bottom sheet. Cameras and Team have native routes; the other deferred modules hand off to the authenticated staging web app when connected | Mixed: Cameras/Team metadata is cached read-only; deferred module navigation is explicitly online-only |
| EarthCam Cameras | `/cameras` | Project-authorized feed labels plus embedded EarthCam share players, strict HTTPS host allowlist, external-open fallback, and permission-checked native add/edit/remove controls matching the web workspace | Feed metadata is offline read-only; live video and administration are online-only, an open form preserves its input through connection loss, and mutations are never silently queued |
| Punch list, safety, QC/QA, documents, photos, reports, schedule | Not yet native workflows | Preserve web information architecture; implement only with real data endpoints and complete states | Online-only/unavailable until separately implemented |
| Administration, billing, RailBot voice | Intentionally deferred | Must stay clearly unavailable in the field release | Online-only/unavailable |

## Phase boundary

Phase 5 proves the shared native shell, accessibility/security behavior, and physical
device reliability. The implemented parity slices now cover sign-in, dashboard,
the Dashboard/Submittals/RFIs/Logs/More navigation structure, cached Submittal/RFI
lists, the EarthCam viewer and permission-checked feed controls, daily-log list/form/detail, team, Sync Center, account,
account deletion, invitation, recovery, callback, and the shared components later
screens inherit. Submittal/RFI text creation and export now have local native implementations;
their staging integration and remaining attachment/review/edit workflows are not accepted.
EarthCam add/edit/remove is native but remains online-only and is never placed in the outbox.
Web-style project links for Submittals, RFIs, Daily Logs, Cameras, and Team now select the
linked project and open the corresponding native workspace instead of falling through to an
unmatched route. A known project opens immediately from the signed-in user's cached project
list and then revalidates in the background; a failed response never makes an unknown project
ID active. Unsupported v1 administration modules continue to return safely to the
project dashboard and are not represented as native/offline-capable.

Full route-by-route parity is product work, not store metadata work. It must continue
before release-candidate sign-off, but it must not weaken the accepted offline or
security invariants and must not invent dead controls for modules whose mobile API and
workflow do not yet exist.

The native session is always restored from Keychain/Keystore, so the web checkbox is
represented as an enabled remembered-device status instead of a misleading toggle.
This preserves the approved secure session-restoration contract. OAuth provider
discovery reads only Supabase's public Auth settings; it does not cache credentials or
add a new offline dependency.

## Measured signed-in reference — 2026-08-29

The signed-in production web shell was inspected read-only in Safari Responsive
Design Mode at 390 × 844, 768 × 1024, and desktop width. No record was created,
edited, submitted, or downloaded during this inspection.

- Both measured phone and tablet widths retain the mobile shell: full-width 66-pixel
  utility bar, navy 36-pixel project selector, two-column KPI cards, and fixed
  Dashboard / Submittals / RFIs / Logs / More navigation.
- The dashboard content uses 12-pixel phone gutters, a breadcrumb above the orange
  command eyebrow, a 28-pixel project title, a divider, and six 148-pixel KPI cards.
- Cards use the warm paper surface, one-pixel neutral border, two-pixel corner radius,
  and restrained three-pixel offset shadow from the web command-shell stylesheet.
- The desktop-only dark sidebar appears only beyond the measured tablet shell.
- Native data remains truthful: Budget, schedule, Submittal, RFI, Punch List, and
  Daily Log KPI positions use authenticated bootstrap data. Existing module lists are
  cached read-only; actions that are not native open the connected staging web route
  or explain the offline boundary. No synthetic count or silently queued mutation is
  introduced for visual parity.

## Acceptance for each later screen

1. Compare the rendered web surface and native phone/tablet surface at the same state.
2. Match information hierarchy, terminology, colors, type roles, borders, spacing,
   empty/loading/error states, and permission-specific actions.
3. Document the offline classification before implementation.
4. Prove no lost input during connectivity loss and no dead controls.
5. Run TypeScript, focused mobile/offline tests, lint, and native iOS/Android exports.
6. Capture physical iOS evidence and physical Android evidence before public release.

## EarthCam dispatch correction — build 300003 follow-up

The installed `react-native-webview` dispatcher compares `originWhitelist` entries
against the URL origin, not the complete URL. The former `https://share.earthcam.net/*`
entry therefore rejected valid share pages before our validator ran and could hand
them to the operating system. The regression test now executes that installed
dispatcher (with its native Linking bridge stubbed) and reproduces the old failure.

All candidate navigations now reach the exact HTTPS/host/credential/port validator.
Rejected requests return false without an OS handoff. The initial source is also
validated before mounting because Android does not invoke the callback for the first
load. Popup requests are intercepted rather than opened. External viewing remains an
explicit user action and is unavailable offline.

The player matches the web iframe's 16:9 aspect ratio, exposes loading and retry
states, and starts a fresh player after reconnecting or changing the feed URL.
Cached feeds are filtered to the selected project before rendering. Browser cache
and WebView debugging are disabled. Existing device drafts, photo queues, account
credentials, API endpoints, and production configuration are unchanged.

Offline classification: feed metadata is **offline read-only**; video and feed
administration are **online-only**. No video is represented as a cached live feed,
and no administrative mutation is queued. Open management input continues to survive
connectivity changes in the existing form.

These corrections are local source changes after internal build 300003, not yet
available in that Expo artifact. The automated dispatch test is not native video
playback evidence. Interactive simulator verification was blocked by the locked Mac.
Authenticated playback, feed add/edit/remove, and visual phone/tablet comparison are
still pending. The wider clone requirement is not complete: native-vs-web deep-link
destinations still need correction (the catch-all currently collapses `/new` and
detail suffixes), and the `?export=pdf` handoff does not trigger the web export action.
Those are tracked functional gaps, not accepted substitutes for working controls.
The local follow-up below supersedes the export and daily-log route findings, not
the outstanding full native-workflow or device acceptance requirements.

Verification of this local correction:

- `npm run test:mobile`: 77 tests passed, including five new EarthCam behavioral
  cases. Other source-based assertions remain structural checks, not UI acceptance.
- Root `npx tsc --noEmit`, mobile typecheck, and mobile lint passed.
- `npm run build` remains blocked by the local Turbopack child-process port binding
  restriction (including the permission retry); `npm run build -- --webpack` passed.
- Staging iOS and Android Hermes exports passed. The exported bundles contain the
  expected staging API/database endpoints, the retry control, no alternate full
  database endpoint, and no matching secret-key payload. This limited scan is not a
  comprehensive security audit.
- No backend deployment, store upload, new EAS build, production change, or merge
  was performed for this correction.

## Filtered PDF export and exact daily-log routes — local follow-up

The RFI and Submittal Export PDF buttons now call a bearer-authenticated JSON
endpoint with the currently filtered record IDs. The endpoint repeats the web
read-membership check, reads current data using the caller's RLS-scoped client,
refuses missing/cross-project selections, and renders the same report templates
as the web application. It never accepts client-supplied report values, sends a
credential in a URL, or calls the web Server Action protocol. The selection is
bounded to 500 IDs and the PDF to 2 MiB. Responses are private/no-store.

Offline classification: **online-only**. Report generation needs fresh authorized
data. A failed/offline request does not reset filters, modify drafts, or enter the
outbox. The native adapter writes a validated PDF into the signed-in user's
app-private exports directory and opens the OS share sheet. Normal completion,
cancellation, and errors remove the temporary file. Safe sign-out also removes
that user's exports directory. Process-death cleanup and Android receiver file
lifetime remain device acceptance items; a terminated process can leave its
private file until sign-out. Do not claim those cases have passed from mocked tests.

The PDF skill's render inspection found inherited page-two header loss and crowded
long titles. Both shared templates now repeat table headers and leave a title
column gutter. Two synthetic 12-record reports were rendered and all four pages
visually inspected after correction. These template changes exist only on this
isolated branch; the live web application's PDFs have not changed.

Project deep links now distinguish the daily-log list, `/new`, and an exact record
ID. The bridge is under the signed-in route guard and no longer runs delayed
dashboard redirects after failure/unmount. Selection failures have an explicit
retry. **Offline draft/queue** behavior remains in the existing new-log screen;
cached detail viewing is **offline read-only**. Direct links cannot expose the new
log form without cached edit access, and sync still revalidates permissions.

RFI/Submittal lists, daily-log calendar/list/detail, and team display filter rows
to the selected project, so a cache loaded for A is not displayed under B while
B refreshes. This is a presentation boundary, not a replacement for server
authorization or proof of concurrent project-refresh ordering.

### Remaining parity work — not waived

- RFI/Submittal native creation, response submission, edits, reviews, and attachment
  uploads are not implemented. Read-only details and attachment opening were added
  locally in the follow-up below, but are not yet deployed/device-accepted.
  Existing web handoffs still require native/browser routing
  acceptance. Unimplemented suffixes now remain explicit instead of silently
  collapsing into a module list; the explanatory screen is **not** workflow parity.
- Other More-sheet web modules still need their actual native workflows. They
  are not complete just because their icon or web link exists.
- Daily-log native fields/detail content must be compared with web personnel,
  equipment, work items, location and attachments; matching the list is not proof
  of matching the entire module.
- Exercise EarthCam authenticated playback, retry, feed administration, and
  phone/tablet visual parity on the new native build.
- Deploy the new report endpoint to a unique staging preview, verify with the
  authorized staging reviewer, rebuild native apps with `expo-sharing`, then test
  iPhone/iPad/Android sharing, cancel, sign-out, and account/project switching.
- Recheck project-switch request races and cache availability, beyond the pure
  row-filter tests. No full offline-project-work claim is justified.

### Local verification

- `npm run test:mobile`: 98 tests pass (5 domain, 5 offline, 8 API client,
  58 native logic/structural, 19 mobile API, 3 link-association tests). The new
  server tests use the real Supabase query builder with synthetic mocked HTTP;
  they do not constitute deployed RLS acceptance.
- Root TypeScript, mobile TypeScript and mobile lint pass.
- `npm run build -- --webpack` passes including the new report route. The default
  Turbopack command remains the previously documented host restriction; no claim
  is made that the unmodified `npm run build` gate passed.
- Staging iOS/Android Hermes exports pass. Export success is not native module
  linking or installed-device acceptance.
- Interactive simulator inspection remains blocked by the locked Mac. No new
  EAS artifact, backend deployment, main merge, or production mutation occurred.

## Follow-up: native RFI/Submittal detail reads (local only)

RFI and Submittal rows now open an exact native record route with the selected
project ID. Matching web record deep links resolve to that route; edit suffixes
remain explicitly unfinished rather than collapsing into a different record/list.
Native `/new` forms were added in the subsequent local follow-up below. The route requires a signed-in account and matching bootstrap user
and active project. Its user/project/record key replaces the old component on a
scope change. This does not resolve the broader bootstrap request-ordering gap.

The native detail content follows the web screens: record number/title/status,
submitter/assignee or reviewer, dates, milestone, question/description, RFI answer
and official responses, Submittal timeline/review notes, and attachment metadata.
Metadata cards become two columns on tablet width and collapse with large text.
Edit/review controls are not fabricated as completed native workflows.

Offline classification: **offline read-only** for previously opened detail text;
**online-only** for attachment opening and fresh reads. Text and metadata use the
existing user-and-build-profile SQLite database, keyed by kind/project/record.
An explicit field allowlist excludes signed URLs, tokens, profile emails and
future transport fields. The cache retains at most 50 records, rejects entries
older than 30 days, and caps an individual payload at 2 MiB. Pruning only targets
`record:` cache rows, never drafts/photos/outbox. Existing safe sign-out deletes
the user database. Cache misses, stale copies, storage failures, and unavailable
access are shown explicitly; no read or attachment request enters the outbox.

The bearer detail endpoint rechecks membership (including the existing web admin
exception) and queries through the caller's RLS client. It verifies the parent,
attachment entity/project, and response parent scope. More than 200 attachments
or responses, or a payload over 2 MiB, returns an explicit size error instead of
silently caching a partial record. Pagination for exceptionally large records
remains a follow-up. Denied/deleted records are hidden and removed from the detail
cache on authoritative 401/403/404. If removal fails, the UI asks for sign-out;
physical storage-failure/sign-out acceptance is still pending.

Attachment opening rechecks membership and parent/attachment access, validates
the exact HTTPS Storage origin/bucket/project/entity/record/file path, and requests
a 60-second signed URL using the caller's Storage RLS permissions. The native
adapter validates scope and expiry again. Supported images up to 25 MiB open in
an in-memory preview with `expo-image` disk caching disabled. Other files require
an explicit browser handoff confirmation. No attachment bytes or signed URLs are
written to the record cache. Browser-saved copies are outside app cleanup. Reads
have a 15-second deadline and ignore late results after scope/focus changes;
foreground/reconnect triggers refresh. These are local implementation claims,
not proof of device networking or image-cache behavior.

### Verification and remaining acceptance

- `npm run test:mobile`: 119 tests pass (5 domain, 5 offline, 9 API client,
  69 mobile logic/structural, 28 mobile API, 3 link-association tests).
- New tests cover exact route/API parameters, caller bearer credentials, denied
  membership, cross-project/reference data, size limits, signed-path validation,
  offline cache misses/reads, sanitized/expired caches, transient failures,
  account/project response cancellation, and storage-failure messaging.
- Root and mobile TypeScript, mobile lint, and `npm run build -- --webpack` pass.
  Both record API routes appear in the built route inventory. The previously
  documented default Turbopack host limitation remains; it is not a passed gate.
- The HTTP tests use the real Supabase client with synthetic transport fixtures;
  they are not deployed schema/RLS/storage acceptance. SQLite persistence,
  physical force-close, file handoff, VoiceOver/TalkBack, and rendered phone/tablet
  detail layouts still need acceptance on a rebuilt staging binary.
- Computer Use again reported that the Mac was locked. No simulator screenshot
  or physical-device result is claimed for this follow-up. No backend deployment,
  EAS upload, merge to main, store action, or production/customer-data mutation.
- iOS and Android Hermes exports pass at
  `/private/tmp/railcommand-mobile-record-detail-export`. A limited artifact scan
  found the expected staging API/database URLs and new record endpoints, no other
  full Supabase project URL, and no `sb_secret_` key payload pattern. This is not
  a comprehensive secret audit or installed-native-module/device acceptance.

## Follow-up: native RFI/Submittal creation forms (local only, 2026-08-29)

The list and dashboard New RFI/New Submittal actions now open native forms rather
than a web handoff. They use the existing web shell, field labels, priority and
specification choices, project assignees and milestones. RFI assignee and due
date are explicitly required because the existing database requires them even
though the web form does not mark them required. Submittals retain the web's
14-day default due date. Native date-picker polish and rendered visual acceptance
are not complete.

Offline classification: **offline draft** for text entry; **online-only** for
explicit creation and fresh reference choices. These are NOT new offline outbox
modules. Incomplete input is immediately serialized into `record_drafts` in the
existing user/build-profile SQLite database, keyed by project and record kind.
The draft includes a generated client UUID, fields and an optional creation
receipt; it never expires automatically. Seven-day reference choices contain
only IDs/names. Sync Center lists resumable forms separately from daily-log/photo
queues. Unsynced-work inspection includes these drafts, and existing sign-out
database removal covers them.

Local writes are serialized and recover after a failed write. Malformed saved
input is not deleted or replaced. Navigation removal attempts save first and
stay on the form if saving fails; header navigation is disabled while input is
unsaved or creation is pending. Storage/open errors have explicit retry controls.
Old async responses are guarded by scope; this does not claim resolution of the
broader provider/account-switch lifecycle issues noted earlier.

The new bearer options/create routes use the authenticated caller's Supabase
client, not a service key or Server Action protocol. They check current role and
edit access, validate project references and bound input/options. Creation uses
the persisted UUID as the existing table primary key; the database's existing
numbering trigger assigns the human-readable number. Identical retries return
the extant row; differing content conflicts without an update. A conflict can be
reviewed while preserving the local draft. A saved receipt prevents replay after
normal creation. No migration, database write, deployed endpoint call, email,
Expo upload, store action, main merge or production deployment occurred here.

### Verification and remaining acceptance

- `npm run test:mobile`: 139 pass (7 domain, 5 offline, 10 API client,
  77 mobile logic/structural, 37 mobile API, 3 link associations).
- New tests execute real SQLite statements against synthetic in-memory user
  databases: user/project/kind partitioning, restart via a fresh store instance,
  corrupted-row preservation, receipt cleanup identity, serial write ordering,
  quota-error recovery, expired choices and stale-call prevention. This is not
  physical disk/OS-restart or Expo SQLite device acceptance.
- API tests use the real Supabase client with synthetic HTTP transport: allowed
  payloads, unauthorized/revoked access, wrong project references, insert RLS
  denial, uniqueness races, lost responses, replay and conflict behavior. They
  do not prove deployed PostgreSQL triggers/RLS or an actual concurrent database
  transaction. Session-refresh tests preserve the same creation body/identity.
- Root/mobile TypeScript, mobile lint, and `npm run build -- --webpack` pass. New
  options/create routes appear in the build inventory. The earlier default
  Turbopack environment limitation remains separately recorded.
- iOS/Android Hermes exports pass locally in
  `/private/tmp/railcommand-mobile-record-forms-export`; no updated native binary
  has been uploaded or installed. Internal build 300003 lacks this follow-up.
- The Expo Router 57 vendored `usePreventRemove` adapter must be tested on an
  installed build and revisited on SDK upgrades; bundling alone is not proof of
  native back-gesture or nested navigation behavior.
- The existing staging bootstrap will not supply the new create-permission flags
  until a staging backend deployment, so this build safely disables creation
  with old cached/backend access metadata. Draft editing remains available.
- Attachments, RFI responses/edits, Submittal review/edit, activity events and
  assignee email parity remain unfinished. The forms explicitly disclose that
  they create text only. They are not full web-equivalent creation workflows.
- Before accepting creation for beta: verify exact schema/RLS/number triggers
  using staging fixtures; resolve role/reference changes between preflight and
  insert transaction; decide whether a durable idempotency receipt/tombstone is
  required for retries after the original server row has been deleted. Current
  primary-key idempotency covers extant rows, not that deletion case.
- Physical force-close, low-storage, sign-out during writes, A→B→A navigation,
  background/network transitions, accessibility and phone/tablet visuals remain
  explicit staging acceptance items. The full visual/functional clone goal is
  still open. The live site and production customer data remain untouched.
