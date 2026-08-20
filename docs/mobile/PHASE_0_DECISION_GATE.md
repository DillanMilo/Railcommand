# Mobile Phase 0 decision gate

Last updated: 2026-08-20

## Goal

Clear the account, identifier, distribution, legal, safety, and version-one
decisions required before native development begins.

Phase 0 does not create a production-connected mobile app, change a live
database, deploy the web application, or submit an app-store record.

## Decision register

| Decision | Proposed position | Status | Approval/evidence required |
| --- | --- | --- | --- |
| Business model | RailCommand licenses are sold directly to organizations; mobile apps are free login-only clients | Proposed | Business approval |
| In-app commerce | No checkout, price, upgrade CTA, external purchase link, or license-key purchase in mobile v1 | Proposed | Business approval |
| iOS distribution | Public free listing; unlisted distribution remains an option if discoverability is unwanted | Proposed | Product approval |
| Android distribution | Public free listing; Managed Google Play is available for customers that mandate private MDM deployment | Proposed | Product approval |
| Store name | `RailCommand` | Proposed | Search and console availability check |
| Production bundle/package ID | `io.railcommand.app` | Proposed | Apple and Google availability check |
| Development bundle/package ID | `io.railcommand.app.dev` | Proposed | Apple and local Android availability check |
| Verified link host | `railcommand.io` | Proposed | DNS/domain-control evidence |
| Custom URL scheme | `railcommand://` | Proposed | Collision and callback tests |
| Mobile framework | Capacitor 8 with a bundled React/TypeScript client | Approved by technical assessment | Architecture-spike acceptance |
| Minimum iOS | iOS 15 | Proposed baseline | Product/device-support approval |
| Minimum Android | SDK 24 (Android 7.0) | Proposed baseline | Product/device-support approval |
| Android target/compile | API 36 | Required baseline | Android SDK installation and build evidence |
| Native tablets | Responsive iPad and Android large-screen support in v1 | Proposed | Product approval |
| Production data in development | Prohibited | Required | Staging evidence |

Identifiers are not committed to native project files until their ownership and
availability are verified. `railcommand.io` is verified through domain/DNS
control. A custom URL scheme is selected and collision-tested; it is not reserved
by an app store. Universal Links and Android App Links on `railcommand.io` are the
verified deep-link mechanism.

## Account readiness

### Apple

- [ ] Apple Developer Program membership is active.
- [ ] The 10-character Team ID is recorded in the private release runbook.
- [ ] Legal seller name and organization details are correct.
- [ ] Account Holder is identified.
- [ ] Agreements are current in App Store Connect.
- [ ] App Manager and Developer roles are assigned without sharing the Account
      Holder's credentials.
- [ ] Distribution certificate/provisioning responsibility is assigned.
- [ ] `io.railcommand.app` availability is verified and the production App ID is
      registered only after approval.
- [ ] The App Store Connect record is created only after the production App ID is
      registered.
- [ ] Public versus unlisted distribution is approved.
- [ ] APNs development and production credential ownership is assigned.

Do not commit Team IDs, private keys, `.p8` files, provisioning profiles, or
App Store Connect API keys to the repository.

### Google Play

- [ ] Play Developer Account ID and legal developer name are recorded in the
      private release runbook.
- [ ] Account type (organization or personal) is verified.
- [ ] Identity and contact verification are complete.
- [ ] Payments profile and required agreements are current, even though mobile
      v1 has no in-app purchasing.
- [ ] Production-access status is verified.
- [ ] If this is a personal account created after 2023-11-13, the required closed
      test with at least 12 continuously opted-in testers for 14 days is planned.
- [ ] `io.railcommand.app` availability is verified before the first artifact is
      uploaded; the package name is treated as permanent afterward.
- [ ] Play App Signing ownership and upload-key custody are assigned.
- [ ] Android developer identity/package registration deadlines are satisfied.
- [ ] Firebase development and production projects/credentials are separate.

Do not commit upload keystores, passwords, service-account JSON, or Firebase
server credentials to the repository.

## Version 1 product boundary

### Included

- Sign-in, invitation callbacks, password reset, and session restoration
- Project selection and a mobile dashboard
- Cached project, team-reference, and recent daily-log viewing
- Daily-log creation, device drafts, location, photo capture/import, outbox, and
  foreground synchronization
- Sync Center with pending, retrying, failed, and recently synchronized work
- Push registration and deep links into supported records
- Profile, privacy, support, protected sign-out, and account-deletion initiation

### Deferred

- Project/client administration and billing
- EarthCam administration
- RailBot voice input
- Full document authoring
- Schedule editing
- Offline edits of existing records
- Offline creation of RFIs, punch items, safety reports, or QC/QA reports

Deferred features shown in mobile must be clearly online-only or direct users to
the full web product without presenting a broken control.

## Account deletion and record retention

The current support/admin-only deletion experience is not sufficient for mobile
store submission. Approve a policy with the following behavior before Phase 1
is complete:

- A signed-in user can initiate deletion from account settings.
- Reauthentication and a clear confirmation protect against accidental deletion.
- A sole organization owner must transfer ownership or explicitly close the
  organization before personal account deletion proceeds.
- Pending device drafts/outbox operations are synchronized, reviewed, or
  explicitly discarded; they are never silently erased.
- Personal profile and authentication data is deleted after the approved waiting
  period.
- Project records owned by the contracting organization are transferred,
  retained, or anonymized according to the customer agreement and applicable
  record-retention obligations.
- The user sees what will be deleted, retained, anonymized, and when processing
  will finish.
- A public direct deletion-request URL is available for Google Play.

Legal counsel or the accountable business owner must approve the retention
language. This document does not determine legal retention obligations.

## Toolchain baseline

| Requirement | Required | Verified on 2026-08-19/20 |
| --- | --- | --- |
| Node.js | 22+ | 22.22.3 installed |
| npm | Compatible with Node 22 | 10.9.8 installed |
| Capacitor | 8.x | Not installed in the repository; Phase 1 action |
| Xcode | 26+ | 26.6 installed |
| Apple SDK | iOS 26+ for upload | Supplied by Xcode 26.6 |
| iOS deployment target | 15+ | Phase 1 project setting |
| Android Studio | 2025.2.1+ | 2026.1 installed |
| Android minimum SDK | 24 | Phase 1 project setting |
| Android compile/target SDK | 36 | SDK platform not currently found; installation required |

## Phase 0 exit gate

Phase 1 may begin only when:

- [ ] Distribution and licensing decisions are approved.
- [ ] Production and development identifiers are approved and availability is
      verified.
- [ ] Apple and Google account access/roles are verified.
- [ ] Mobile v1 scope is approved.
- [ ] Account-deletion and record-retention policy has an accountable approver.
- [ ] A separate staging Supabase project exists.
- [ ] A separate staging Vercel project/deployment exists.
- [ ] Synthetic staging users and data exist; production data copying is banned.
- [ ] Development APNs/Firebase credentials are separated from production.
- [ ] Environment guards can identify and reject production backend identifiers.
- [ ] Android API 36 is installed.

## First Phase 1 issue after approval

Create a bundled Capacitor 8 spike using `io.railcommand.app.dev` that connects
only to staging, restores a session from native secure storage, lists staging
projects, persists one user-scoped offline record and draft, synchronizes one
idempotent daily-log create after reconnect, and performs protected sign-out
cleanup. Prove it on one physical iOS device and one physical Android device.
