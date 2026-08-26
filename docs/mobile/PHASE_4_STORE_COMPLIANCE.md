# Phase 4 — store compliance and review package

Status: **implementation and documentation in progress on the isolated
`codex/mobile-phase-4-compliance` branch. Nothing in this phase authorizes a
production deploy, production migration, customer-data access, or store release.**

## Decisions

| Area | Decision | Basis |
| --- | --- | --- |
| Distribution | Public Apple App Store and Google Play listing, United States storefront only | Approved Phase 0 scope |
| Business model | Free login-only companion; RailCommand licenses are sold directly to organizations; no in-app purchase or consumer signup | Approved v1 boundary |
| Apple login | Use the existing-enterprise-account exception in App Review Guideline 4.8; do not add Sign in with Apple | The app requires an organization-issued RailCommand account and offers no social login or public account creation |
| Account deletion | Online-only initiation after current-password reauthentication and a zero-local-work gate; 30-day recovery; organization records retained or anonymized | Legal/account state must be validated atomically and no device work may be silently lost |
| Encryption | `ITSAppUsesNonExemptEncryption = false` | The app uses only operating-system/standard HTTPS, Keychain/Keystore, and vendor SDK encryption; no proprietary or non-exempt cryptography |
| Tracking/ads | None | No advertising SDK, advertising ID, cross-app tracking, or data sale |
| Crash reporting | None in v1 | A vendor has not passed the privacy inventory gate |
| Location | Precise or approximate foreground location only, captured after a user action | Daily-log geotagging; no background or continuous tracking |
| Age/target | Business users age 18+; not designed for children | Organization-controlled rail/construction field workflow |

Apple policy basis: <https://developer.apple.com/app-store/review/guidelines/>.
Google policy basis: <https://support.google.com/googleplay/android-developer/answer/10787469>.

## Offline classification

Account-deletion initiation, password recovery, reviewer authentication, policy pages,
and support email are **online-only**. They say so clearly and never claim to queue a
legal or identity operation. Daily-log drafts/outbox/photos remain **offline
draft/queue** and must be synchronized, reopened, or explicitly discarded before an
account-deletion request can be sent.

## Implemented evidence

- Mobile and authenticated web deletion flows inspect user-partitioned device work,
  require two confirmations before local discard, require recent password
  authentication, and call an idempotent server RPC.
- The RPC rechecks the current user, zero-work attestation, active request, and sole
  organization-administrator state. Direct authenticated table inserts are revoked.
- A minimal RLS-protected audit trail records state changes without credentials,
  email addresses, or field-record contents.
- The scheduled finalizer removes push registrations and avatars, anonymizes the
  personal profile, soft-deletes the Supabase authentication identity, preserves
  organization-owned records, sends a completion message, and retries stale or failed
  work with stage markers.
- Public URLs are `/privacy`, `/support`, `/terms`, and `/account-deletion`.
- Native config blocks microphone, background-location, and release-overlay permissions, declares only
  point-of-use camera/photo/foreground-location behavior, contains an Apple privacy
  manifest (including approximate-location fallback), and sets the export-compliance flag.
- A final 1024px store icon is reused by the adaptive Android foreground and splash
  screen. A separate validated 512px Play icon and 1024 × 500 Play feature graphic
  are also checked in. No runtime store artwork download is used.

## Release gate

Before submission, all automated/native builds must pass; the additive migration and
routes must be exercised only in isolated staging; a private permanent reviewer
account must complete the scripted walkthrough; final phone/tablet screenshots and a
short reviewer video must be captured with synthetic data; production association
files and Play signing fingerprints must be approved; and the complete real
password-recovery email flow must pass with a non-customer inbox. Physical Android
acceptance remains a named hardware exception until a device is available.

`npm run verify:store:reviewer` performs a read-only sign-in/session/bootstrap check
against an explicitly confirmed backend and rejects `.test`/`.invalid` inboxes. Setting
`STORE_REVIEW_SEND_PASSWORD_RESET=true` deliberately sends the one final recovery
message; delivery, expiry, deep-link opening, and one-use behavior remain human inbox
checks and are recorded only in the gitignored private runbook.

## Local validation completed on 2026-08-26

- Root and Expo TypeScript checks, focused React lint, the full mobile suite, and the
  account-deletion compliance suite pass.
- The actual additive migration passes a disposable PostgreSQL integration run; the
  database/container is removed after the synthetic test.
- `npm run build`, iOS and Android Hermes exports, Expo Doctor (21/21), a clean Android
  debug APK/release-manifest build, and an unsigned iOS release simulator build pass.
- A local Android `bundleRelease` produced a diagnostic 1.0.0 AAB for
  `io.railcommand.app` with version code `300001`, min SDK 24, and target SDK 36.
  The release-manifest gate rejects background location, microphone, overlay,
  all-files, advertising-ID, Expo development-client callbacks, or development-menu
  surfaces. This locally generated AAB is debug-signed and must never be uploaded;
  the final Play artifact must use the approved upload key and Play App Signing.
- The isolated production build returns direct `200` responses for `/privacy`,
  `/support`, `/account-deletion`, and both `/.well-known` association routes; the
  association responses use `application/json` and do not redirect to authentication.
- The public mobile marketing version is `1.0.0`. Installed iPhone 17 Pro Max and
  iPad Pro 13-inch simulators produce the accepted `1320 × 2868` and `2064 × 2752`
  screenshot dimensions, and the capture gate rejects incomplete or malformed sets.
- A read-only Google Play Console check confirmed the Creative Currents organization
  owns a draft RailCommand record for `io.railcommand.app`. Its initial setup remains
  0 of 11 tasks complete; no console fields were changed or submitted during the check.
- The console-ready US-English listing and Google declaration payloads are structured,
  credential-free, and cross-checked against the 1.0 binary privacy manifest. Metadata
  limits, URLs, US-only scope, eight disclosed data types, no-sharing/no-ads posture,
  encryption, target audience, and asset paths pass automated verification.
- The generated native privacy files contain precise and coarse foreground location,
  no tracking, no microphone usage string, no background-location usage string, and
  `ITSAppUsesNonExemptEncryption = false`. Android removes background location,
  microphone, release overlay, advertising ID, and all-files access from the declared
  release posture.

## Remaining external evidence

- Apply the additive migration and routes to isolated staging, then exercise request,
  cancellation, 30-day-time simulation, identity anonymization/deletion, completion
  email, and failure retry. Do not apply these changes to production from this branch.
- Provision the permanent non-customer reviewer inbox/account in the approved release
  backend and run `npm run verify:store:reviewer`.
- Complete the real password-recovery inbox/deep-link/expiry/one-use test requested for
  final testing.
- Capture final iPhone/iPad and Android phone/tablet screenshots plus the private
  reviewer walkthrough from the archived release candidate using synthetic data.
- Complete the 11 Google Play initial setup declarations/listing tasks. The approved
  answers and copy are prepared locally, but saving them is an external store-console
  change and requires release-owner authorization. No Android emulator is currently
  installed for honest Android screenshot capture.
- Authenticate App Store Connect and verify the seller, agreements, app record,
  distribution, roles, and review fields; the available browser sessions currently
  stop at Apple's sign-in screen.
- Validate production Apple/Android association files and Play signing fingerprints.
  Both `/.well-known` routes must return direct `200 application/json` responses
  without authentication or redirects after the approved release deployment.
- Formally review the remaining production dependency audit before the release
  archive. After upgrading Next.js to 16.3.3 and applying compatible transitive
  overrides, the audit reports 0 critical, 0 high, and 11 moderate advisories. The
  remaining findings are confined to Expo CLI/config/prebuild and Xcode build-tool
  dependencies. npm proposes an incompatible Expo 46 downgrade rather than a safe
  Expo 57 fix, so `npm audit fix --force` is prohibited; reassess against the next
  compatible Expo 57 patch and record release-owner risk acceptance if none exists.
- A read-only production check on 2026-08-26 found that the live association,
  support, and deletion URLs still redirect to sign-in because this isolated branch
  has not been deployed; `/privacy` is already public. Recheck all five public URLs
  after an approved non-production deployment and again from the archived release
  candidate. This branch does not authorize a production deployment.
- Run the final physical iPhone deletion flow; physical Android remains a documented
  hardware exception until a device is available.
