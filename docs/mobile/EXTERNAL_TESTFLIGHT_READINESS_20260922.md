# External TestFlight readiness — September 22, 2026

User authorizes sending Mark and Caleb invitations if the app is ready. It is not
ready for external installation yet; no invitations or review submission sent.

## Verified directly in App Store Connect

- App 6803576049, build 300012 / 1.0.0 is VALID and internally IN_BETA_TESTING.
  External state remains READY_FOR_BETA_SUBMISSION, with no review submission.
- Internal RailCommand Private Beta has Dillan only and includes build 300012.
- External Dillan Preview (35f5c4a4-8577-47bf-8e93-8c6d8d9f2383) has no builds,
  public links disabled, and exactly these NOT_INVITED testers:
  dillan@creativecurrents.io, mark.allen@a5rail.com, caleb@lenaserv.com.
- Saved and read back existing owner-supplied review contact details, en-US app
  description, feedback address, privacy URL and build 300012 testing notes.
  Privacy URL https://railcommand.io/privacy returned HTTP 200.
- Review login is required; username and password are absent. Do not expose
  credentials in chat/logs. User was asked for reviewer email only, to verify that
  it works in production, is mobile-eligible and accesses demonstration data only.
- App Privacy publish-state API could not be checked with this credential path.
  Do not mark the questionnaire completed; prior records said it was incomplete.

## Remaining work

1. Obtain user report for build 300012: sign-in, save log/photo, confirm web readback,
   DFR PDF export, plus pending relevant device/offline checks. User was asked; no
   response received during this check. Shared UI is not blanket device acceptance.
2. Verify the dedicated reviewer identity, demo-only membership and mobile pilot
   eligibility. Have the owner enter its password privately in Apple, then verify
   the required fields are present without printing the password. Do not substitute
   a customer's login, reset passwords, or expose customer records to Apple.
3. Complete outstanding privacy/review checks, submit the intended build for Beta
   App Review, and wait for approval before distributing usable invitations.
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
External invitations and reviewer-account blocker are unchanged. Apple browser
sign-in is accessible; the App Store submission form is distinct from beta review.
