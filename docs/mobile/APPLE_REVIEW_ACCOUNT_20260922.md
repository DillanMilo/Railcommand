# Apple review account — September 22, 2026

Completed at 20:17 UTC under the owner's explicit request to create a separate
demonstration-only RailCommand review login. This is an application account, not
an Apple ID or a customer tester invitation.

## Identity and scope

- Login: `dillanxx+railcommand-review@gmail.com` (owner's Gmail plus alias).
- User: `5998f6b2-5b16-4b47-9162-37b6ef161f12`.
- Organization: `cc2f1254-0162-4d84-b7d3-16845b227951`,
  **RailCommand Demonstration — Fictional Data**.
- Project: `78afa632-d6e4-446b-a383-c2cd27663692`,
  **Apple Review — Demo Rail Project**.
- Global profile role is `member`; only the demo-project membership is `manager`
  with edit permission. Do not give this account global admin/customer membership.
- Created fictional daily logs, one RFI and one submittal. Reviewer may edit/upload
  in this project. It contains no copied customer records or attachments.
- A strong unique password was generated and saved directly into App Store Connect
  TestFlight review details, then read back and compared privately. Credentials
  are not recorded in source control, chat or logs. Retrieve/manage review login
  through the app's private review fields; never substitute customer credentials.
- Email/password sign-in and refresh verified. No MFA/phone-code step is configured
  for this dedicated reviewer. No account-reset or invitation email was sent.

## Verification

Authenticated as the reviewer using the public client key, not the admin client:

- Project, organization, profile and membership lists contain only the demo scope.
- Daily logs, RFIs, submittals, documents, attachments, punch items, milestones,
  safety incidents, change orders and activity records reveal no other project.
- Direct read of a different project ID returns no rows; mobile bootstrap for that
  project returns 403. Unauthenticated mobile bootstrap returns 401/no-store.
- Production mobile bootstrap lists exactly the editable demo project.
- Mobile daily-log synchronization succeeds. Repeating the same UUID/idempotency
  key returns the same record with `duplicate: true`; shared database readback is
  exact. Fixture: `ea41e0f7-03e1-47d7-a35c-3e65172158bb` (September 21).
- Demo RFI export returns a valid PDF with one record.
- Native-to-workspace ticket/cookie exchange succeeds; the demo daily-log page
  returns 200. Authenticated Documents/Photos reads succeed; another project's
  collection returns no data.
- Checks passed against the staged deployment, then `https://railcommand.io` at
  20:16 UTC. These are API/session checks, not a new physical-iPhone acceptance run.
- Existing Dillan/Caleb/Mark pilot identities retain their prefilter access;
  invalid signatures are still rejected by real authentication.
- Production build and TypeScript passed; standalone `tsc --noEmit` passed and 16
  focused pilot/middleware/workspace-session tests passed. Initial deployment error
  scan returned zero error entries. No additional drain/monitor was configured.

## Rollout and impact record

- **Web:** new isolated account, organization and fictional project records.
- **Mobile:** added reviewer UUID to `MOBILE_PILOT_USER_IDS`, preserving the three
  existing tester UUIDs. Workspace and native API are enabled for this account.
- **Shared API/domain/database:** new demo rows only; no code, schema, RLS or API
  contract change. Existing human accounts and customer records were not edited.
- **Offline classification:** account provisioning/review setup is **online-only**
  because it requires Auth and Apple services. Existing Field Tools draft/queue
  behavior and user partitioning are unchanged; no device storage was accessed.
- **Installed clients:** existing build 300012 works with the configuration. No new
  native bundle/TestFlight upload is needed for this account setup. No older-client
  API or persisted payload changes were introduced.
- **Live deployment:** `dpl_93nt1tL7FW63Guh94XiBjtfXAgGh`,
  `https://railcommand-qfd7ribtj-dillans-projects-f662840b.vercel.app`, promoted and
  confirmed via `railcommand.io`. Same application source as `7ffc69f`; only the
  reviewer allowlist addition required the deployment.
- **Rollback:** prior deployment `dpl_24dy7zEsST2H7edtbcU1uLwPVTfd` retains the old
  three-user pilot configuration. Rolling back blocks the reviewer until its UUID
  is included again. Do not delete the demo project while Apple is reviewing.
- **Apple:** app 6803576049 / build 300012 review username, password and demo-only
  instructions saved and verified. No Beta App Review submission, external build
  assignment or tester invitation was sent in this account-setup operation.

## Remaining release work

The review-login blocker is resolved. Build 300012 was subsequently submitted at
20:32 UTC and Apple returned **WAITING_FOR_REVIEW**. Beta App Review approval,
external invitations and the remaining physical-device acceptance items in
[external readiness](EXTERNAL_TESTFLIGHT_READINESS_20260922.md) are separate work.
Do not call the whole mobile app fully accepted from this account verification.
The public App Store submission form is separate from TestFlight beta review;
unverified App Privacy status is not by itself evidence of a beta-review blocker.
