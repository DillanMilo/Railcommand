# Phase 2 — reusable mobile and device foundation

Status: **implemented; physical iPhone acceptance passed; physical Android
acceptance remains conditional on hardware availability**.

Work is isolated on `codex/mobile-phase-2` in a separate worktree. The mobile photo
endpoints were deployed only to the isolated mobile staging alias for physical-device
acceptance. No production deployment, production database change, or production mobile
build is part of this phase. Development and staging profiles are hard-locked to the
synthetic staging backend;
a production build fails closed without an explicit release authorization and an
exact production inventory match.

## Offline classification

Phase 2 is a combination of **offline-capable** and **offline draft/queue** behavior.

- The bundled shell, navigation, locally stored session, and previously synchronized
  project/log views do not depend on a remote `server.url`, private Cache Storage, or
  the web service worker.
- Daily-log field input, optional location, and photos persist through the existing
  authenticated-user/project IndexedDB draft and outbox contracts.
- Returning to the foreground always rechecks connectivity. When online, the
  foreground synchronizer retries the idempotent outbox; when offline, it keeps the
  draft and queue intact and continues from cached data.
- Camera, photo-library, location, share, and haptic denial/unavailability never
  erase input. Location is requested only after the user selects **Attach location**.
- The server remains the authorization boundary and revalidates the access token,
  membership, permission, payload, parent operation, and idempotency key on delivery.

## Foundation delivered

| Area | Phase 2 implementation |
| --- | --- |
| Shell | Mobile section navigation, safe-area insets, status bar, splash dismissal, keyboard resize/state, phone side/bottom navigation, and two-column tablet layout |
| Session | Keychain/Keystore-backed Supabase storage partitioned by development/staging/production, restore, and active/inactive refresh lifecycle |
| Links | `railcommand://` callbacks, `https://railcommand.io` Universal/App Link declarations, cold/warm callback handling, and PKCE/session callback validation |
| Synchronization | Native connectivity adapter plus guaranteed startup, reconnect, and every-foreground outbox attempt |
| Device adapters | Camera, photo library, current location, share sheet, and best-effort haptics with denial/unavailable fallbacks |
| Branding | Bundled RailCommand fonts, icon, iOS/Android launcher inventory, splash inventory, environment name, semantic version, and monotonically increasing build number |
| Environments | `io.railcommand.app.dev`, `io.railcommand.app.staging`, and `io.railcommand.app`; staging-only development defaults and a fail-closed production release gate |
| Error reporting | Privacy inventory completed; external crash upload deliberately not selected yet; safe local development reporting only |
| CI | Node 22 checks plus secret-free mobile tests, asset validation, Android debug build, and unsigned iOS Simulator build |

## Version and environment rules

- Marketing version comes from `MOBILE_APP_VERSION` and defaults to the mobile
  workspace package version (`0.2.0`).
- Build number comes from `MOBILE_BUILD_NUMBER`, must be a positive integer, and is
  supplied to native release jobs. The current baseline is `200002`.
- Development, staging, and production each use distinct application identifiers and
  secure-storage prefixes, preventing one installed flavor from restoring another
  flavor's session.
- Client bundles may contain only the Supabase publishable/anon key. Service-role,
  database, APNs, App Store Connect, and other server credentials are rejected.

## Link-domain activation

Native declarations are in place, but the HTTPS link domain is not active until the
reviewed association files in [`linking/README.md`](./linking/README.md) are published
over HTTPS and the Apple/Android signing identifiers are confirmed. The custom
`railcommand://` callback remains available for development validation.

## Acceptance gate

The Phase 2 gate is evaluated as follows:

1. All unit/security/environment/asset tests and the root build/type check pass.
2. Android `assembleDebug` succeeds without signing secrets.
3. An iOS Simulator build succeeds with code signing disabled.
4. On a physical iPhone and Android phone, verify safe areas, keyboard behavior,
   camera/library/location permission denial and approval, share fallback, cold/warm
   links, session restoration, offline restart, foreground reconnect, photo persistence,
   and A → B → A user isolation.

Items 1–3 pass. Physical iPhone acceptance passes and is recorded in
[`PHASE_2_DEVICE_ACCEPTANCE.md`](./PHASE_2_DEVICE_ACCEPTANCE.md). Android compilation
passes, but physical Android acceptance remains explicitly conditional until hardware
is available. HTTPS Universal/App Links also remain inactive until the association
files are published; the custom callback is proven.

## Automated evidence

- Domain, user-partitioned offline storage, API client, mobile foundation, sync, and
  mobile API security tests pass (42 tests total).
- All 10 environment-isolation and production fail-closed tests pass.
- Mobile icon/splash inventory validation, `npx tsc --noEmit`, ESLint, and the root
  Next.js production build pass.
- The bundled Vite application builds and synchronizes into both native projects with
  no `server.url`.
- Android SDK 36/JDK 21 `testDebugUnitTest assembleDebug` succeeds for build `200002`.
- Xcode 26.6 resolves all Swift packages and produces an unsigned iOS Simulator app
  with code signing disabled.
- Browser checks at 390 × 844 and 1024 × 1366 show content, 16px inputs, no horizontal
  overflow, no error overlay, and no console errors.
- `npm audit --omit=dev --audit-level=critical` reports no critical vulnerabilities.
  Four high-severity findings remain inherited through the root Next.js dependency;
  the recommended fix is a separately reviewed Next.js 16.3.2 upgrade, not an automatic
  mobile-foundation change.
- The staging Supabase security advisor reports no schema/RLS/storage-policy errors.
  Its one project-level warning is that leaked-password protection is disabled; enable
  that protection before broader external testing.
