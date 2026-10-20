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
  requires a web/backend rollout, not a new bundled implementation. Browser
  emulation is not physical-device acceptance. See the pending gate below.
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
- **Rollout/rollback:** no deployment or TestFlight/Play assignment made by this
  change. Review the PR and complete the gate below, then deploy the web/backend.
  Verify the installed app reloads the same gallery. Roll back the web commit to
  restore the old read; no database rollback or queue manipulation is required.

## Verification

- Production Next build and `npx tsc --noEmit`: passed.
- `npm run lint`: passed with 36 pre-existing warnings; changed files clean.
- Focused photo/collection/cache tests: 31 passed; mobile API/shared domain/client
  tests: 349 passed (these suites overlap on collection/cache tests).
- `npm run check:db-grants`: passed (56 table definitions in 44 SQL files).
- `npm run test:db-grants`: nine static assertions passed; disposable PostgreSQL
  integration could not start because the Docker daemon is unavailable. No schema
  or access grants change in this patch; CI runs that gate on its Docker host.
- Web/mobile action inventory: passed; inventory is not parity/device acceptance.
- Integrated production Next app: local synthetic demo session opened the gallery
  at 390 pixels with no browser exceptions or horizontal overflow. The test build
  used placeholder public Supabase configuration; it is not a deployable artifact
  or evidence of live authenticated backend access.
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

## Pending release gate — PHOTOS-PAGE-ACCEPTANCE

The PR must stay a draft until the following checks are recorded. These are
explicit acceptance gaps, not passed checks:

- [ ] Authenticated staging query and Storage/RLS smoke with synthetic records,
  including a removed membership and a user from another project. The connected
  Supabase account did not permit SQL reads for RailCommand in this session.
- [ ] Web -> installed iPhone/iPad and Android workspace: upload a synthetic photo
  on web, refresh the same authorized project on device and find it; exercise
  categories and more than one page, lightbox, camera/file picker, and retry.
- [ ] Mobile workspace -> web: upload a synthetic photo, refresh web and find it;
  confirm the older native API, current account/project identity and permissions.
- [ ] Physical network loss/reconnect with a pending gallery upload, plus app
  background/foreground and OS restart. Confirm the online-only limitation and
  independently check existing native Field drafts/queues survive the update.
- [ ] Confirm no-query/older installed-client reads on staging and compare bounded
  page response sizes plus `Server-Timing` stages. Record deployed revision and
  tester/device/build IDs here or in the PR before accepting release.
