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
- [ ] Confirm the app opens with Wi-Fi/cellular disabled and loads only bundled assets.
- [ ] Sign in as synthetic user A while online; confirm the synthetic project and fixture log appear.
- [x] Force-close and reopen; confirm the secure session restores without retyping the password.
- [ ] Go offline; force-close and reopen; confirm the cached project/log remain visible as device data.
- [ ] Edit a daily-log field, wait for “Draft saved on this device,” force-close, and confirm the draft returns.
- [ ] Capture/attach a photo, force-close, and confirm the persisted-photo count remains.
- [ ] Queue a daily log offline; reconnect; confirm it synchronizes once and appears in the refreshed list.
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
  regression-tested. The repaired build is installed in place with the same app
  data container and awaits an unlocked-device relaunch. Offline/restart, draft,
  photo, reconnect, sign-out, and A→B→A checks remain pending.
- Android: branded debug APK rebuilt successfully with the installed JDK 21,
  min SDK 24, target/compile SDK 36, and application ID
  `io.railcommand.app.dev`. The APK's SHA-256 is
  `d77c310cf422550d1bf45439a1a451a792f6de4f91b73f964fdd9b9d19272730`;
  v2 signature verification passes. ADB reports no physical Android device
  currently connected, so device-level acceptance remains pending.
- A→B→A: automated IndexedDB coverage passes; physical two-account validation pending.
