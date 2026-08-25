# Phase 3 — Expo v1 field workflows

Status: **implementation complete; isolated staging and the core physical-iPhone
store-review workflow accepted on 2026-08-25; full iPhone link/permission/isolation
matrix and physical Android acceptance remain open**.

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

## Isolated staging and physical-iPhone evidence — 2026-08-25

- All backend work was confined to Supabase project `cyacardivfzrsravqjto` and the
  `railcommand-mobile-staging.vercel.app` alias. The signed device build uses
  `io.railcommand.app.dev`; production project references remain blocked by the mobile
  environment guard.
- The additive Phase 3 migrations were applied to staging only, the authenticated
  mobile endpoints were deployed to staging only, and EAS project
  `dda86dca-ca12-4efa-a556-6fd8411485d5` was configured without committing secrets.
- A signed Release bundle opened on an iPhone 17 Pro Max without Metro, restored the
  Keychain session, and recovered cached synthetic project/team/log data while offline.
- A Release-only photo-ID failure was found before submission and corrected by using
  Expo native crypto. Queueing now atomically verifies every displayed photo and stores
  a versioned photo manifest. Synchronization refuses to create the parent log if a
  manifested photo is absent. Legacy queue items without a verified manifest are held
  as failed for review rather than uploaded partially.
- The accepted synthetic operation used daily-log/client ID
  `0403bb24-1efa-44a1-a2b3-791a0d67d9c7` and photo ID
  `d6e2d100-a083-471b-b620-23c7d5f5a9c2`. Before restart, the phone contained one
  pending log, one pending photo, and a version-1 one-photo manifest. The same state was
  read directly from SQLite after an offline force-close and relaunch.
- Reconnect produced exactly two synchronized history items and left zero local outbox
  rows and zero local photo rows. Staging daily-log count moved from 6 to 7; the exact
  idempotent log row, attachment row, parent relationship, and 3,851,457-byte storage
  object were independently verified.
- `railcommand://sync` and the synthetic `railcommand://projects/<id>` callback were
  physically re-tested after adding native-path rewriting and a concrete project route.
  Both opened the intended screen without the stale callback spinner or unmatched-route
  page. The auth callback also has a visible escape and bounded fallback.
- Final verification passes: root `npm run build`, iOS and Android Hermes exports,
  mobile/domain/offline/API tests, both TypeScript checks, Expo lint, signed iPhone
  Release `xcodebuild`, and Expo Doctor 21/21.

No production deployment, production database mutation, live customer read/write, or
store release occurred during this acceptance run.

## Remaining gate

Phase 3 is not fully accepted across supported platforms until all items below are
recorded:

1. **Complete:** review and apply the additive migration to isolated staging only.
2. **Complete:** deploy the authenticated mobile endpoints to the isolated staging
   alias only.
3. **Complete:** configure the Expo/EAS development project ID and non-production public variables;
   keep all Apple, Google, APNs/FCM, database, and service-role secrets out of Git.
4. **Partially complete:** physical-iPhone sign-in restore, photo/location persistence,
   offline restart, reconnect, Sync Center, and project/Sync custom callbacks pass.
   Physical invitation/password-reset callbacks, permission-denial fallbacks, and
   Expo-build A → B → A isolation remain to be recorded.
5. **Complete on iPhone:** prove the store-review story against synthetic staging data: create one geotagged
   log with photos offline, force-close/reopen, reconnect, and verify exactly one log
   and one copy of each photo on the server.
6. **Pending hardware:** repeat the full matrix on a physical Android phone when hardware is available. The
   compile/simulator evidence does not replace this conditional device gate.
7. **Pending publication:** publish and validate Apple/Android association files before claiming Universal/App
   Links are active, then record US-only store availability during submission.

Current gate wording:
**Phase 3 implementation and the core iPhone store-review workflow are accepted;
remaining iPhone link/permission/isolation checks and physical Android are explicitly
deferred.** It must not be described as fully accepted across supported platforms or
as full offline project management.
