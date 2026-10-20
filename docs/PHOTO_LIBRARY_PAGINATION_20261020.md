# Project photo gallery pagination — October 20, 2026

## Change and evidence

Photos & Media now reads and signs at most 12 photos per page, with All, Standard
and Thermal filters applied on the server. Previous/Next use a stable descending
`(created_at, id)` cursor; timestamps retain Postgres microseconds. A thirteenth
row is read only to decide whether another page exists and is never signed or
returned. The gallery displays a page count rather than treating a partial page
as the project total. Refresh and successful upload/deletion return to page one.

The October 19 audit observed a 3,464 ms p95 Vercel function duration for the photo
page (114 invocations), and 2,163 ms for the combined photos/documents collection
route (45 invocations). These are observational server timings, not browser load
times, a demonstrated regression, or proof of a specific bottleneck. The old
read fetched five entity-ID collections, up to 1,000 attachments, then signed all
matching photos. The new gallery read queries indexed `attachments.project_id`
directly and signs only the page. Synthetic SDK transport tests confirm the
bounded read, including photos behind 1,100 document rows and tied timestamps.
No production latency improvement has been measured yet.

The opt-in GET adds `?page=cursor&category=all|standard|thermal`, with an optional
JSON `cursor={createdAt,id}` value. It returns `{data,nextCursor}`. Successful
private responses include `Server-Timing` stages for authentication, membership,
attachment query, signing and total service duration. Browser Network tooling
can inspect these headers; no tokens, project IDs or file names are included in
the timing header. Collect representative authorized staging timings before
release and compare production p50/p95 and response bytes after rollout.

## Web/mobile and offline impact record

- **Product announcement:** the notification bell's Updates section includes
  “Photo Gallery Improvements” (v2.8.1), describing page navigation, category
  filters, refresh, retained pending uploads and the online requirement. The
  existing shared workspace Topbar and RailBot's product-update summary consume
  the same patch-note entry. This is bundled announcement content, not an OS push
  notification or a change to the native Field notification-settings control.
  It becomes visible with this web/backend release, after page refresh; it is not
  being announced separately on current production before the feature ships.
- **User-visible change:** smaller gallery pages and server-side category filters.
  Refresh/retry messages distinguish unavailable previews from removed records.
- **Web:** Photos & Media uses the new cursor read. Its upload component stays
  mounted while pages load, fail, change filter or reconnect. Account/project
  changes remount the gallery; aborted/stale requests cannot populate another
  scope. Page navigation remembers cursors in memory only.
- **Mobile:** the existing project gallery is delivered in the shared online
  workspace. The same responsive gallery/hook therefore handles its reads and
  filters after a web refresh. Native source at `codex/mobile-beta-20260910`
  (`75d9145`) was inspected: `apps/mobile/src/app/workspace.tsx` mounts the
  authenticated, account-scoped WebView and covers it while offline. This change
  requires a web/backend rollout, not a new bundled implementation. Physical Safari acceptance and the separate installed-app gap are recorded
  below; Safari does not establish native WebView acceptance.
- **Native Field tools:** their separate offline daily-log capture, persisted
  drafts, photos, outbox, authentication and sync APIs are unaffected. No native
  files, queue payloads, operation identities, idempotency keys or shared domain
  contracts change. The mobile/shared-contract test suite remains passing.
- **Shared API/domain/database:** an additive opt-in web/workspace transport uses
  the existing cookie-authenticated Supabase client, membership checks, attachment
  RLS and Storage signing authorization. No service-role reads, SQL migrations,
  grants, RLS policy changes, new tables or dependencies. Native bearer APIs and
  the existing no-query `{data: Attachment[]}` collection response are retained.
- **Offline classification: online-only.** Gallery reads need authorized records
  and short-lived URLs. The screen explicitly says so and disables paging/filter
  controls while disconnected. The current page and pending upload are retained
  for the lifetime of the mounted page; reconnect retries the current read. This
  does not introduce durable offline gallery storage. Closing or OS-terminating
  the workspace can lose a pending gallery upload; its original remains on the
  device and native Field tools provide the existing offline draft/queue path.
- **Private data/cache boundaries:** paginated and legacy responses are private,
  no-store, and vary by Cookie/Authorization. Signed URLs/project records are not
  written to public Cache Storage, localStorage or a shared module result cache.
  Existing sign-out cleanup and account isolation remain in place.
- **Permissions, retries and conflicts:** every page reauthenticates and checks
  membership before an RLS-constrained read; Storage reauthorizes each signed
  path. Missing/failed previews remain visible with retry guidance. Cursor inputs
  are validated before interpolation into filter syntax. Read-only cursors need
  no mutation idempotency or conflict protocol. Concurrent new uploads appear on
  refresh; deletions can shorten a page, and Previous/Refresh remain available.
  Existing upload/delete authorization and idempotency contracts are preserved.
- **Installed clients:** no-query collection callers and daily-log library
  selection retain the existing transport. The daily-log picker keeps its full
  library/date-priority behavior and is not migrated by this gallery patch;
  pagination there remains a separate optimization. The new gallery does not
  require any queued payload migration or destructive storage reset.
- **Rollout/rollback:** production has not been deployed for this change; no
  TestFlight/Play build or tester assignment is needed for the shared gallery.
  Protected staging previews are recorded below. Review the
  PR and complete the gate below, then deploy the web/backend.
  Verify the installed app reloads the same gallery. Roll back the web commit to
  restore the old read; no database rollback or queue manipulation is required.

## Verification

- Production Next build and `npx tsc --noEmit`: passed.
- `npm run lint`: passed with 36 pre-existing warnings; changed files clean.
- Focused photo/collection/cache tests: 32 passed (24 photo tests after the
  relative-URL regression fix plus eight collection/cache tests); mobile API/shared domain/client
  tests: 349 passed (these suites overlap on collection/cache tests).
- `npm run check:db-grants`: passed (56 table definitions in 44 SQL files).
- `npm run test:db-grants`: nine static assertions passed; disposable PostgreSQL
  integration could not start because the Docker daemon is unavailable. No schema
  or access grants change in this patch. GitHub CI on `e25bc0a` passed the
  disposable PostgreSQL integration, auth/mobile compatibility, focused photos,
  lint, TypeScript and beta-account gates (run `39459395803`).
- Web/mobile action inventory: passed; inventory is not parity/device acceptance.
- Integrated production Next app: local synthetic demo session opened the gallery
  at 390 pixels with no browser exceptions or horizontal overflow. The test build
  used placeholder public Supabase configuration; it is not a deployable artifact
  or evidence of live authenticated backend access.
- Announcement follow-up: the built app's Notifications -> Updates displays
  v2.8.1 in desktop Chromium at 1440 pixels and phone-sized WebKit at 390 pixels.
  The WebKit check uses local HTTPS and synthetic demo/health responses; this is
  announcement UI evidence, not live authentication or physical-device acceptance.
- `scripts/e2e-project-photo-pages.cjs`: Chromium at 1440 and 360 pixels and WebKit
  at 390 pixels passed page traversal, server filters, retained pending upload
  through failed reads, offline/reconnect, delayed response isolation across
  account/project changes, absence of horizontal overflow and browser exceptions.
  The fixture uses the real gallery, React hook, upload preparation and built
  styles, with synthetic session/API/upload boundaries. It never writes live data.
  To rerun: build the app, make Playwright available (or set `NODE_PATH` to the
  bundled runtime packages), install Chromium/WebKit, and run
  `node scripts/e2e-project-photo-pages.cjs`. Optional screenshots are written to
  `RAILCOMMAND_E2E_SCREENSHOT_DIR` when supplied.

## Staging acceptance progress — October 20

The designated Supabase staging backend, `rxuvchdqbzvovqijvfhx`, was paused. It
was resumed and returned `ACTIVE_HEALTHY`; its Auth health check returned 200.
Production Supabase and `railcommand.io` were not changed. All test writes used
two newly created synthetic member accounts and projects with identifiers
`a1020000-0000-4000-8000-000000000001/2` and
`b1020000-0000-4000-8000-000000000001/2`. No existing account, project, device
draft, queue, idempotency identity or installed native binary was modified.

Staging preview `dpl_CZGVRf4QzwnnM6MVpx1ZEbA234EU` ran source `3ccab90`.
Normal authenticated uploads and attachment inserts created 25 synthetic
daily-log photos. Actual deployed pagination returned 12/12/1 rows; Standard
returned 18 and Thermal 7. Every page had private/no-store headers and signed
previews; a signed image request returned 200. The first page was 25,488 bytes
versus 52,876 bytes for the unchanged 25-row legacy response. Three observed
service totals were 889.4, 611.5 and 290.8 ms. These are individual staging
samples, not p95 measurements or evidence of production improvement.

An authenticated member received 403 for another synthetic project; the other
project's user saw zero attachment rows through RLS and could not sign its
Storage objects. Removing the first synthetic membership made the deployed
paginated route return 403 and direct attachment reads return zero rows. The
membership was restored afterward. Invalid category input returned 400; the
legacy array transport and native bearer bootstrap returned 200.

Review of the existing gallery upload contract found that it stores relative
Storage URLs. The paginated reader now accepts that existing format when deriving
the bucket path, while retaining the project-prefix check and authenticated
Storage signing. This fix does not rewrite records or files. A regression test
uses the existing uploader's project/user path format. Build, standalone
TypeScript, changed-file lint and 24 focused photo tests passed after the fix.
Corrected source is `e25bc0ab22f669813c311e263fdbc42e23985aa1`; its staging
preview is `dpl_F8Dm4kb2Vq4aoJNUGks87HjFmLn2`. A 26th synthetic attachment
references an existing test object using a root-relative URL for verification.

The corrected staging preview returned 12/12/2 rows, including the relative-path
fixture with an authorized signed preview. Standard returned 19 and Thermal 7;
legacy reads returned all 26 rows. Response sizes were 25,488, 25,495 and 4,223
bytes versus 54,956 bytes for the legacy read. Observed service totals were
720.2, 516.6 and 377.6 ms. Cross-project denial, Storage/RLS isolation, invalid
input and native bearer bootstrap passed again on this revision.

Actual authenticated browser checks against that deployment passed in desktop
Chromium (1440 pixels) and phone-sized WebKit (390 pixels): paging, filters,
signed-image lightbox, no overflow, offline page retention and disabled paging,
and recovery after reconnect. Neither browser reported uncaught exceptions.
These checks use real staging services, not fixture API interception.

Staging has older, deliberately restricted provisioning: direct `project_photo`
uploads are denied. Its notification sheet initially failed because the existing
`user_notifications` table and profile avatar field were absent. Staging-only
migration `20261020164250_staging_notification_acceptance_prerequisites` applied
the existing reviewed notification creation SQL and added nullable
`profiles.avatar_url`. It did not backfill existing records. Verification found
RLS enabled, no anonymous SELECT, authenticated SELECT but no INSERT, and UPDATE
limited to read/dismissed state rather than content. The new table contained zero
rows. After explicit user approval, staging-only migration
`20261020164626_staging_activity_read_transport_grant` granted authenticated
SELECT on `activity_log`; its unchanged RLS has no SELECT policy and still hides
every activity row. No write grant or activity policy was added. The live
notification bell then displayed v2.8.1 in both authenticated browser checks.
Production schema, grants, records and deployed source were not changed.

The paired physical iPhone 17 Pro Max reports iOS 27.0 and production
RailCommand 1.0.0 (300012). Although iPhone Mirroring failed, Xcode Device Hub's
screen viewer allowed physical touch testing. Safari reached the protected
`e25bc0a` staging preview through its existing Vercel authentication; no shared
bypass URL or reduced deployment protection was used. A new test tab used only
the synthetic staging member account. Its password was not saved to Keychain.
Existing personal tabs were retained.

On physical Safari, the same synthetic project showed All (12 on its first
page), Thermal (seven), and Standard (12 then seven on page two). Next and
Previous traversed the Standard pages; the first page returned after Previous.
The signed-image lightbox opened a synthetic fixture and displayed its filename,
size and image. The responsive layout and page controls fit the device. The
notification bell's Updates section displayed “Photo Gallery Improvements,”
v2.8.1, with the online requirement and pending-upload explanation. The photo
chooser offered Photo Library, Take Photo and Choose File; it was dismissed
without selecting a personal file or taking a photograph. No camera permission
was granted and no physical upload was performed.

The separately installed staging app opened an existing synthetic project and
its Field tools (nine cached logs and two cached team members). This older staging
binary presents deferred web modules rather than the current shared workspace;
it cannot establish acceptance of this gallery. The production app was launched
without reinstalling or signing out, but remained on a loading spinner before
its workspace opened. It subsequently completed the authenticated session
handoff and opened the existing signed-in project. Native Field tools and the
account view also opened; returning to the photo workspace began normal page
loading. The sign-in was retained across background/foreground. Build 300012's
release handoff identifies native source `6f99e79`; the later inspected candidate
source is `75d9145`. Workspace, workspace-policy and API-client sources have no
diff between those revisions. An installed-app check is separate from testing the new UI
in physical Safari.

A private read-only copy of this production app's offline SQLite files passed
`PRAGMA integrity_check`. Its current user scope contained zero daily-log drafts,
record drafts, RailBot drafts, outbox operations and queued photos at this
checkpoint. This is a baseline for this phone/account, not evidence that the
September conflicted entries on another scope/device were delivered. Copies are
local/private, not repository artifacts or an uploaded user-data backup. No app
reinstall, sign-out, device restart, manual queue replay or data reset was
performed. Existing drafts/conflicts were not discarded or reassigned.

The Android API 36 phone emulator booted with an older installed 1.0.0 (300001);
its native UI was not accepted. The user has no physical Android test device.
Physical Android remains an explicit device gap, not a passed check. The existing
offline alpha's iOS/Android restart/network gate is separate and is not advanced
by this read-only gallery work.

### Staging hostname and remaining device setup

The existing public staging hostname `mobile-staging.railcommand.io` was verified
to point to the older preview `dpl_37ak9wcmcCa9vd3YAr5MKAoniEqS`. It now points to
the accepted `e25bc0a` preview `dpl_F8Dm4kb2Vq4aoJNUGks87HjFmLn2`.
Unauthenticated mobile bootstrap on that hostname still returns 401. Deployment
protection settings were not changed. Roll back this staging alias to the former
preview if needed. `railcommand.io` and its production deployment remain unchanged.
The Vercel project's separate Development/Production variable targets still refer
to an older backend; they were not edited or used for this preview. Those variable
targets do not identify the deployment serving the custom staging hostname.

The installed staging app's existing local scope is distinct from the production
scope. A private read-only SQLite copy also passed integrity checking and found
zero saved drafts, outbox operations and queued photos in that staging scope.

The user explicitly approved the narrower staging membership and the blank-card
photo/network checks. One membership was added for the staging account already
on the device (`ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0`) only in synthetic project
`b1020000-0000-4000-8000-000000000001`: contractor role with `can_edit=true`,
membership `79f33e4f-7cd2-45ba-af2d-a0b297fd6f7b`. An authenticated-role RLS
read for that account returned the 26 synthetic photos. No production membership
or existing project access was changed. The earlier two-manager request was
rejected and never applied. The private-profile email/name lookup was also
rejected; no profile details were returned or used.

The staging hostname passed the authenticated API checks again without a Vercel
bypass header: 12/12/2 photos, filters 19/7, legacy 26, RLS/Storage denial and
native bearer bootstrap. Isolated desktop Chromium and phone-sized WebKit also
passed gallery paging, filters, signed lightbox, offline retention/reconnect,
layout and the v2.8.1 notification entry on this hostname with normal cookies
and no bypass header; both had zero uncaught exceptions. Response bytes remained 25,488/25,495/4,223 versus
54,956 legacy bytes. Service totals in this additional run were
1,101.2/727.9/333.7 ms; these remain individual staging samples.

The Mac device viewer regressed to a scaled window thumbnail and then a
ScreenCaptureKit capture failure. Phone actions stopped when the view could no
longer be read reliably. The user was asked to reopen Device Hub and restore
View Screen; the approved physical photo/network checks remain pending that
readable view. Both a fresh app selection and an accessibility-only read still
failed with screen-capture errors. No blind phone actions were attempted. A
synthetic 600-pixel test card is prepared locally for the approved camera check.
Existing apps, sessions and stored data remain in place. CI on documentation
revision `4418837` passed in 2m7s; its Vercel preview passed as well.

### Mac viewer recovery and installed staging readback

At the user's request, Device Hub alone was force-quit and reopened through the
Mac's normal recovery controls. No RailCommand app was stopped, replaced,
uninstalled or signed out. Moving the viewer to another connected display
restored a readable phone feed temporarily. The installed staging app refreshed
its authorized project list, showed the newly approved synthetic project and
selected it successfully. Its Logs view displayed the web-created synthetic
October 20 daily log; its detail showed the exact synthetic work summary. This
is physical older-client web-to-native daily-log readback, not acceptance of the
new shared-workspace gallery or photo readback.

Opening New Daily Log in that synthetic project created one automatically saved
device draft. No test text, camera photo, upload, queue submission, network change
or restart was completed. A subsequent private read-only staging SQLite copy
passed integrity checking: one draft, zero outbox operations and zero photos,
compared with the prior zero/zero/zero baseline. The synthetic draft remains on
the phone for normal resumption; no stored draft or queue was discarded.

The viewer repeatedly returned to a transformed thumbnail and then capture
errors (-3811/-3812), including after a second Mac-viewer-only restart and a fresh
control session. Phone actions stopped when the view was unreadable. The user
was asked for an uninterrupted foreground Device Hub session before continuing.
All staging membership and blank-card/network approvals are already granted;
the remaining issue is reliable device control, not missing approval. CI and
Vercel checks on documentation revision `a0b49c4` passed. The release gate below
remains pending and production remains unchanged.

### Physical camera check: installed staging failure

With the Mac made available, the viewer displayed the phone clearly after Window
-> Bring All to Front. Native coordinate input still failed with
`noWindowsAvailable`, although Mac accessibility controls and screenshots worked.
The user therefore performed the approved one-photo capture in the synthetic
project's saved draft and reported that its count showed one but no preview.

The phone displayed a red “Photo could not be saved on this device. Free storage
and try again. The draft remains saved.” banner. The inspected native form renders
a photo count rather than thumbnails, so the missing preview alone is not proof
of failure. The save banner and local persistence discrepancy are the failure:
a fresh private SQLite copy passed integrity checking but contained one synthetic
draft, zero photos and zero outbox rows. Rebuilding the WAL index in a separate
local forensic clone produced the same counts. No device database was edited.

The app-owned synthetic photo file nevertheless exists (297,180 bytes, readable
JPEG, 3024 x 4032). A private read-only copy of that exact test file was preserved
locally and visually decoded successfully. It shows a plain blue surface with no
personal material. The file and draft were left on the phone; no cleanup,
submission, network transition or restart was attempted after the save failure.
The user was told to keep the draft open and not submit or retake it. The private
copy is evidence/preservation for the synthetic test only, not a full user backup.

This is an installed older staging binary's local capture/persistence failure,
not evidence of a gallery API regression. Its exact underlying exception and
installed binary source revision remain unverified; the generic error does not establish
that device storage is full. A current isolated native QA build with an observed
save error and verified file-to-SQLite persistence is needed before claiming the
native photo flow passes. Do not repair this by directly inserting device SQLite
rows, reinstalling/resetting the existing apps, or submitting a photo-less draft.
The physical photo gate remains failed/pending and PR #25 remains a draft.

Read-only EAS inventory found completed staging build 300003 at source `7758aeb`
(build `9e66f8a0-750e-4b99-9b61-830e81fcf335`) and 300002 at `679f5bb`.
There are multiple completed 300001 staging artifacts (`1896799`, `3c494bf`,
`f8f79a5`), so the installed build number alone does not select an exact source.
Those staging builds predate the current shared-workspace binary. No newer
staging build was created or installed during this check. Track the native
capture/persistence diagnosis as **PHOTOS-NATIVE-PERSISTENCE**, a dependency of
PHOTOS-PAGE-ACCEPTANCE: observe the underlying file/SQLite exception in an
isolated native QA build, preserve the failed file/draft, verify durable
file-plus-photo-row storage, then repeat native-to-web, retry and lifecycle tests.
Do not attribute the native failure to PR #25 without a measured comparison.

## Native photo-save repair and current acceptance — October 20

The earlier unknown-exception note is superseded by the native investigation in
[linked PR #26](https://github.com/DillanMilo/Railcommand/pull/26). Expo FileSystem
57 performs `File.copy()` asynchronously. The shared camera/import helper read
the destination size before awaiting the copy, allowing a missing-file failure
and late orphan. The repair awaits the copy before reading size or returning
attachment metadata. Three delayed/rejected-copy regression tests fail against
the previous code and pass with the repair; the full native suite has 247 passing
tests. No schema, UUID, path, idempotency or API contract changes were made.

Native behavior remains **offline draft/queue**; the gallery/workspace remains
**online-only**. Native source is maintained on the linked native release branch;
its older web backend must never be deployed over canonical main. Existing
production mobile API compatibility remains covered by PR #25's checks.

Signed Staging iOS 1.0.0 (300004), EAS build
`d7043bc1-0a3c-45db-bd63-0ebcce7e6e8f`, was installed as an in-place update under
the same staging bundle/team identity. Private read-only pre/post comparisons
verified every baseline draft/photo/outbox row and app-owned file was preserved,
with SQLite integrity intact. The original failed synthetic JPEG remains intact.
No app uninstall, sign-out, cache/queue purge or direct device-database write was
used. A later read-only check still shows the original synthetic draft and no
new photo metadata; the user was on the dashboard. The fixed capture, durable
photo row, network/restart preservation and native-to-web synchronization are
therefore **still pending**, not passed.

Production iOS 1.0.0 (300013), EAS build
`1f002d45-76ea-4a28-8851-54a27d7d9bdc`, is built and its production bundle/team
identity was verified, but it is not submitted, distributed or installed. A web
merge alone cannot ship this native file-copy correction. Physical Android is
unavailable; track that supported-platform acceptance gap explicitly rather than
claiming completion of the separate offline-alpha gate.

The existing staging hostname now serves fresh PR #25 source `0017453` as
`dpl_7isL3ynZXr9vmcLDQuGyTm1scxYi`. The staging Preview configuration now enables
the existing workspace entry gate; application authentication, RLS and production
settings are unchanged. Real synthetic native bearer -> one-use handoff -> web
cookie -> authorized paginated photo read passed (200/303/200, first page 12);
replaying the ticket was rejected with 403. Device WebView acceptance remains a
separate pending check. Production railcommand.io remains unchanged.

## Release checks and tracked coverage

Required core release checks (PHOTOS-PAGE-ACCEPTANCE):

- [x] Authenticated staging query and Storage/RLS smoke with synthetic records,
  including removed membership, an outsider and the relative Storage URL format.
- [x] Real desktop Chromium/WebKit phone gallery paging, filters, lightbox,
  network-loss/reconnect and page-lifetime pending-upload retention; physical
  iPhone Safari paging/filter/lightbox/bell. Production mobile APIs retained.
- [x] Web-created synthetic daily log and its 26 saved photos opened in the
  installed iPhone's online workspace. Native bearer -> one-use web handoff ->
  authenticated photo paging passed, and replay was denied.
- [x] Fixed signed Staging 300004 installed in place with baseline row/file
  preservation; actual physical native camera save now has a readable 3,022,716
  byte file and matching SQLite photo row under the original draft/client UUID.
- [ ] Submit the original synthetic native draft through its normal outbox,
  verify exactly one parent/photo receipt and authorized signed web readback.
- [ ] Native compile gates, signed production distribution, exact main/web
  deployment and availability verification.

Explicit follow-ups, not passed checks:

- **PHOTOS-DEVICE-LIFECYCLE:** physical OS restart and disconnected reopening,
  plus network disruption with a pending upload in the actual native WebView.
  The user questioned the disproportionate restart/repeat burden after the fixed
  capture passed. No repeat capture or phone restart is required for this small
  await-only repair; retain the existing automated draft/queue/retry tests,
  measured in-place data preservation and normal camera-return lifecycle evidence.
  Track these extended scenarios for the broader offline-alpha acceptance rather
  than claiming they were completed here. No offline-alpha advancement.
- **PHOTOS-ANDROID-DEVICE:** supported Android physical camera/import, update,
  offline/restart and WebView acceptance remain untested because the user has no
  Android device and supplied an iPhone. Android compile/export checks do not
  replace this gap. This release must state the limitation explicitly.
- **PHOTOS-MOBILE-EXTENDED:** repeat category/paging/lightbox and workspace file
  picker/retry inside current native WebView; physical Safari/WebKit coverage and
  installed authorized workspace readback are the current evidence. The gallery
  remains online-only and does not promise durable background uploads.

Earlier broader all-device checklist is superseded by this scoped release record;
none of its unexecuted checks is relabeled as passed. Main remains unmerged while
normal native-photo synchronization and release verification are pending.


### Normal submission: same-day safety review retained both items

The user submitted the synthetic native draft once. A private read-only snapshot
passed integrity checking and showed the atomic draft-to-outbox transition:
zero drafts, one conflicted parent operation and one conflicted photo. The
original parent/client UUID, photo UUID and project UUID remain unchanged. The
message is the expected same-day review because the existing synthetic web
report has today's date; no existing report was overwritten. Two items means
one parent and its child photo, not two separate logs. The user was directed
through normal Review saved log -> Keep as a separate log -> Keep separate log.
Confirmation and actual server delivery/readback are still pending. No direct
SQLite edits, date reassignment, cleanup or manual server replay were used.

The bell description now also directs users to update RailCommand through
TestFlight for the native iPhone Field Tools photo-save fix. Its publication
remains coupled to the gallery/native release, not a premature live announcement.
