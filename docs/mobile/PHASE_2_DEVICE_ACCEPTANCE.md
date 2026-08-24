# Phase 2 physical-device acceptance

Status: **iPhone accepted on 2026-08-24; physical Android deferred because no Android
test phone is available**.

All tests used the isolated synthetic staging project and the
`io.railcommand.app.dev` application. No production backend, customer project, live
application deployment, or live user data was accessed or changed.

## Offline classification

The tested daily-log/photo workflow is **offline draft/queue**. Field input, optional
location, and owned photo bytes persist immediately in the authenticated user's
project-scoped IndexedDB. Queueing creates stable client UUIDs and idempotency keys.
Foreground reconnect synchronizes the parent daily log first, then requests a
short-lived signed upload for each child photo, uploads it, and finalizes the attachment.
The local blob is removed only after finalization succeeds. Every delivery revalidates
the access token, membership, edit permission, parent ownership, exact storage path,
and idempotency key on staging.

## iPhone evidence

- Device: iPhone 17 Pro Max, iOS 26.6.
- App: RailCommand Development `0.2.0 (200002)` installed in place from branch
  `codex/mobile-phase-2`.
- The bundled shell remained usable with Airplane Mode on and Wi-Fi off; it did not
  depend on `server.url`, authenticated Cache Storage, or the web service worker.
- Safe areas, keyboard resizing, 16 px fields/no focus zoom, phone navigation, status
  bar, and camera/photo/location permission presentations passed.
- The Keychain-backed synthetic user-A session survived reinstall, force-close, cold
  restart, and network loss. Warm and cold `railcommand://` callbacks passed.
- Camera capture persisted an owned photo locally. A force-close restored the persisted
  photo count. Photo-library limited-access/cancel and location/share cancellation paths
  preserved the draft and existing photo.
- User A → B → A isolation passed physically earlier in the same device program, and
  the unchanged partition contract remains covered by the current automated suite.
- On the corrected build, the synthetic August 25 log
  `Phase 2 child-photo reconnect retest — synthetic staging only.` captured one new
  photo, queued while fully offline, and reported `Queued until connectivity returns`.
- After Airplane Mode was disabled and Wi-Fi returned, the foreground lifecycle reported
  `Synchronized 2 queued items`—the parent daily log and its child photo.
- An authenticated read-only staging query then found exactly one matching daily-log row,
  exactly one linked attachment, and no duplicate.

One photo produced by the earlier pre-fix build remains safely local and intentionally
unassociated. The corrected UI excludes it rather than guessing a parent log, and it was
not uploaded. Remove it only through the app's confirmed-discard flow with explicit user
approval.

## Native and server evidence

- 42 focused domain/offline/API-client/mobile/mobile-API tests pass, plus all 10
  environment isolation tests.
- `npx tsc --noEmit`, ESLint, asset validation, and the standard Next.js production
  build pass.
- Android SDK 36/JDK 21 `testDebugUnitTest assembleDebug` passes without signing secrets.
- The unsigned iOS Simulator build passes. The app bundle identifier is
  `io.railcommand.app.dev`; the embedded camera framework retains its independent
  `ion-ios-camera.IONCameraLib` identifier.
- The staging upload/finalize API passed an independent idempotency test: first finalize
  created the attachment and repeated finalize returned the existing attachment.
- Supabase staging security advisors report no RLS/storage-policy errors. Leaked-password
  protection remains a project-level warning to resolve before broader external testing.

## Conditional follow-ups

- Repeat the complete device matrix on a physical Android phone when one is available.
- Publish and validate the reviewed Apple/Android association files before declaring
  HTTPS Universal/App Links active.
- Enable staging leaked-password protection before distributing credentials to a wider
  external tester group.
