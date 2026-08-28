# Phase 4 — store compliance and review package

Status: **complete on the isolated `codex/mobile-phase-4-compliance` branch as of
2026-08-27, with the dated physical-Android hardware exception accepted by the release
owner. Nothing in this phase authorizes a
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

Store signing and build-profile selection are **online-only release tooling**. They do
not read, alter, or replace the native user-scoped draft/outbox database, so the
existing offline field workflow and foreground synchronization guarantees are
unchanged.

Store-review instructions, screenshots, and any optional reviewer video are
**online-only submission support**. The video is not required for Phase 4 because the
ordinary camera/location workflow is reproducible with the permanent synthetic account
and written steps. This documentation decision does not change the app's offline
draft/queue behavior.

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
- The Preview environment uses the modern Supabase publishable key in the client and
  a separately generated modern secret key only in server-side functions. Both server
  secrets are encrypted and scoped to Preview; neither Production nor Development was
  selected. The staging project's legacy JWT-based API keys are disabled.
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
account must complete the written scripted walkthrough; final phone/tablet screenshots
must use synthetic data; Play signing fingerprints must be recorded; and the complete real
password-recovery email flow must pass with a non-customer inbox. Physical Android
acceptance remains a named hardware exception until a device is available.

A private reviewer video is optional supporting material, not a release gate. Create
one only if Apple or Google requests it or the release owner separately determines it
would materially help review.

Publishing the production Apple/Android association files is intentionally deferred to
the Phase 6 release prerequisites. Their isolated patch is prepared and preview-built,
but it must not merge into `main` or deploy to `railcommand.io` until the mobile release
candidate has completed Phase 5 and the release owner gives action-time production
authorization.

`npm run verify:phase4:status` reports the exact checked-in local and external gate
inventory without failing while work is in progress. `npm run verify:phase4:release`
is the fail-closed final command: it remains red until every required gate is verified,
all 18 required authenticated store frames exist, and any physical Android exception has a dated
release-owner acceptance. The manifest explicitly records that this branch carries no
production-mutation authorization.

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
- The optional private reviewer-video recorder and verifier enforce a portrait H.264/HEVC file,
  1080px-or-better width, and a 45–240 second duration. The approved three-minute
  script starts after authentication, uses only synthetic records, exercises one
  offline log/photo through exactly-once sync, and never submits account deletion.
  These tools remain available if a store reviewer later requests a video; no video is
  required for the checked-in Phase 4 release gate.
- A read-only EAS check confirms the `creative-currents` organization owns the
  `@creative-currents/railcommand` build project. No production EAS build was started.
  With explicit owner authorization on August 27, EAS subsequently created exactly one
  Apple Distribution certificate and one active App Store provisioning profile for
  `io.railcommand.app` under Creative Currents LLC team `PQAGLH9L66`. Both expire
  August 27, 2027. No push key, App Store Connect API key, build, upload, submission,
  or release was created or started.
- Each EAS build profile now pins its matching application profile while Expo config
  fails closed when no profile is supplied. The production credential workflow resolved
  exactly to `io.railcommand.app`, and EAS reported that all required build credentials
  are ready after creating the authorized certificate and profile. No push key or App
  Store Connect key was created.
- The generated native privacy files contain precise and coarse foreground location,
  no tracking, no microphone usage string, no background-location usage string, and
  `ITSAppUsesNonExemptEncryption = false`. Android removes background location,
  microphone, release overlay, advertising ID, and all-files access from the declared
  release posture.
- An authorized deployment of the verified artifact is `READY` at the unique preview
  `railcommand-mobile-staging-cxjh1ftoq-dillans-projects-f662840b.vercel.app`, deployment
  `dpl_Dx3zCQHYbhzja2wft185211QcDdp`. The public custom staging alias points directly to
  that preview without promoting it to production. Health, policy, deletion, support,
  and both association routes return direct `200` responses on the custom host. No
  `--prod` flag, production mutation, or customer-data access occurred.
- The canonical staging database received one additive least-privilege migration that
  grants the trusted server role only `SELECT`/`UPDATE` on deletion requests and
  `SELECT`/`INSERT` on deletion audit events. A modern-secret REST probe returned `200`.
  The live reversible lifecycle then verified the unsynchronized-work rejection,
  idempotent request creation, session revocation, duplicate handling, cancellation,
  and a clean end state with no pending request. The permanent synthetic-account
  finalizer was not run and still requires a separate action-time confirmation.
- The staging Security Advisor reports zero errors. Its two function warnings are the
  intentional, authenticated-only `SECURITY DEFINER` deletion RPCs: each has an empty
  search path, rejects missing identity, validates recent password authentication and
  request ownership, revokes `PUBLIC`/`anon`, and grants only `authenticated` execute.
  The remaining leaked-password-protection warning is a Free-plan limitation; Supabase
  documents that protection as Pro-plan-and-above functionality.
- With explicit release-owner authorization, Google Play now holds saved drafts for
  the privacy URL, no-ads posture, non-government declaration, no financial or health
  features, Business category, support contact/HTTPS website, and external marketing
  OFF. The permanent synthetic reviewer sign-in details, 18-and-over target audience,
  and corrected 50-response Data Safety declaration were reviewed and saved as drafts.
  Optional trusted-partner credential testing is OFF. The US-English short and full
  listing descriptions were also saved as a draft. All initial setup tasks are now
  complete: the final listing includes the authenticated screenshot sets, and Google’s
  AI-asset declaration labels only the generated app icon and feature graphic as created
  or edited using AI. The real application screenshots are not AI-labeled. Nothing was
  sent for review or published, and no Android bundle was uploaded.
- The final checked-in store-media set now contains three authenticated synthetic-data
  screenshots for each supported Apple device class and the complete six-state
  offline/reconnect story for both Google phone and tablet. All 18 files pass strict
  format and dimension validation. This intentionally lean Apple set avoids duplicating
  the acceptance walkthrough while still showing the dashboard, saved daily-log draft,
  and privacy controls.

## Additional validation completed on 2026-08-27

- A physical iPhone 17 Pro Max running the development application verified the
  account-deletion zero-work inspection and the local-work safeguard with a single
  synthetic draft named `PHASE 4 DELETION SAFEGUARD TEST — SAFE TO DISCARD`. The
  deletion request stayed disabled while the draft existed. After the release owner
  explicitly approved disposal of that exact synthetic item, both confirmation stages
  were exercised and the device returned to `0 draft(s) · 0 queued item(s) · 0 photo(s)`.
  The UI confirmed that server records were not changed, and no account-deletion request
  was submitted. The remaining device-side acceptance step is the online-only block
  while Airplane Mode and Wi-Fi are off; iPhone Mirroring intentionally would not apply
  that connectivity-setting change, so the gate remains pending rather than inferred.
- With Airplane Mode enabled and Wi-Fi disabled on that physical iPhone, the release
  owner subsequently observed the exact warning **“Account deletion is online only and
  is never silently queued.”** The release owner then confirmed that the request control
  remained disabled. No deletion intent was queued and no request was submitted. This
  completes the physical-iPhone offline account-deletion block evidence.
- Google Play's US-English default listing now has six authenticated synthetic phone
  screenshots, six 7-inch tablet screenshots, and six 10-inch tablet screenshots
  attached in the approved story order. The console confirmed **Your changes have been
  saved** and **Draft saved** on 2026-08-27. The listing remains a draft; it was not
  submitted, reviewed, or published.
- The staging-only `app-review@railcommand.io` reviewer password was directly reset and
  independently verified against staging Auth after the recovery-email rate limit was
  reached. Google Play **Sign in details** was updated with the verified credential and
  confirmed **“Change saved. Send for review in Publishing overview.”** The password is
  not stored in Git, and no review, submission, or publication action was taken.
- On 2026-08-27 the release owner explicitly accepted the named physical Android
  hardware exception based on the completed API 36 phone and tablet emulator evidence.
  A physical Android pass remains a tracked post-Phase-4 follow-up when hardware is
  available and is not misrepresented as completed device testing.
- After authenticated store-media capture, the temporary deletion-QA project membership
  was removed from `rxuv…` with an exact one-row guard. A follow-up query verified zero
  matching memberships and one retained staging Auth identity. Five local temporary
  credential/environment files were permanently removed, and the worktree remained clean.
- The root TypeScript check, complete mobile suite, Phase 4 gate tests, deletion suites,
  strict 18-frame media check, asset/metadata/declaration validation, and a Webpack
  production build were rerun successfully after cleanup. The authorized Vercel deployment
  remains a `READY` Preview, and all five public routes on `mobile-staging.railcommand.io`
  still return direct `200` responses with both association files served as
  `application/json`.
- The complete mobile test suite, root TypeScript check, store-media capture tests,
  Phase 4 release-gate tests, asset validation, store metadata validation, and store
  declaration validation pass.
- The strict media gate validates all 18 required files with zero missing frames. The
  higher-level Phase 4 gate now consumes the same target-specific requirements and
  remains fail-closed for the five external release items below.
- A full Next.js 16.3.3 production build passes through the supported Webpack builder.
  Turbopack could not start its local CSS helper process in the managed runner because
  temporary port binding was denied; the failure occurred before application code
  compilation and did not require a Mac restart or an app change.
- The Android release-manifest verifier was not rerun because this media-only worktree
  does not contain a generated release AAB. The previously recorded clean AAB/manifest
  result remains the applicable binary evidence; a fresh final AAB will be regenerated
  and verified at the signing/archive gate.

## Remaining external evidence

- The production `https://railcommand.io/.well-known/apple-app-site-association` and
  `https://railcommand.io/.well-known/assetlinks.json` endpoints were checked read-only
  on 2026-08-27. Both currently return `307` to `/login`, so the production association
  gate remains correctly blocked. No deployment, middleware change, or other production
  mutation was performed. Google Play's App signing page independently reports that
  Play App Signing is in use for `io.railcommand.app` and supplied the exact public
  SHA-256 fingerprint now recorded in `docs/mobile/linking/assetlinks.template.json`;
  the upload-key fingerprint remains unavailable until the first bundle is uploaded.
- The canonical mobile staging backend is confirmed as `rxuvchdqbzvovqijvfhx` through
  its authenticated dashboard, current API keys, Preview health route, and deletion
  lifecycle. A different project named **RailCommand Mobile Staging** with ref
  `cyacardivfzrsravqjto` remains a separate inventory item. It was not linked, renamed,
  archived, or mutated; never redirect the mobile environment to it by inference.
- The isolated Phase 4 deletion QA identity remains in staging Auth, but its temporary
  **Synthetic US Track Renewal** project membership was permanently removed after
  authenticated store-media capture on 2026-08-27. A guarded staging-only deletion
  returned exactly one membership row; the follow-up verification reported zero matching
  memberships and one retained Auth identity. The five local temporary environment and
  credential files used for the cleanup were also removed, and the branch worktree stayed
  clean. No production or customer-data path was created or retained.
- The reversible Phase 4 deletion lifecycle now passes in isolated staging with modern
  keys and least-privilege server grants. A 30-day-time simulation that permanently
  anonymizes/deletes the named synthetic identity, verifies the completion email, and
  exercises finalizer retry is still intentionally outstanding. Run that irreversible
  step only after a separate confirmation naming the synthetic account. Do not apply
  these changes to production from this branch.
- On August 27, 2026, the permanent `app-review@railcommand.io` staging reviewer
  password was changed through the delivered one-use recovery callback. A fresh
  password-grant sign-in succeeded against `rxuvchdqbzvovqijvfhx` and its verification
  session was closed immediately. The recovery session was revoked globally because
  its callback had appeared in private diagnostic output, and the two temporary local
  recovery files were permanently removed. The new credential was saved in Google
  Play's reviewer-access draft; it was not submitted or published.
- The completed iPhone/iPad and Android phone/tablet screenshots are attached to their
  Google Play draft slots. The written reviewer walkthrough and physical-iPhone
  acceptance use the same synthetic data; a private video is not required unless a
  store reviewer later asks for one.
- Google Play initial setup is complete in saved-draft state. The permanent reviewer
  sign-in details, adult-only target audience, and Data Safety declaration are saved
  drafts. The IARC questionnaire is
  complete using the verified routed support
  address; it produced an ESRB Teen rating for North America and 12+/parental-guidance
  equivalents elsewhere because invited organization users share field content and
  optional location. This completed the rating questionnaire only and did not send the
  app for review. The validated 512px icon and 1024 × 500
  feature graphic were uploaded and attached to the US-English listing on August 26,
  2026, then saved as a draft without publishing or sending the app for review. On
  August 27, the required AI-asset declaration was saved accurately for those two
  generated assets only; the authenticated application screenshots were left
  unselected. Google then marked the default listing ready to send for review and
  removed the initial-setup checklist from the dashboard.
  Android API 36 phone/tablet emulator profiles are now installed, and the
  self-contained staging Release has passed online and offline cold launch on both
  profiles. The six final authenticated synthetic-data stories for each form factor
  are checked in and pass strict media validation.
- A read-only App Store Connect audit verified **Creative Currents LLC**, app ID
  `6803576049`, bundle ID `io.railcommand.app`, SKU `railcommand-ios-1`, iOS version
  1.0 in **Prepare for Submission**, public discoverable distribution, and United
  States-only availability (1 territory available, 174 unavailable). Dillan has
  Account Holder/Admin access to all apps, and the Free Apps Agreement is active from
  August 18, 2026 through July 20, 2027. The Paid Apps Agreement is unsigned, which is
  not a blocker for the approved free/no-IAP v1 posture. Before submission, change
  automatic release to manual and complete the missing screenshots, description,
  keywords, URLs, copyright, subtitle/category/content-rights/age-rating answers,
  privacy-policy questionnaire, reviewer contact/credentials/notes, and build.
- The checked-in Expo configuration and EAS project agree on
  `@creative-currents/railcommand` (`dda86dca-ca12-4efa-a556-6fd8411485d5`), and the
  authenticated EAS account confirms Creative Currents ownership. The local Mac still
  has zero valid Apple distribution signing identities; the RailCommand distribution
  certificate and active App Store profile are EAS-managed credentials rather than
  locally installed credentials. The production workflow correctly resolves
  `io.railcommand.app` and team `PQAGLH9L66` / Creative Currents LLC. EAS reported all
  required build credentials ready, while no production build or store upload was
  started.
- With explicit owner authorization, the physical staging iPhone was registered under
  Creative Currents LLC and an internal reviewer build profile was added for the
  development identity `io.railcommand.app.dev`. EAS created one device-scoped ad-hoc
  provisioning profile using the existing Apple Distribution certificate; no second
  certificate was created. A guarded, self-contained Release build passed the staging
  environment boundary, installed on the registered iPhone, and launched without
  Metro. The local temporary certificate, provisioning profile, isolated signing
  Keychain, and credential export were then removed. No app build was uploaded,
  submitted, promoted, or released, and production was not changed.
- A clean Expo CNG prebuild with the staging profile resolves to
  `io.railcommand.app.staging`, `mobile-staging.railcommand.io`, and the isolated
  Supabase project. A Release bundle now builds, installs, and launches directly—no
  Metro server or development-client callback—on the local iPhone 17 Pro Max and iPad
  Pro 13-inch simulators. Their captured frames are the accepted `1320 × 2868` and
  `2064 × 2752` dimensions. The runnable simulator build uses only local ad-hoc
  simulator signing so Keychain/SecureStore entitlements function; it creates no Apple
  distribution identity or profile. The separate unsigned simulator build remains the
  CI structural gate and is not used for authenticated runtime acceptance.
- Android API 36 phone and tablet emulator profiles are installed locally. A guarded
  staging Release APK for `io.railcommand.app.staging` now rebuilds its embedded
  JavaScript whenever the mobile environment changes, installs without Metro, and
  cold-launches on the phone and tablet emulators both online and with airplane mode
  plus Wi-Fi and mobile data disabled. The tablet uses its adaptive centered layout;
  both apps remained foregrounded and their process-filtered logs contained no fatal
  JavaScript/native exception. The six authenticated synthetic-data screenshots for
  each Android form factor are now checked in and validated. This remains emulator
  evidence only; the physical Android hardware exception remains open.
- The Google capture tool resolves the selected Android SDK explicitly, requires the
  approved logical emulator size, removes only framebuffer letterboxing, preserves
  aspect ratio, and produces a validated JPEG. An end-to-end temporary tablet capture
  passed at `1920 × 1080`; it was not added to the final story set because the frame
  was intentionally unauthenticated.
- In Phase 6, validate the production Apple/Android association files. Both
  `/.well-known` routes must return direct `200 application/json` responses without
  authentication or redirects after the separately approved release deployment. The
  current live redirects remain expected until then.
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
- Physical Android remains a documented hardware exception until a device is available;
  the physical iPhone deletion safeguards and offline submission block are complete.
- On August 27, 2026, the release owner completed the full written reviewer walkthrough
  on the guarded staging-only physical-iPhone build: online authenticated dashboard,
  offline transition, one synthetic daily log/photo queued, force-close/reopen with the
  pending work restored, reconnect, and successful exactly-once synchronization. This
  verifies the reviewer-walkthrough gate. A QuickTime capture did not preserve the
  interaction and was not accepted as evidence; no reviewer video is part of the
  release package. Any incomplete local recording may be removed separately after an
  explicit cleanup authorization. The release owner approved treating video as
  optional support rather than a Phase 4
  requirement.
