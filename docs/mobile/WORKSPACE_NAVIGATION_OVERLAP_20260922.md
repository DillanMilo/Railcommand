# Workspace navigation overlap — September 22, 2026

## Scope and impact

User requests faster screen switching and external TestFlight invitations for Caleb
and Mark. This change addresses the avoidable route-then-collection request delay
on Documents and Photos. It does not claim every load is instant or eliminate
network/server time.

- Web/mobile shared workspace: More prefetches the two dynamic routes while its
  links are visible. Selecting either starts its existing authorized collection
  read immediately, allowing navigation and data fetching to overlap. The mounted
  screen shares that read only while it is unfinished.
- Each mounted ProjectProvider owns the pending reads, partitioned by real/demo
  mode and user. Changing identity or unmounting cancels and clears old work.
  Collections/projects have separate keys; settled responses are removed. Later
  visits and retries perform fresh server reads. A 15-second abort prevents hung
  reads from remaining pending indefinitely.
- API/domain/database: no endpoint, query, permission, schema or mutation changes.
  Requests keep same-origin credentials, no-store and redirect refusal. Existing
  authorized actions/RLS continue to control all access.
- Offline classification: **online-only** Documents/Photos. Navigation preparation
  skips when disconnected. This adds no offline cache and no persistent record
  storage. Native Field Tools **offline draft/queue** payloads and existing drafts
  are unchanged; no queue purge, delivery or conflict resolution is implied.
- Native bundle: unchanged. Build 300012 receives the shared web change after
  reopening/reloading its workspace. Existing older supported workspace clients
  keep the same API contracts and authentication protections.
- Release-source changes are carried in both backend and candidate worktrees.
  Root checkout contains separate unfinished work and is not the deployment source.

## Verification and release

- 23 focused workspace tests pass in an isolated copy of the exact pushed backend
  source plus this patch, including new pending-only deduplication, fresh reads,
  user/project/collection separation, aborted-session races and denied-read retry.
- Existing authorization, ticket, client-navigation and public-cache tests pass.
- Full build, final TypeScript/lint, candidate compatibility and deployed phone
  latency observations are recorded below when completed.
- No live field record has been created, edited or deleted for this change.
- Before release, railcommand.io resolved to dpl_Ecd6PajWijoFUJKaBt8qQNqSbSui;
  this is the rollback deployment. Staged/promotion IDs remain pending.

## External distribution

Fresh Apple readback still shows build 300012 READY_FOR_BETA_SUBMISSION, no external
build assignment, and Mark/Caleb NOT_INVITED. Review contact, description and notes
are prepared; dedicated demo-only review login is missing. Owner was asked for the
email only. Password must be entered privately. Apple review/privacy and physical
save/photo/web-readback/PDF acceptance remain open; this performance patch does not
satisfy those gates. No invitations or review submission have been sent.

## Released result

- Backend runtime commits dc22bc5 + 7ffc69f; matching candidate commits 8d439f3
  + ede2931 are pushed. Final backend CI 35775755357 passed (the preceding
  navigation-only CI 35775428664 also passed).
- Photos now renders an explicit error with Retry on a failed collection read,
  rather than presenting that failure as an empty library. No attachment mutation.
- Backend production build, standalone TypeScript, focused lint and all 23 workspace
  tests pass. Candidate web TypeScript passes in a clean source snapshot using the
  verified backend dependency installation plus links to its checked-in workspace
  packages. No native bundle change or new native build was required.
- Local checkout reads/build tools stalled. Verification used exact GitHub release
  archives plus only the patch and clean locked backend dependencies in /tmp; no
  existing dependency folders were deleted or rewritten.
- Final staged deployment dpl_24dy7zEsST2H7edtbcU1uLwPVTfd built successfully and
  was promoted to railcommand.io; live alias readback confirmed the same ID.
  URL: https://railcommand-qfgegb7i4-dillans-projects-f662840b.vercel.app
  Rollback: dpl_Ecd6PajWijoFUJKaBt8qQNqSbSui.
- Staged and live unsigned Photos/Documents requests redirect to application login
  (307, no project data). Native bootstrap returns 401 with no-store. Collection
  handler private/no-store behavior remains covered by focused tests; login-redirect
  headers are not evidence about an authenticated handler response.
- Post-release physical latency verification is pending: Mirroring resumed to
  “iPhone in Use — Lock your iPhone to connect.” The existing phone session was
  not reset, signed out, reinstalled or used for test writes.
- External invitations remain NOT_INVITED; no review submission or email sent.
  Apple browser sign-in is now accessible. The missing demonstration-only review
  account is still the concrete submission blocker. App Store release metadata is
  separate from TestFlight metadata; do not assume the blank public App Store
  submission form itself blocks beta review. Privacy declaration status remains
  unverified, rather than asserting Apple has rejected it.
