# Phase 3 — Expo v1 field workflows

Status: **implementation complete locally; staging and physical-device acceptance not
yet complete**.

The production-intent mobile client now lives in `apps/mobile` and uses Expo SDK 57,
React Native, Expo Router, Continuous Native Generation, and development builds. The
accepted Capacitor Phase 2 client is preserved in `apps/mobile-capacitor-spike` for
traceability and is not the app that will advance to store review.

All work is isolated on `codex/mobile-phase-3-expo`. No production deployment,
production database migration, production API call, live customer record, or store
release is authorized by this phase implementation.

## Offline classification

| Workflow | Classification | Behavior |
| --- | --- | --- |
| Bundled navigation and shell | Offline-capable | The JavaScript bundle and native shell contain no remote `server.url` and do not depend on the web service worker. |
| Projects, team, and recent logs | Offline read-only | The last authenticated bootstrap is stored in a user-partitioned SQLite database. Existing records are view/share only. |
| New daily log and location | Offline draft/queue | Every field autosaves locally. Submit atomically moves the draft to an outbox with a client UUID and idempotency key. |
| Field photos | Offline draft/queue | App-owned files persist before queueing, wait for the server-created parent, retry independently, and are deleted locally only after finalization. |
| Account deletion request | Online-only | The UI says connectivity is required and never pretends to queue a legal request. No form input is discarded. |
| Push registration | Online-only | Permission is requested only after education and registration requires a physical configured build. |
| Existing-record edits and deferred modules | Unavailable in v1 | Administration, billing, EarthCam admin, RailBot voice, and full document/schedule editing remain on the connected web app. |

RailCommand must not be marketed as full offline project management.

## Implemented locally

- Organization email/password sign-in, Keychain/Keystore session restore and refresh,
  password-reset callbacks, project invitation links, project selection, and protected
  Expo Router navigation.
- Phone/tablet adaptive shell, safe areas, keyboard avoidance, connectivity state,
  startup/reconnect/foreground synchronization, and a visible Sync Center.
- Cached project, project-team, and recent daily-log viewing with read-only record
  sharing and clear existing-edit limitations.
- Autosaved daily-log drafts, current foreground location, camera/photo-library import,
  durable native storage, idempotent parent-first outbox synchronization, and pending,
  retrying, failed, conflicted, and synchronized states for logs and photos.
- Point-of-use native permission education and denial fallbacks that retain field work.
- Push-token registration wiring and validated record notification deep links. Push
  delivery remains disabled until an EAS project ID and server sending policy are
  approved in the non-production environment.
- Profile/privacy/support controls, two-confirmation account-deletion request, and safe
  sign-out that checks drafts, outbox rows, and photos before deleting the user scope.
- Additive, RLS-protected staging migration for device registrations, deletion requests,
  and atomic invitation acceptance. It has not been applied to production.
- Development/staging/production bundle identifiers, icons, splash, version/build
  numbering, EAS profiles, and secret-free Expo/Android/iOS CI definitions.
- No external crash-reporting SDK. The Phase 2 privacy decision remains unchanged.

## Automated evidence

- Expo Doctor passes all 21 checks with a single Expo-supported React runtime.
- Expo Router exports both iOS and Android Hermes bundles successfully.
- Expo CNG generates both native projects without a remote runtime URL.
- A clean Expo-generated Android project passes `:app:testDebugUnitTest` and
  `assembleDebug` with Java 21 and Android SDK 36.
- A clean Expo-generated iOS project installs its CocoaPods dependencies and passes an
  unsigned Debug Simulator `xcodebuild` with the iOS 26 SDK.
- Mobile, domain, offline, API-client, environment, native-boundary, type, and asset
  checks are part of the repository test commands.
- Android unsigned and iOS unsigned Simulator jobs are defined for pull-request CI and
  contain no signing or backend secrets.

## Remaining gate

Phase 3 is not accepted for Phase 4 or store review until all items below are recorded:

1. Review and apply the additive migration to the isolated staging Supabase project.
2. Deploy the new authenticated mobile endpoints to the isolated staging alias only.
3. Configure the Expo/EAS development project ID and non-production public variables;
   keep all Apple, Google, APNs/FCM, database, and service-role secrets out of Git.
4. On a physical iPhone, prove sign-in restore, invitation/reset callbacks, permission
   denial, photo/location persistence, offline restart, reconnect, safe sign-out, and
   A → B → A user isolation in the Expo development build.
5. Prove the store-review story against synthetic staging data: create one geotagged
   log with photos offline, force-close/reopen, reconnect, and verify exactly one log
   and one copy of each photo on the server.
6. Repeat the full matrix on a physical Android phone when hardware is available. The
   compile/simulator evidence does not replace this conditional device gate.
7. Publish and validate Apple/Android association files before claiming Universal/App
   Links are active, then record US-only store availability during submission.

Gate wording after iPhone evidence but before Android hardware is available:
**Phase 3 implementation complete; iPhone accepted; physical Android conditionally
deferred.** It must not be described as fully accepted across supported platforms.
