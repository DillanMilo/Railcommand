# TestFlight update notice — October 20, 2026

## Impact and behavior

The native app checks the authenticated, read-only `/api/mobile/v1/app-release`
endpoint on a safe focused Workspace/dashboard and on foregrounding there. It
compares `expo-application`'s actual installed native build with the verified
published build, rather than comparing the marketing version or a bundled Expo
config build number. Both releases may be version 1.0.0 and still need an update.

A newer available iPhone build shows **Update available**, **Later** and **Update**.
Update opens RailCommand's TestFlight app link; if the OS cannot open that scheme,
it opens Apple's TestFlight App Store listing. If both fail, the user gets a clear
error and can continue working. This is a handoff to TestFlight, not an in-app
installer or OTA mechanism. Returning on the latest installed build does not show
an outdated prompt. Dismissing a given build suppresses it for the app session.

The prompt is disabled while Workspace editing/loading/exporting and is absent
from native creation/review forms. Late replies after account changes, blur,
backgrounding or editing are ignored. It never reloads the Workspace, signs out,
resets storage or touches drafts/outboxes/photos. Checks are deduplicated, normally
limited to one per 15 minutes, bounded by a 5-second abort, and retry failures no
sooner than a minute. The UI reminds users to save open work before updating.

- **Web/backend:** additive authenticated GET and shared contract; no general web
  popup, because browser/PWA updates are not TestFlight native app updates.
- **Native iOS:** new bundled prompt plus SDK-compatible `expo-application` 57.0.2,
  already present transitively in the locked tree. No other versions changed.
- **Android:** shared comparison/client code remains supported, but it deliberately
  does not send Android users to TestFlight. A Play release/catalog destination is
  a tracked future requirement when Android store distribution is enabled.
- **Shared domain/API:** additive versioned release response and client GET. Old
  clients do not call it; new clients tolerate an unavailable/older backend.
- **Database/permissions:** no schema, grant, RLS, membership or record changes.
- **Offline classification: online-only.** Unavailable checks fail quietly and do
  not block saved Field work. No project data, tokens or release responses enter
  shared/public offline caches. Only nonprivate shown build numbers live in memory.
- **Drafts/queues:** unchanged schema, paths, IDs, payloads and synchronization.
  Existing upgrades use the normal same-bundle TestFlight update path.

## Release ordering and availability source

Build 300013 already contains the verified photo-copy repair and is separately
queued for TestFlight upload (submission 5a31259d-19d8-4f27-b6d9-3a0dc2ca1f0b).
It cannot acquire new bundled UI after compilation. The prompt therefore requires
a subsequent signed app build. Install that first prompt-aware build normally;
subsequent releases can be detected by the prompt. Do not claim a web deployment
retrofits the native popup into 300012/300013.

The server catalog `src/lib/mobile-api/app-release.ts` starts at the last verified
widely available TestFlight build 300012. **Do not promote it for a queued or merely
uploaded build.** Verify Apple VALID, intended existing group assignment and beta
availability first, then update the catalog/build number and deploy canonical
main. This promotion is a required step for every native release. Do not advertise
a private-only build to external testers without their corresponding availability.
An older/equal catalog makes the prompt silent; it never forces a downgrade.

Deploy the additive backend from canonical main before distributing the new native
build. Native source remains on its native release branch; never deploy that
branch's older web backend. Rollback the notice backend/catalog independently;
existing installed clients and saved work remain compatible.

## Verification and explicit gaps

Focused shared/client/route tests cover newer/equal/older/same-marketing versions,
malformed data and unknown schema, wrong platform/profile/bundle, authentication,
no-store responses and safe failures. Actual native controller/component tests
cover Update/Later wiring, the fixed TestFlight link and fallback, concurrent
checks, throttling, timeout, stale account/screen responses and no prompts on
unsafe screens. The full native suite currently passes 258 tests; TypeScript,
production web builds, iOS/Android exports and CI results are recorded as completed.

No user phone checks are required by this request. Physical TestFlight deep-link
handoff/reopen is explicitly untested (UPDATE-NOTICE-DEVICE); the broader offline
alpha is not accepted by this feature. No general Android store release or future
public App Store distribution/channel detection is claimed. Before a public App
Store launch, distinguish its release channel from the current TestFlight-only
production distribution (UPDATE-NOTICE-STORE-CHANNEL).

Release/build/deployment IDs and actual availability will be appended when known.
A thread follow-up checks availability quietly and notifies only when a build is
actually available, fails, or requires genuine action; it does not request phone
checks or treat upload scheduling as availability.
