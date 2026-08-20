# Phase 1 physical-device acceptance

Use synthetic staging accounts only. Never enter a production RailCommand
credential or inspect production project data in this build.

Before a physical acceptance session, run
`npm run provision:mobile:device-qa`. It creates or resets two synthetic device
testers and prints their temporary passwords. The automated staging verifier
uses a third synthetic account, so running it no longer invalidates user A's
device-testing password. Re-running the provisioner intentionally rotates both
device passwords.

Record device model, OS version, build commit, date, tester, and pass/fail for
each platform in the ignored private release runbook.

## iPhone and Android checklist

- [x] Confirm installed identifier is `io.railcommand.app.dev`.
- [x] Confirm the app opens with Wi-Fi/cellular disabled and loads only bundled assets.
- [x] Sign in as synthetic user A while online; confirm the synthetic project and fixture log appear.
- [x] Force-close and reopen; confirm the secure session restores without retyping the password.
- [x] Go offline; force-close and reopen; confirm the cached project/log remain visible as device data.
- [x] Edit a daily-log field, wait for “Draft saved on this device,” force-close, and confirm the draft returns.
- [x] Capture/attach a photo, force-close, and confirm the persisted-photo count remains.
- [x] Queue a daily log offline; reconnect; confirm it synchronizes once and appears in the refreshed list.
- [ ] Open `railcommand://projects/20000000-0000-4000-8000-000000000001`; confirm the app opens the synthetic project.
- [ ] After Associated Domains provisioning is available, open the equivalent `https://railcommand.io/projects/...` link.
- [ ] With unsynchronized work present, confirm normal sign-out refuses to delete it.
- [ ] Confirm discard requires two taps and removes only the current user's local database.
- [ ] Sign in as synthetic user B and confirm no A project cache, draft, photo, or outbox entry appears.
- [ ] Add distinct B local work, sign out safely, then sign back in as A and confirm A data is intact and B data is absent.
- [ ] Repeat network loss during edit and during sync; confirm no draft is silently lost or duplicated.
- [ ] Restart the phone and repeat session, cache, draft, and photo checks.

## Current physical status

- iPhone: branded, signed `.dev` build installed and launched on paired “Dillan”
  iPhone. A `railcommand://projects/...` process launch reached the app. The
  staging Auth session table confirms synthetic user A signed in from the
  device on 2026-08-20. A follow-up build fixes iOS focus zoom by locking the
  bundled viewport and keeping form controls at 16 px. Physical acceptance
  confirmed the zoom is fixed and user A remained signed in after the in-place
  reinstall/relaunch. Physical testing then exposed an iOS TCC termination when
  photo capture requested the camera without `NSCameraUsageDescription`. The
  crash report identified the missing declaration; camera and photo-library
  descriptions plus visible draft/photo persistence errors are now included and
  regression-tested. Physical retesting confirmed the camera opens without a
  second crash, but the HTML file input did not deliver the captured photo back
  to the WKWebView. The installed follow-up uses Capacitor Camera 8.2.2 directly,
  immediately materializes the returned native file into an owned Blob, verifies
  the exact saved photo ID by reading IndexedDB back, and shows inline draft/photo
  progress and errors. A physical screenshot then exposed a WKWebView connectivity
  disagreement: Capacitor reported online while `navigator.onLine` suppressed the
  initial project bootstrap, leaving no active project for the photo. The installed
  follow-up always attempts the guarded bootstrap, preserves cached data on a real
  network failure, and refreshes project state after a Capacitor reconnect. Both QA
  memberships and the complete staging bootstrap/idempotency verifier pass. It is
  installed and launched in place with the same app data container; physical photo
  confirmation was initially pending. The mobile API's missing native-WebView CORS boundary
  was then reproduced physically as `TypeError: Load failed`, fixed to allow only
  `capacitor://localhost`, regression-tested, and deployed solely to
  `railcommand-mobile-staging`. Physical Mirroring verification confirmed the
  synthetic project, fixture log, role, and synchronized state load. Native camera
  capture then persisted two user-scoped photos; after a forced process restart,
  the secure session, project, cached log, draft, and both-photo count restored.
  With Airplane Mode enabled, the physical device console reported
  `connected: false` / `connectionType: none` while the bundled
  `capacitor://localhost` app loaded and its secure session restored. A read-only
  device-container snapshot confirmed one cached bootstrap, one saved draft, zero
  queued operations, two photo records, and two backing blob files. After Airplane
  Mode was disabled, Mirroring and the paired-device console both confirmed Wi-Fi
  connectivity returned; the app showed Online, Synchronized with staging, the same
  synthetic project and fixture log, and the two-photo count remained intact. Offline
  draft persistence was then verified by entering an explicit synthetic work summary,
  saving it on-device, forcing a process restart, and confirming the exact text restored
  alongside the cached project/log and two photos even when the immediate refresh failed.
  The physical offline queue test then exposed a repeat-tap defect: two client UUIDs
  were queued seven seconds apart for the same project/day. The installed follow-up
  disables repeat submission after the draft enters the outbox, coalesces any legacy
  repeat operation onto the first UUID/idempotency key while retaining the latest
  payload, and drains the outbox both after a network-change event and when the app
  starts online. Physical retesting proved the two local operations became one before
  delivery. Confirmed mobile staging contains exactly one daily-log row with the first
  UUID/key, contains no row for the second key, and the post-success device snapshot
  shows zero outbox records while the cache and two photo blobs remain. Deep links,
  sign-out, full restart, and A→B→A checks remain pending.
- Android: branded debug APK rebuilt successfully with the installed JDK 21,
  min SDK 24, target/compile SDK 36, and application ID
  `io.railcommand.app.dev`. The APK's SHA-256 is
  `d77c310cf422550d1bf45439a1a451a792f6de4f91b73f964fdd9b9d19272730`;
  v2 signature verification passes. ADB reports no physical Android device
  currently connected, so device-level acceptance remains pending.
- A→B→A: automated IndexedDB coverage passes; physical two-account validation pending.
