# Phase 5 — visual alignment, device acceptance, and beta distribution

Last updated: 2026-08-28

## Goal

Prove the native field app on representative real devices, preserve the accepted
offline/security behavior, and distribute controlled betas. Phase 5 begins with
a focused RailCommand visual-alignment pass so device and accessibility testing
validate the intended interface rather than a disposable scaffold.

This is deliberately a lean release matrix. It does not require owning every
screen size or testing every possible OS/device combination.

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

The visual pass covers sign-in, dashboard/project selection, daily logs, Sync
Center, Account/privacy, invitations, password recovery, and supporting cached
record screens. Material visual changes require replacement store screenshots
before submission.

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
| iPad | Required while tablet support remains enabled | Adaptive layout, keyboard obstruction, rotation, large text, offline draft/reconnect smoke test |
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
- The full focused mobile suite passes: 62 domain, offline, API-client, Expo,
  authenticated mobile-API, and link-association checks.
- The existing Next.js production build and repository TypeScript check pass.
- iOS and Android Expo exports pass and contain the bundled RailCommand mark,
  six cross-platform TTF font assets, and native tab symbols.
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

The v1 picker is verified for standard raster field photos. Thermal/radiometric file
ingestion is not claimed by this Phase 5 evidence; it requires a separately scoped
lossless-file workflow before it may be advertised as supported.

The corrected Release app is installed and cold-launch/persistence evidence passes on
the physical iPhone, but the hands-on workflow/VoiceOver/app-switcher checks remain
open. Physical iPad and Android acceptance, beta distribution, and refreshed
post-alignment store screenshots also remain open.

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
