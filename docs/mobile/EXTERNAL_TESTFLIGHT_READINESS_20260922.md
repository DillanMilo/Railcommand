# External TestFlight readiness — September 22, 2026

**September 23 current update:** The owner released the no-send hold. Apple approved
build 300012, it is assigned to RailCommand Field Beta and is IN_BETA_TESTING.
Mark, Caleb and the owner alternate are confirmed INVITED. See
[the verified sending record](FIELD_INVITATIONS_SENT_20260923.md). Physical-device
acceptance items remain pending; the dated observations below are historical.

User authorizes sending Mark and Caleb invitations if the app is ready. It is not
ready for external installation yet; no invitations sent. Build 300012 was
submitted for Beta App Review at 20:32 UTC and is **WAITING_FOR_REVIEW**.

**Latest update:** The separate review login has now been created, isolated,
verified on the live mobile API/workspace and saved into Apple's beta review
fields. See [Apple review account](APPLE_REVIEW_ACCOUNT_20260922.md). Submission
`63f090af-3c0d-49d9-93c6-2eded1603260` was created and read back directly from Apple.
No external build assignment or invitation was made by this submission operation.

## Verified directly in App Store Connect

- App 6803576049, build 300012 / 1.0.0 is VALID and internally IN_BETA_TESTING.
  Beta review submission state is now WAITING_FOR_REVIEW (September 22, 20:32 UTC).
- Internal RailCommand Private Beta has Dillan only and includes build 300012.
- External Dillan Preview (35f5c4a4-8577-47bf-8e93-8c6d8d9f2383) has no builds,
  public links disabled, and exactly these NOT_INVITED testers:
  dillan@creativecurrents.io, mark.allen@a5rail.com, caleb@lenaserv.com.
- Saved and read back existing owner-supplied review contact details, en-US app
  description, feedback address, privacy URL and build 300012 testing notes.
  Privacy URL https://railcommand.io/privacy returned HTTP 200.
- Review username, password and instructions are now populated and privately
  verified. The dedicated account works in production, is mobile-eligible and
  accesses demonstration data only. Do not expose credentials in chat/logs.
- App Privacy publish-state API could not be checked with this credential path.
  Do not mark the questionnaire completed; prior records said it was incomplete.

## Remaining work

1. Obtain user report for build 300012: sign-in, save log/photo, confirm web readback,
   DFR PDF export, plus pending relevant device/offline checks. User was asked; no
   response received during this check. Shared UI is not blanket device acceptance.
2. **Completed:** dedicated reviewer identity, demo-only membership, mobile pilot
   access and Apple review credentials verified. Use the account handoff above;
   do not substitute a customer's login or expose customer records to Apple.
3. Submission is complete. Wait for Beta App Review approval and resolve any Apple
   feedback. Complete remaining device acceptance before distributing invitations.
4. Invite only the authorized intended recipients; verify actual invitation state.
   Adding records to a tester group is not sending an installable invitation.

No runtime code, schema, permissions, live project records, offline queues or
build assignments were changed. Release metadata is online-only; device draft and
queue compatibility is unchanged. Existing automated validation remains recorded
in WORKSPACE_HEADER_AND_LOADING_20260917.md; no application rebuild is needed for
these metadata changes.

## Physical iPhone check via Mirroring — September 22

- Connected after the owner disconnected Sidecar; readable capture required keeping
  the Mirroring window visible. No records, drafts, queues or accounts changed.
- TestFlight on the physical iPhone lists RailCommand 1.0.0 (300012) with Open.
  Opened that exact app from TestFlight; its existing signed-in session loaded.
  The earlier similarly named launch showed a sign-in screen and is not evidence
  of a TestFlight authentication failure.
- Verified one web header and bottom navigation; duplicate native toolbar absent.
  More shows Field Tools and RailBot.
- Documents completed loading (empty list in the selected project); Photos completed
  loading and rendered two existing photo thumbnails without a session-expired error.
- Noticeable loading transitions remain. This was not an instrumented latency test;
  faster-navigation acceptance is not passed from these observations.
- Save/photo upload, web readback, PDF export, offline/restart and account isolation
  remain unverified. Awaiting owner identification of a safe demonstration project
  before test writes; project name alone is not authorization to use its records as
  disposable fixtures. Camera/microphone checks still require physical-phone help.

Loading follow-up is live as dpl_24dy7zEsST2H7edtbcU1uLwPVTfd. See
WORKSPACE_NAVIGATION_OVERLAP_20260922.md for checks and remaining phone acceptance.
External invitations remain pending. The reviewer-account blocker was resolved by
the linked account setup. Current deployment is `dpl_93nt1tL7FW63Guh94XiBjtfXAgGh`
(same runtime code, with reviewer added to the pilot allowlist). Apple browser
sign-in is accessible; the App Store submission form is distinct from beta review.

## Beta review submission — September 22, 20:32 UTC

- User asked whether to invite now or wait until tomorrow; standing authorization
  covers completing TestFlight preparation. Submitted the intended build immediately
  with the verified demo-only review login; no approval time was promised.
- Apple accepted submission `63f090af-3c0d-49d9-93c6-2eded1603260` for app 6803576049,
  build 300012 / 1.0.0. Readback: **WAITING_FOR_REVIEW**.
- Readback confirms Caleb, Mark and Dillan's alternate email remain **NOT_INVITED**.
- This is online-only release metadata. Web/backend/native code, existing account
  access, customer data and offline drafts/queues are unchanged. No new app build,
  deployment, schema change or application test run was needed for submission.
- No recurring monitor was created. Recheck Apple's state before any invitation;
  do not treat review submission as approval or as complete physical-device testing.
