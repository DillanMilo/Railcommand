# Native update notice activation — 11 November 2026

## Problem and result

Recent production native builds already show **Update available** with **Later**
and **Update**, using the authenticated app-release endpoint. Its server catalog
still advertised broadly available build 300012, so the newly released Inventory
build 610011 would not produce a notice. Advertise 610011 to the five confirmed
existing Field Beta app identities, matching its released TestFlight audience.
Everyone else retains the previous broadly available release until wider rollout
is authorized and actually available. Notification targeting does not enroll a
user in Inventory or grant a project/role/finance permission.

The five identity values are held only in the existing Vercel project's
server-only `MOBILE_IOS_UPDATE_PILOT_USER_IDS` setting, not Git/client code.
The selector uses the verified authenticated subject, never a caller-supplied
user ID. Missing or malformed configuration falls back to the general release.
A later general release supersedes an older pilot so pilot users are not stranded.
The existing nonmember tester may receive an app update but still gains no project
or Inventory access. There is no database/schema/membership migration.

## Web/mobile/offline impact

- Web: server-only release selection changes; browser/PWA users are not sent to
  TestFlight. All other routes and app behavior stay unchanged.
- Native iOS: existing bundled prompt is reused; no new native build is required
  for this catalog activation. It checks on safe Dashboard/Workspace focus and
  foreground, at most every 15 minutes after successful checks. Each newer build
  prompts once per app session; reopening the app can remind an unupdated user.
  Current/equal/newer installed builds are not prompted to downgrade.
- Installed clients: preserve schemaVersion 1 and the same ios payload. Old builds
  without the prompt (including 300012/300013) need one manual TestFlight update;
  a server deployment cannot add bundled native UI to those builds. Subsequent
  updates use the popup. This is the existing production bundle/app identity.
- Shared domain/API: same versioned read contract; identity-scoped server selector.
  No private targeting identities, credentials or project data enter the response.
- Android: never send Android users to TestFlight; its store update destination
  remains UPDATE-NOTICE-STORE-CHANNEL when Android store distribution is enabled.
- **Offline classification: online-only update discovery/handoff.** Offline or
  failed checks stay quiet and do not block work. Checks retry after reconnection
  on a safe screen. Existing stock caches, device drafts, queues, client IDs,
  idempotency keys, attachments, permission checks and synchronization are unchanged.
- Safety: no popup over native creation/review forms or dirty/loading/exporting
  Workspace. Update never reloads or resets the app; the user chooses to leave.
  The fixed RailCommand TestFlight link falls back to Apple's TestFlight listing;
  an OS failure gives a readable message. This is not an automatic installer.

## Required step for every future native release

1. Choose a native production build number higher than the last published build
   (currently 610011); do not resume the older 300xxx sequence. Verify Apple approval, **Testing** status and the intended existing TestFlight
   group's access. Do not announce a queued, uploaded or private-only build to
   users who cannot install it. Keep pilot and wider audience rules separate.
2. Update the published native build number/version in the server catalog and
   the private audience setting for that rollout. For a general release, advance
   `availableMobileRelease` only after the intended general audience can install.
   Never rely on the marketing version alone; 1.0.0 builds still differ.
3. Run release-selector/route, native prompt and domain/client tests, web build
   and TypeScript. Stage/promote the verified compatible web/backend change.
4. Verify an authenticated audience member gets the new metadata and an outsider
   gets only their available release; unauthenticated calls stay 401/no-store.
   Check **Update → RailCommand in TestFlight** on the first real iPhone tester.
5. Record the deployed commit/build/group and prompt check in the release handoff.
   Every released native update includes this catalog/notice step. Uploading or
   TestFlight email notification alone does not activate this in-app notice.

## Validation / release status

Focused server/domain/client tests: 11 passed. Existing native checker/component
wiring tests: 11 passed, including actual Update/Later button wiring, fixed link
and fallback, one prompt per build/session, next newer builds, offline/timeout,
stale account/screen suppression and no storage dependencies. Native TypeScript
passed. Production web build, root TypeScript and focused ESLint passed.
Production activation is recorded below.

Physical deep-link/reopen acceptance remains **UPDATE-NOTICE-DEVICE**, now included
in the existing first pilot iPhone gate INV-REL-05. Do not claim installation,
physical TestFlight handoff or wider Inventory acceptance from mocked tests.
No additional pilot release or wider enrollment is authorized by this change.

The standing update-notice release requirement is also recorded in repository
`AGENTS.md`, which future changes must read.


## Production activation result

- Deployed source: `629d619f03db61ee569619a552574c60a4bbdf55`, branch
  `feature/inventory-beta-release`; no merge.
- Vercel `dpl_EWSRRTMojHCE3DWrc2gBet4tFZes`: production staged without aliases,
  verified READY and promoted unchanged to `railcommand.io`. Prior compatible
  release: `dpl_CEZMYZPnCxCTihPx1H71jufWcqf3`.
- The connector could not manage project environment settings (403); the existing
  authenticated CLI managed the same explicitly verified team/project instead.
  Exactly one new production Secret holds the five confirmed existing field-beta
  app identity IDs. No existing variable, authentication or project access changed.
- Saved configuration checked with the actual selector: all five targeted app
  identities select 610011; an outsider selects 300012. A later general release
  overrides a lower pilot. No identities are returned in release metadata.
- Staged login 200; unauthenticated app-release and bootstrap 401/no-store.
  Public live app-release 401/no-store after promotion. All 22 previously released
  mobile routes retained. Authenticated response selection is covered by the
  endpoint and saved-configuration tests; a real-user device pop-up/OS handoff is
  still pending the first pilot check, not claimed from these HTTP probes.
- Checks passed: 11 server/domain/client release tests, 11 existing native update
  checker/component tests, 7 mobile pilot-boundary tests, root/native TypeScript,
  production web build and focused ESLint. No native source change/rebuild needed.
- No database write, migration, new membership, extra TestFlight distribution,
  paid resource, app-container replacement or draft/outbox modification performed.
  The original dirty checkout's branch/HEAD/main/status/binary diff exactly match
  the saved baseline. No broader Inventory rollout; INV-REL-05 remains pending.

Rollback this notice only by promoting the prior compatible web deployment or
reverting the release catalog/targeting setting. Keep all Inventory records,
receipts, memberships, drafts and queues intact. Future app releases must include
this published-update catalog step; TestFlight upload/email alone is insufficient.
