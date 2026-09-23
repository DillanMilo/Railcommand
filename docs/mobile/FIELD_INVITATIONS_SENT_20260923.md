# Field TestFlight invitations sent — September 23, 2026

The owner explicitly released the earlier sending hold: “Let's get it sent, and
then I will send the text message myself.” Apple accepted the release notification
and invitation requests at 17:27 UTC. Fresh readback confirmed all three external
testers are **INVITED**. Do not resend merely because immediate readback briefly
remained NOT_INVITED; Apple updated the state asynchronously.

## Verified distribution

- App **6803576049**, RailCommand **1.0.0 (300012)**.
- Build/review **63f090af-3c0d-49d9-93c6-2eded1603260**: **APPROVED**, VALID,
  not expired, external state **IN_BETA_TESTING**.
- External group **RailCommand Field Beta**,
  `35f5c4a4-8577-47bf-8e93-8c6d8d9f2383`, now contains build 300012.
- Mark `mark.allen@a5rail.com`: **INVITED**.
- Caleb `caleb@lenaserv.com`: **INVITED**.
- Owner alternate `dillan@creativecurrents.io`: **INVITED** by group notification.
- Owner `dillanxx@gmail.com` remains **INSTALLED** in the internal group.
- Public link remains disabled; automatic build notifications remain false.
- Apple accepted manual build notification `9aef1b6c-416e-4db4-b4d4-151b06216c3e`.
  Mark invitation `fdc13127-72f0-4cec-99c4-415f7ac8243c`; Caleb invitation
  `715d60ba-40e1-42c6-bd35-dbe7939ec54c`.
- An earlier Mark request was rejected because the assigned build was not yet
  installable; manual Notify Testers transitioned it from BETA_APPROVED to testing.
- Invitation status confirms Apple's sending state, not inbox delivery, acceptance
  or installation. No separate custom email or group text was sent. The owner will
  send the group message. The instruction email remains an unsent draft.

## Acceptance boundary

Invitations are authorized for the limited beta. This does **not** mark outstanding
physical-device checks passed or waive them. Save/log photo upload and web readback,
DFR PDF export/share, relevant offline/restart/account-isolation cases and measured
navigation timing remain follow-ups in
[external readiness](EXTERNAL_TESTFLIGHT_READINESS_20260922.md). The two previously
conflicted September 16 device logs are not proven delivered. Preserve them.
Use the designated fictional reviewer project for disposable verification records.

## Web/mobile and offline impact

- User-visible change: the approved existing binary is installable by invited testers.
- Web, shared API/domain/database: unchanged; no customer records or permissions changed.
- Native mobile: TestFlight distribution metadata only; no new binary or deployment.
  Testers use their own existing RailCommand accounts and project permissions.
- Offline classification: **online-only** release administration. Existing web/native
  drafts, queues, compatibility, authorization, idempotency and conflict handling
  are unchanged. No sign-out, uninstall, cache purge or queue reset performed.
- Validation: fresh Apple API approval, group/build association, notification settings,
  recipient roster and INVITED states. Documentation content/links reviewed; no
  application builds/tests rerun for metadata and documentation only.
- Rollback, if separately required: stop external distribution of this build through
  Apple; do not delete app accounts, customer data or device drafts to revoke access.
- No automatic sending or monitoring job was created.
