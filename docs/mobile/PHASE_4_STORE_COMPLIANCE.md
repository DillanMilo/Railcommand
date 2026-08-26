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

## Isolated mobile staging environment

- Supabase organization **RailCommand Mobile Staging** owns the non-production project
  `rxuvchdqbzvovqijvfhx` in `us-east-2`. Its owner login uses the controlled
  `mobile-staging@railcommand.io` alias; the password is never committed.
- The reduced mobile schema and additive Phase 2–4 migrations are applied only to that
  project. Private tables have RLS enabled, mobile photo buckets are private, and the
  synthetic reviewer belongs only to **Synthetic US Track Renewal**.
- The staging web origin is `https://mobile-staging.railcommand.io`. Cloudflare DNS
  maps it to a Vercel **preview** deployment in `railcommand-mobile-staging`; other
  preview URLs remain deployment-protected. No production promotion occurred.
- Supabase Auth accepts `railcommand://**` and
  `https://mobile-staging.railcommand.io/**` callbacks. A real recovery message reached
  the controlled catch-all inbox, opened the custom-scheme callback once, and rejected
  a second use as expired. No token or password is retained in this document.
- The staging verifier confirms reviewer sign-in, session refresh, one authorized
  synthetic project, and password-reset request acceptance. Production Supabase and
  customer data were not queried or changed.

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
- Google Play Console confirms the Creative Currents organization owns the draft
  RailCommand record for `io.railcommand.app`. The later authorized draft-only work is
  recorded below; nothing has been sent for review or published.
- The console-ready US-English listing and Google declaration payloads are structured,
  credential-free, and cross-checked against the 1.0 binary privacy manifest. Metadata
  limits, URLs, US-only scope, eight disclosed data types, no-sharing/no-ads posture,
  encryption, target audience, and asset paths pass automated verification.
- Google's live 782-row Data Safety CSV schema was exported read-only and converted
  into a deterministic private import draft with 50 reviewed responses. The generator
  rejects missing machine-readable questions, stale selected data types, required
  blanks, and divergence between the declaration payload and usage answers.
- The private reviewer-video recorder and verifier enforce a portrait H.264/HEVC file,
  1080px-or-better width, and a 45–240 second duration. The approved three-minute
  script starts after authentication, uses only synthetic records, exercises one
  offline log/photo through exactly-once sync, and never submits account deletion.
- A read-only EAS check confirms the `creative-currents` organization owns the
  `@creative-currents/railcommand` build project. No production EAS build or signing
  request was started. The Mac currently has no valid Apple signing identity and no
  RailCommand distribution profile, so an App Store archive remains correctly blocked
  until the organization team and credentials are verified in App Store Connect.
- The generated native privacy files contain precise and coarse foreground location,
  no tracking, no microphone usage string, no background-location usage string, and
  `ITSAppUsesNonExemptEncryption = false`. Android removes background location,
  microphone, release overlay, advertising ID, and all-files access from the declared
  release posture.
- An authorized deployment of the verified artifact is `READY` at the unique preview
  `railcommand-mobile-staging-hq5bemnbh-dillans-projects-f662840b.vercel.app`, deployment
  `dpl_2xU6TLtrJKs27gAS6wdET57amMTi`. The public custom staging alias points directly to
  that preview without promoting it to production. Health, policy, deletion, support,
  and both association routes return direct `200` responses on the custom host. No
  `--prod` flag, production mutation, or customer-data access occurred.
- With explicit release-owner authorization, Google Play now holds saved drafts for
  the privacy URL, no-ads posture, non-government declaration, no financial or health
  features, Business category, support contact/HTTPS website, and external marketing
  OFF. The permanent synthetic reviewer sign-in details, 18-and-over target audience,
  and corrected 50-response Data Safety declaration were reviewed and saved as drafts.
  Optional trusted-partner credential testing is OFF. The US-English short and full
  listing descriptions were also saved as a draft. The dashboard shows 10 of 11 setup
  tasks complete; final screenshots are the remaining listing blocker. Nothing was
  sent for review or published, and no Android bundle was uploaded.

## Remaining external evidence

- Exercise the Phase 4 deletion request, cancellation, 30-day-time simulation,
  identity anonymization/deletion, completion email, and failure retry in isolated
  staging. A fail-closed verifier now covers the zero-local-work gate, request
  idempotency, session revocation, cancellation, and preparation of one explicitly
  identified pending synthetic request. Its first live run correctly stopped because
  the Preview deployment has no server-only Supabase credential; the partially created
  request was canceled immediately. Add the staging-only service credential and cron
  secret to Vercel Preview only after release-owner confirmation, then run irreversible
  finalization only after a second confirmation naming the synthetic account. Do not
  apply these changes to production from this branch.
- Capture final iPhone/iPad and Android phone/tablet screenshots plus the private
  reviewer walkthrough from the archived release candidate using synthetic data.
- Complete the remaining Google Play initial setup work. The dashboard currently shows
  10 of 11 tasks complete. The permanent reviewer sign-in details, adult-only target
  audience, and Data Safety declaration are saved drafts. The IARC questionnaire is
  complete using the verified routed support
  address; it produced an ESRB Teen rating for North America and 12+/parental-guidance
  equivalents elsewhere because invited organization users share field content and
  optional location. This completed the rating questionnaire only and did not send the
  app for review. The validated 512px icon and 1024 × 500
  feature graphic were uploaded and attached to the US-English listing on August 26,
  2026, then saved as a draft without publishing or sending the app for review. The
  store-listing task remains incomplete until final screenshots are uploaded. No
  Android emulator is currently installed for honest Android screenshot capture.
- Authenticate App Store Connect and verify the seller, agreements, app record,
  distribution, roles, and review fields; the available browser sessions currently
  stop at Apple's sign-in screen.
- The checked-in Expo configuration and EAS project agree on
  `@creative-currents/railcommand` (`dda86dca-ca12-4efa-a556-6fd8411485d5`), and the
  authenticated EAS account confirms Creative Currents ownership. This Mac still has
  zero valid Apple code-signing identities. Its only installed distribution profile is
  for `com.creativecurrents.pawpal`, not RailCommand, so no RailCommand archive can be
  signed accidentally. The profile does independently confirm Apple team
  `PQAGLH9L66` / Creative Currents LLC.
- A clean Expo CNG prebuild with the staging profile resolves to
  `io.railcommand.app.staging`, `mobile-staging.railcommand.io`, and the isolated
  Supabase project. A Release bundle now builds, installs, and launches directly—no
  Metro server or development-client callback—on the local iPhone 17 Pro Max and iPad
  Pro 13-inch simulators. Their captured frames are the accepted `1320 × 2868` and
  `2064 × 2752` dimensions. The runnable simulator build uses only local ad-hoc
  simulator signing so Keychain/SecureStore entitlements function; it creates no Apple
  distribution identity or profile. The separate unsigned simulator build remains the
  CI structural gate and is not used for authenticated runtime acceptance.
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
