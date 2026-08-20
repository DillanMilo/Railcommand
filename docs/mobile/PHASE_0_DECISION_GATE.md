# Mobile Phase 0 decision gate

Last updated: 2026-08-20

## Goal

Clear the account, identifier, distribution, legal, safety, and version-one
decisions required before native development begins.

Phase 0 does not create a production-connected mobile app, change a live
database, deploy the live web application, or submit an app for review. It may
reserve identifiers/store records and create isolated staging resources.

## Decision register

| Decision | Proposed position | Status | Approval/evidence required |
| --- | --- | --- | --- |
| Business model | RailCommand licenses are sold directly to organizations; mobile apps are free login-only clients | Approved 2026-08-20 | Complete |
| In-app commerce | No checkout, price, upgrade CTA, external purchase link, or license-key purchase in mobile v1 | Approved 2026-08-20 | Complete |
| iOS distribution | Public free listing; unlisted distribution remains an option if discoverability is unwanted | Approved 2026-08-20 | App Store Connect record created; free and US-only |
| Android distribution | Public free listing; Managed Google Play is available for customers that mandate private MDM deployment | Approved 2026-08-20 | Google Play record created; free and US-only |
| Launch territory | United States only on both stores; no availability outside the US | Approved 2026-08-20 | Enforced on both store records |
| Store name | `RailCommand` | Approved 2026-08-20 | Reserved on Apple and Google Play |
| Production bundle/package ID | `io.railcommand.app` | Approved 2026-08-20 | Registered on Apple and Google Play |
| Development bundle/package ID | `io.railcommand.app.dev` | Approved 2026-08-20 | Registered on Apple and Firebase staging |
| Verified link host | `railcommand.io` | Approved 2026-08-20 | Domain control verified; association files are Phase 1 work |
| Custom URL scheme | `railcommand://` | Approved 2026-08-20 | Collision/callback device tests are Phase 1 work |
| Mobile framework | Capacitor 8 with a bundled React/TypeScript client | Approved by technical assessment | Architecture-spike acceptance |
| Minimum iOS | iOS 15 | Approved 2026-08-20 | Enforce in Phase 1 native project |
| Minimum Android | SDK 24 (Android 7.0) | Approved 2026-08-20 | Enforce in Phase 1 native project |
| Android target/compile | API 36 | Approved 2026-08-20 | Platform and Build Tools 36 verified installed |
| Native tablets | Responsive iPad and Android large-screen support in v1 | Approved 2026-08-20 | Enforce in Phase 1 responsive acceptance |
| Production data in development | Prohibited | Approved 2026-08-20 | Staging evidence |

Identifiers are not committed to native project files until their ownership and
availability are verified. `railcommand.io` is verified through domain/DNS
control. A custom URL scheme is selected and collision-tested; it is not reserved
by an app store. Universal Links and Android App Links on `railcommand.io` are the
verified deep-link mechanism.

## Account readiness

### Approval record

On 2026-08-20, the product owner approved the direct B2B licensing model,
public free iOS and Android listings limited to the United States,
production/development identifiers, and the scoped mobile v1 product boundary.
This approval does not authorize creating external store records, staging cloud
resources, signing credentials, or a production-connected build.

### Apple

- [x] Apple Developer Program membership is active through July 21, 2027.
- [x] The 10-character Team ID is recorded in the private release runbook.
- [x] Legal seller name and organization details are correct for Creative
      Currents LLC.
- [x] Account Holder is identified and the signed-in user has the Account Holder
      role.
- [x] The Free Apps Agreement is active through July 20, 2027, and the current
      Apple Developer Program License Agreement is accepted.
- [x] EU Digital Services Act trader status is not a US launch requirement. It
      remains incomplete and must be completed before any future EU distribution.
- [x] The Paid Apps Agreement is not applicable to the approved free/login-only
      v1 position; it becomes required only if that model changes.
- [x] The Account Holder currently owns App Manager and Developer duties; roles
      will be delegated without credential sharing when another operator joins.
- [x] Distribution certificate/provisioning responsibility is assigned to the
      Account Holder for Phase 1.
- [x] `io.railcommand.app` and `io.railcommand.app.dev` were verified and
      registered after approval.
- [x] The App Store Connect record was created after production App ID
      registration (Apple app ID `6803576049`).
- [x] Public versus unlisted distribution is approved: public free listing.
- [x] App Store availability is configured for the United States only; 174
      other countries or regions remain unavailable.
- [x] The app is free and public; Apple Silicon Mac and Vision Pro availability
      are disabled for the mobile v1 launch.
- [x] APNs development and production credential ownership is assigned to the
      Account Holder; credentials will be created and stored separately in Phase 1.

Do not commit Team IDs, private keys, `.p8` files, provisioning profiles, or
App Store Connect API keys to the repository.

### Google Play

- [x] Play Developer Account ID and legal developer name are recorded in the
      private release runbook.
- [x] Account type is verified as an organization account.
- [x] Identity, contact, and organization-website verification are complete.
- [x] A payments profile is not required for the approved free/no-purchase v1;
      required Play declarations remain part of app-record creation.
- [x] New-app creation is available in Play Console.
- [x] The personal-account 12-testers/14-days rule does not apply because this is
      an organization account.
- [x] `io.railcommand.app` availability is verified before the first artifact;
      the package becomes permanent when the record is created.
- [x] Play App Signing is active. Upload-key creation and custody are assigned to
      the Account Owner for the future Phase 1 release pipeline.
- [x] Android developer identity verification is complete and the RailCommand
      Google Play record reserves `io.railcommand.app` (Play app ID
      `4974656059116836796`).
- [x] Google Play production availability targets the United States only; no
      other country or region is targeted.
- [x] Google Play policy and applicable US export-law declarations were approved
      by the Account Owner on 2026-08-20.
- [x] Firebase development is isolated in `railcommand-mobile-staging`; no
      production Firebase app or credentials were created.

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

The included/deferred v1 boundary was approved by the product owner on
2026-08-20.

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
| Android compile/target SDK | 36 | Platform 36 revision 2 and Build Tools 36.0.0 installed |

## Phase 0 exit gate

Phase 1 may begin only when:

- [x] Distribution and licensing decisions are approved.
- [x] Initial launch territory is approved as United States only.
- [x] Production and development identifiers are approved, verified, and
      reserved on the applicable stores and staging services.
- [x] Apple Account Holder access and Google account-owner access are verified;
      delegated App Manager/Developer roles remain a pre-release operations task.
- [x] Mobile v1 scope is approved.
- [x] Account-deletion and record-retention policy was approved by the
      accountable business owner on 2026-08-20.
- [x] A separate staging Supabase project exists with automatic RLS enabled and
      automatic exposure of new tables disabled.
- [x] A separate staging Vercel project/deployment exists and connects only to
      staging.
- [x] Synthetic staging users and data exist; no production data was copied.
- [x] Development APNs/Firebase responsibilities and resources are separated
      from production.
- [x] Environment guards identify and reject production backend identifiers.
- [x] Android API 36 and Build Tools 36.0.0 are installed and verified.

All Phase 0 exit-gate items are complete as of 2026-08-20. Phase 1 development
remains subject to the production-safety boundary and must use only the
development identifier and isolated staging resources.

## First Phase 1 issue after approval

Create a bundled Capacitor 8 spike using `io.railcommand.app.dev` that connects
only to staging, restores a session from native secure storage, lists staging
projects, persists one user-scoped offline record and draft, synchronizes one
idempotent daily-log create after reconnect, and performs protected sign-out
cleanup. Prove it on one physical iOS device and one physical Android device.
