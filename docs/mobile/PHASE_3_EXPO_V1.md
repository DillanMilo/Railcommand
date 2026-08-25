# Phase 3 — Expo v1 field workflows

Status: **implementation complete; isolated staging, verified staging Universal/App
Link infrastructure, the core physical-iPhone store-review workflow, and a clean
Android debug build are accepted on 2026-08-25. The remaining physical-device matrix
is recorded below.**

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
| Invitation acceptance and password recovery | Online-only | Links can open the bundled app offline, but identity verification and membership/session changes require the authenticated staging service. Missing callback credentials fail closed. |
| Universal/App Link association discovery | Online-only | Apple and Google fetch public machine-readable association files. This stores no field data and does not change the offline draft/outbox workflow. |
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
- Push-token registration wiring and validated record notification deep links. A
  non-production EAS project ID is configured; push delivery remains disabled until a
  server sending policy is separately approved.
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
- The generated 251 MB debug APK passes Android signature verification with the exact
  development certificate fingerprint published in staging Digital Asset Links.
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
- Staging now serves an environment-specific Apple App Site Association file and
  Android Digital Asset Links file without login redirects. Apple CDN independently
  fetched and accepted the staging association, and Google's Digital Asset Links API
  independently resolved the development package/certificate relationship. The
  installed iPhone development build is signed with the matching staging associated
  domain entitlement.
- Production remains unchanged: no association file was deployed to `railcommand.io`,
  and production Android trust fails closed unless an approved Play-signing
  fingerprint is explicitly supplied at release time.
- Authentication callbacks without a PKCE code, a valid token hash/type pair, or a
  complete access/refresh token pair are rejected rather than treated as signed in.
- Final verification passes: root `npm run build`, iOS and Android Hermes exports,
  mobile/domain/offline/API tests, both TypeScript checks, Expo lint, signed iPhone
  Release `xcodebuild`, Android SDK 36 debug assembly/signature verification, and Expo
  Doctor 21/21. The final focused suite contains 45 passing tests/checks.

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
   Staging association infrastructure is independently verified. Physical HTTPS
   Universal Link launch, invitation/password-reset callbacks, permission-denial
   fallbacks, push-token registration, and Expo-build A → B → A isolation remain to be
   recorded. The `.test` QA accounts do not provide an inbox for a real recovery email,
   so recovery delivery needs a safe test inbox or generated staging recovery link.
5. **Complete on iPhone:** prove the store-review story against synthetic staging data: create one geotagged
   log with photos offline, force-close/reopen, reconnect, and verify exactly one log
   and one copy of each photo on the server.
6. **Pending hardware:** repeat the full matrix on a physical Android phone when hardware
   is available. A clean Java 21/SDK 36 build, Hermes export, signed debug APK, and
   association verification pass, but compile evidence does not replace this device
   gate. No Android emulator/AVD is installed on the current Mac.
7. **Complete for staging; pending for release:** staging Apple/Android association files
   are published and independently validated. Publish the production association on
   `railcommand.io` only after the final Apple identifier and Play App Signing
   certificate are approved, then record US-only store availability during submission.

Current gate wording:
**Phase 3 implementation, staging association infrastructure, native builds, and the
core iPhone store-review workflow are accepted. The remaining iPhone mini-matrix and
physical Android acceptance are explicitly deferred until the required device/account
conditions are available.** It must not be described as fully accepted across supported
platforms or as full offline project management.
