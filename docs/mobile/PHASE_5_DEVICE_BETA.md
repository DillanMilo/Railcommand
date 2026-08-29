# Phase 5 — visual alignment, device acceptance, and beta distribution

Last updated: 2026-08-29

## Goal

Prove the native field app on representative real devices, preserve the accepted
offline/security behavior, and distribute controlled betas. Phase 5 begins with
a focused RailCommand visual-alignment pass so device and accessibility testing
validate the intended interface rather than a disposable scaffold.

This is deliberately a lean release matrix. It does not require owning every
screen size or testing every possible OS/device combination.

## Current decision status

The internally executable Phase 5 foundation is complete on the isolated feature
branch: the scoped native workflows use the RailCommand visual system, the physical
iPhone and iPad critical paths pass, Android phone/tablet builds and emulator evidence
pass, and all source, bundle, offline, security, and web-build gates are green.

Phase 5 is **ready for controlled beta work, but not fully accepted for public
release**. The remaining gates are deliberately narrow:

1. physical Android critical-path acceptance on one representative phone;
2. a supervised physical VoiceOver/TalkBack smoke test with an explicit exit path;
3. separately authorized TestFlight/Google Play internal distribution and the
   resulting beta regression;
4. refreshed store screenshots after the visual-alignment work.

None of those open gates justifies expanding the scoped v1 into native RFI,
submittal, administration, billing, or full-project offline workflows.

## Visual baseline

The native app uses the same core identity as the RailCommand web app:

- `#0F172A` navy, `#F97316` orange, and the warm command-shell background;
- the existing RailCommand track mark rather than a substitute monogram;
- bundled Plus Jakarta Sans headings, DM Sans body copy, and JetBrains Mono
  operational labels;
- sharp cards, restrained offset shadows, compact status badges, and a persistent
  field-work navigation bar;
- mobile-native screen structure and controls rather than a desktop layout
  squeezed into a phone viewport.

On 2026-08-29 the signed-in web shell was measured read-only at 390 × 844,
768 × 1024, and desktop width in Safari Responsive Design Mode. The native shell now
uses the same white 66-point top bar with compact navy project control, breadcrumb and
project-heading sequence, two-column six-card dashboard grid, restrained card shadow,
and 64-point five-item bottom navigation. This is a presentation-only change: it does
not add a network dependency or change cached data, drafts, photos, authentication, or
outbox synchronization.

The visual pass covers sign-in, dashboard/project selection, daily logs, Sync
Center, Account/privacy, invitations, password recovery, supporting cached record
screens, and honest Submittal/RFI module-status routes. Material visual changes
require replacement store screenshots before submission.

## Offline classification

The visual foundation is **offline-capable presentation**. Its fonts, logo, icons,
colors, and layout assets are bundled in the installed application. It adds no
network dependency and does not change the accepted SQLite draft/outbox or secure
session contracts. The native app-switcher privacy shield is also offline-capable:
it covers the route tree whenever the app becomes inactive or backgrounded without
reading, transmitting, or changing field data.

Existing workflow classifications remain:

- cached projects, team, and recent logs: **offline read-only**;
- new daily-log fields, location, and photos: **offline draft/queue**;
- foreground reconnect synchronization: **offline-capable** with authenticated,
  idempotent server delivery;
- notification registration, invitation acceptance, password recovery, and
  account deletion: **online-only** with explicit messaging and no silent queue.

Photo attachment hardening is **offline draft/queue** behavior. A selected image is
given an app-owned UUID path with a whitelisted extension before it enters SQLite,
while its user-visible name is reduced to a safe final filename. The app rejects
files larger than the server's 25 MB limit before queuing them and explains that the
daily-log draft remains saved. A device-copy or storage failure likewise leaves the
form and draft intact and creates no partial outbox operation.

## Lean device matrix

| Target | Required evidence | Coverage approach |
| --- | --- | --- |
| Current physical iPhone | Required | Clean/update install, offline launch, force-close/restart, network loss/reconnect, camera/location, sign-out/user switch, large text, VoiceOver smoke test |
| iPad | Required while tablet support remains enabled | Portrait adaptive layout, keyboard obstruction, large text, offline draft/reconnect smoke test |
| Current physical Android phone | Required before public release | Same critical field workflow, TalkBack smoke test, permission revocation, offline restart/reconnect |
| Small/older-supported Android | Required without separate hardware | API 24+ emulator for install/layout/token-expiry and permission checks |
| Large/foldable Android | Required without separate hardware | API 36 tablet/foldable emulator for adaptive layout and keyboard checks |
| Small/large iPhone sizes | Required without separate hardware | iOS simulator layout, text scaling, and screenshot checks |

The dated physical-Android exception accepted for Phase 4 store drafting does
not replace the Phase 5 physical Android release gate. A borrowed device or a
small external tester pool is sufficient; purchasing a device fleet is not.

## Critical acceptance scenarios

1. Install or update the isolated beta and sign in with a staging-only account.
2. Open cached project/log data after losing connectivity.
3. Create one daily log with location and one photo while offline.
4. Force-close and reopen; verify the draft/outbox and photo remain.
5. Reconnect and synchronize exactly one log and one photo.
6. Revoke camera/location access; verify the denial is explained and saved input
   remains intact.
7. Expire/refresh the session, switch users A → B → A, and verify local isolation.
8. Verify sign-out safeguards with pending work.
9. Run large text plus VoiceOver/TalkBack focus-order and target-size checks.
10. Confirm sensitive content is obscured in the app switcher/background state
    before beta promotion.

Low-storage and large/thermal-photo tests may use deterministic development
fixtures plus one constrained-device check; repeatedly filling personal hardware
is not required.

## Beta progression

1. Local simulator/emulator and tethered development builds.
2. TestFlight internal and Google Play internal testing using the dedicated `beta`
   distribution target: store identifier `io.railcommand.app`, staging runtime profile,
   staging backend, and `mobile-staging.railcommand.io` links.
3. Small external/closed tester group after the critical acceptance scenarios pass.
4. Release-candidate regression with production configuration validation, without
   promoting or releasing until Phase 6 approval.

No Phase 5 activity merges to `main`, promotes a Vercel deployment, publishes a
store listing, or touches production customer data without separate authorization.
The beta profile may be configured and validated locally, but it must not be built
remotely or uploaded until separately authorized.

## Automated evidence — 2026-08-28

- Expo lint and the Expo mobile TypeScript check pass.
- The full focused mobile suite passes: 67 domain, offline, API-client, Expo,
  authenticated mobile-API, and link-association checks.
- The existing Next.js production build and repository TypeScript check pass.
- iOS and Android Expo exports pass and contain the bundled RailCommand mark,
  six cross-platform TTF font assets, and native tab symbols.
- A local Android native compile also passes for both debug and release variants
  using the installed Android SDK: build tools 36.0.0, compile/target SDK 36,
  minimum SDK 24, NDK 27.1.12297006, and all four generated ABIs. The isolated
  development package is `io.railcommand.app.dev`, version `1.0.0` build `300001`.
  The release manifest excludes background location, microphone, overlay, debug,
  and cleartext-traffic allowances; its verified HTTPS app link is limited to
  `mobile-staging.railcommand.io`. A bundle scan finds only the staging project ref
  and staging host, no secret-key/server-environment/cron/JWT marker. The word
  `service_role` remains only in the guard that rejects privileged keys.
- Android automatic cloud backup is now disabled in the Expo source configuration.
  A regenerated release manifest independently records `android:allowBackup="false"`,
  preventing cached field data from entering ordinary Android app backups. This
  compile/manifest evidence is not represented as physical Android acceptance and
  no APK was uploaded or distributed.
- A current public-config evaluation of the controlled `beta` target resolves to
  `io.railcommand.app` on both stores while retaining the `staging` runtime,
  `mobile-staging.railcommand.io` Universal/App Links, build `300001`, blocked
  background-location/microphone/overlay permissions, and Android backup disabled.
  This evaluation did not start an EAS build or contact either store.
- The exports were repeated after the accessibility and network-loss hardening at
  commit `4416273`. Both Hermes bundles contain only the isolated staging project ref
  and `mobile-staging.railcommand.io` runtime identity. A generated-bundle scan found
  no `sb_secret_`, server environment-variable name, cron-secret marker, or JWT-like
  token. The literal `service_role` word is present only in the bundled runtime guard
  that rejects any publishable key containing `service_role` or `secret`.
- Local sign-in rendering at 390 × 844 and 1024 × 1366 shows meaningful content,
  no framework error overlay, and no horizontal overflow.
- The browser visual-QA path uses memory-only session storage and skips unavailable
  notification callbacks. Native builds continue to use Keychain/Keystore and the
  existing notification/deep-link lifecycle.
- A self-contained signed Release build for `io.railcommand.app.dev` passed Xcode's
  bundle validation and was installed on the paired iPhone 17 Pro Max running iOS
  26.6. The environment guard recorded only the isolated staging Supabase project
  `rxuvchdqbzvovqijvfhx` and `mobile-staging.railcommand.io`; no server secret was
  copied into the mobile configuration.
- The same Release bundle launched on an iPhone 16e simulator and an iPad (A16)
  simulator. The compact phone sign-in screen had no horizontal overflow or safe-area
  clipping. On iPad, the complete sign-in form and both actions remained visible with
  the software keyboard open.
- The largest iOS accessibility text setting exposed an oversized decorative brand
  heading. The heading and eyebrow now cap only their decorative display scaling while
  body copy, form labels, and inputs retain Dynamic Type. A repeated runtime screenshot
  confirmed the RailCommand heading remains intact and the enlarged form remains
  vertically scrollable. The focused Expo suite now has 34 passing checks, including
  eight visual-foundation checks.
- Automated contrast checks now preserve the bright RailCommand orange as a brand
  surface with navy foreground text, while small orange labels and active navigation
  use a darker accessible orange. Normal muted copy exceeds 4.5:1, destructive button
  text exceeds 4.5:1, and input boundaries exceed the 3:1 non-text threshold. Primary,
  secondary, field, and tab targets remain at least 48 points. The app adds no custom
  motion layer; native navigation can follow the operating system's reduced-motion
  behavior.
- Dashboard navigation cards and cached daily-log rows now expose explicit link/button
  roles, complete spoken labels, selected-project state, and a log-opening hint in
  source-order focus. These deterministic semantics support—but do not replace—the
  remaining physical VoiceOver and TalkBack smoke tests.
- A native app-state privacy shield now replaces visible project content with a
  bundled neutral RailCommand cover while the app is inactive or backgrounded. It
  does not disable ordinary screenshots while the user is actively working and does
  not add a network or storage dependency. After RailCommand was backgrounded on the
  iPhone 16e simulator, the exact iOS SplashBoard app-switcher snapshot was extracted
  and rendered: it contained only the navy RailCommand mark and “Field work protected”
  cover. A fresh signed build containing this control was then installed on the paired
  physical iPhone.
- Deterministic client tests now cover path-like Android provider names, unsafe or
  mismatched extensions, control/Unicode characters, bounded display names, and the
  exact 25 MB attachment limit. The server independently reconstructs the authorized
  project/parent/operation path and revalidates membership, ownership, MIME metadata,
  and exact bucket/path equality before finalization. Oversized or locally unwriteable
  photos never enter the outbox, and their daily-log draft remains saved.
- Local photo deletion now accepts only the exact app-owned
  `Documents/railcommand/<user>/<project>/photos/<photo UUID>.<safe extension>` path.
  A SQLite/storage-pressure failure after a successful file copy removes that exact
  unqueued copy and keeps the draft. Post-sync cleanup is best-effort after the atomic
  database completion, so a filesystem cleanup error cannot turn an already
  synchronized server operation back into a duplicate retry.
- The mobile environment guard now has direct cleartext rejection coverage for both
  Supabase and the authenticated JSON API. A native-boundary regression check confirms
  the bundled shell has no WebView/server URL, arbitrary-load or cleartext override,
  and no console logging path for session or bearer credentials.
- An authenticated request that reaches staging with an expired access token now asks
  Supabase for one refreshed session and replays that same request at most once. The
  daily-log and photo operations retain their original idempotency keys. A failed or
  unavailable refresh leaves queued field work on the device in a visible failed or
  retrying state; it never drops or duplicates the operation.
- Sign-in, password-reset delivery, and password update are single-flight controls with
  `finally` cleanup and explicit connectivity failures, preventing a network flap from
  leaving a spinner or encouraging repeated recovery emails. Privacy/support launch
  failures are also reported in the live Account status region rather than becoming
  silent dead controls.
- CoreDevice inspection on the paired iPhone recorded the installed staging identity
  as `io.railcommand.app.dev`, version `1.0.0` and build `300001`. With the app stopped,
  its app-owned Documents container still contained the user-partitioned SQLite files,
  while the completed photo directory was empty after synchronization. A controlled
  cold launch succeeded and the RailCommand process remained alive on the follow-up
  check. No database contents were opened, and temporary process inventories were
  deleted after verification.
- The post-accessibility recovery run confirmed that VoiceOver was disabled again,
  ordinary swipe/unlock gestures returned, and the user could reopen RailCommand
  normally. The temporary VoiceOver smoke test is not counted as accepted evidence:
  it changed the user's unlock gestures and was stopped. Future physical screen-reader
  checks require an explicitly supervised exit path; until then, deterministic roles,
  labels, focus order, contrast, target-size, and Dynamic Type coverage remain the
  recorded accessibility evidence.
- The current physical iPhone opened the Overview, Logs, Sync Center, and Account tabs
  with the staging-only synthetic project. Offline daily-log/photo persistence,
  force-close restoration, exact-once reconnect synchronization, session restoration,
  location/photo permission handling, sign-out safeguards, and the native app-switcher
  privacy cover were exercised without production data. No primary navigation control
  remained dead during the accepted run.
- A fresh 2026-08-29 release-gate run passed all 63 focused mobile tests, Expo lint,
  the Expo and repository TypeScript checks, and both iOS and Android bundled exports.
  The complete Next.js production build passed through the supported Webpack builder.
  The managed runner prevented Turbopack from binding its internal loopback port, so
  that environmental failure is not represented as a source-code or application
  failure.
- A physical iPad Pro (12.9-inch, 5th generation) was registered against a newly
  recreated staging-only ad-hoc profile for `io.railcommand.app.dev`. The existing
  Apple Distribution certificate was retained. Device crash evidence caught that the
  first manual archive had omitted EAS's public development variables during Metro
  bundling; the runtime guard rejected its empty Supabase URL before any request was
  made. That archive was discarded. A replacement Release archive embeds only the
  expected staging project and API host, contains no server-secret, cron-secret, or
  JWT-like marker, passes strict code-signature verification, and is installed on the
  iPad as version `1.0.0` build `400001`. CoreDevice launched the corrected app and
  confirmed its process remained alive. A live, non-recording QuickTime preview showed
  the physical iPad sign-in screen with the software keyboard open: the complete form,
  primary sign-in action, password-reset action, and supporting copy remained visible
  without clipping, overlap, or keyboard obstruction. No build was uploaded, no store
  record was changed, and production was not accessed.
- The signed-in physical iPad then completed the staging-only offline draft/queue
  smoke test with synthetic data. While fully offline, one daily log was queued with
  zero photos and the Sync Center reported that it was waiting for connectivity. The
  app was force-closed and reopened while still offline; the same single pending log
  was restored without lost input or duplication. After connectivity returned, one
  explicit synchronization cleared the device queue and daily-log count to zero and
  recorded exactly one synchronized daily log. This evidence covers the iPad's
  offline-draft persistence and foreground reconnect path; it does not claim full
  offline project editing.
- The first native/web visual-parity slice now carries the authoritative RailCommand
  web command-shell hierarchy into the shared native header, sign-in screen,
  dashboard, project status/KPI treatment, and Dashboard navigation label. The native
  dashboard names the remaining web project modules but marks their absent native
  workflows `ONLINE-ONLY`; it does not add dead controls or claim that RFIs,
  submittals, or full project editing are implemented. The route-by-route contract and
  remaining work are tracked in `docs/mobile/WEB_VISUAL_PARITY.md`.
- The second parity slice applies shared page headings, live status banners, KPI
  tiles, action cards, and record rows across the daily-log list/form/detail, project
  team, Sync Center, account, account deletion, invitation, recovery, and secure-link
  callback screens. The visual refactor preserves the existing data contracts and
  offline classifications: cached logs/team are read-only, new logs remain a durable
  draft/outbox workflow, Sync Center remains the foreground delivery path, and
  deletion/invitation/recovery actions remain explicitly online-only. Focused mobile
  tests, Expo lint and TypeScript, repository TypeScript, both native bundled exports,
  and the Webpack production build pass after this slice.
- The third parity slice aligns the visible native navigation with RailCommand web:
  Dashboard, Submittals, RFIs, Logs, and More. Sync Center, Project Team, and Account
  remain functional under More. Submittals and RFIs deliberately render web-aligned
  module context plus an explicit online-only release boundary; they do not display
  invented records, dead actions, or a claim that their native workflows exist.
  Deferred project modules remain non-interactive and clearly labeled online-only.
  This navigation work changes no draft, outbox, authentication, or production data
  contract.
- The measured parity slice used the user-authorized signed-in Safari session read-only
  at 390 × 844, 768 × 1024, and desktop width. It corrected the shared native shell to
  the web app's white 66-point top utility bar, compact navy project selector,
  breadcrumb/title sequence, six-card two-column KPI grid, Recent Activity/Quick
  Actions composition, and 64-point bottom navigation. A staging-only iPhone 17 Pro
  Max simulator build (`io.railcommand.app.staging`, build `500004`) rendered the
  signed-in synthetic project with the same hierarchy and no clipping or horizontal
  overflow. Unsupported Budget, Schedule, Submittal, RFI, and Punch List values remain
  shown as unavailable/web-only; Daily Logs uses the real cached count. The subsequent
  67-test mobile gate, Expo lint/typecheck, repository TypeScript, iOS/Android staging
  exports, and Webpack production compile all pass. No store upload, production
  deployment, or customer-data change occurred.

The v1 picker is verified for standard raster field photos. Thermal/radiometric file
ingestion is not claimed by this Phase 5 evidence; it requires a separately scoped
lossless-file workflow before it may be advertised as supported.

The corrected Release app is installed and the critical workflow,
cold-launch/persistence, exact-once reconnect, primary-navigation, and app-switcher
evidence pass on the physical iPhone. The Android native project compiles with the
intended release security boundary. Physical iPad portrait layout, keyboard, offline
force-close restoration, and exact-once reconnect evidence also pass. A supervised
physical VoiceOver acceptance run, physical Android acceptance, beta distribution,
full route-by-route visual parity, and refreshed post-alignment store screenshots
remain open.

The local Android inventory contains the already-used API 36 phone and tablet AVD
definitions but no installed API 24 system image. Installing that large additional
SDK image is deferred until explicitly approved; minimum-SDK compilation is proven,
but older-OS runtime acceptance remains open.

## Gate

- `npm run build` passes for the existing web application.
- `npx tsc --noEmit` and the Expo mobile typecheck pass.
- focused offline/mobile/security tests pass.
- iOS and Android bundled exports pass without server-loaded UI assets.
- physical iPhone/iPad evidence passes.
- physical Android evidence passes before public release, or remains the one
  explicit open gate while internal iOS beta work continues.
- no dead controls, lost field input, private public-cache data, debug secrets,
  logged tokens, or claims of full offline project editing.
