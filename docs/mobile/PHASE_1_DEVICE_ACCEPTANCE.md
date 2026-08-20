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

- [ ] Confirm installed identifier is `io.railcommand.app.dev`.
- [ ] Confirm the app opens with Wi-Fi/cellular disabled and loads only bundled assets.
- [ ] Sign in as synthetic user A while online; confirm the synthetic project and fixture log appear.
- [ ] Force-close and reopen; confirm the secure session restores without retyping the password.
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
  signed-in/offline/restart/photo/A→B→A checklist remains pending.
- Android: debug APK built; no physical Android device currently connected.
- A→B→A: automated IndexedDB coverage passes; physical two-account validation pending.
