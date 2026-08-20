# Phase 1 — bundled mobile architecture spike

Status: **implemented and staging-verified; physical-device gate still open**.

This phase is developed on `codex/mobile-phase-1` in the isolated worktree
`/tmp/railcommand-mobile-phase-1`. It does not deploy to the `railcommand`
Vercel project or connect to the production Supabase project. The native bundle
ID is `io.railcommand.app.dev`.

## Architecture proved

| Boundary | Phase 1 implementation |
| --- | --- |
| Mobile shell | `apps/mobile`: Vite, React, TypeScript, Capacitor 8 |
| iOS | Swift Package Manager, iOS 15 minimum, custom and associated links |
| Android | min SDK 24, target/compile SDK 36, custom and verified links |
| Bundling | Local Vite assets copied into both native projects; no `server.url` |
| Domain | `packages/domain`: mobile contracts, drafts, idempotency, deep-link parsing |
| Offline | `packages/offline`: user-partitioned IndexedDB cache, drafts, outbox, photos, cleanup |
| API client | `packages/api-client`: HTTPS Bearer JSON endpoints; no Server Action protocol |
| Mobile API | `/api/mobile/v1/bootstrap` and `/api/mobile/v1/daily-logs/sync` |
| Session | Supabase access/refresh session persisted in Keychain/Android Keystore-backed storage |
| Staging | Synthetic-only Supabase and Vercel projects guarded against production refs/hosts |

## Offline classification

This spike is a mixed **offline read-only** and **offline draft/queue** feature.

- Project and daily-log lists are cached per authenticated user for offline
  viewing. Stale content is identified, and expired cache content is discarded.
- Daily-log input autosaves after 500 ms into the authenticated user/project
  IndexedDB database. Queueing atomically removes the draft and creates an
  outbox operation with a client UUID and idempotency key.
- Foreground reconnect synchronization retries transient failures with bounded
  backoff. The server revalidates the access token, current membership, edit
  permission, payload, and idempotency key for every delivery.
- Photos persist as private user-scoped IndexedDB blobs for this spike. Upload
  synchronization is deferred; sign-out therefore treats persisted photos as
  unsynchronized work and will not remove them without a double-confirm discard.
- Sign-out deletes only the current user's database and the local secure session.
  A cached database is never treated as an authorization boundary.

## Automated and staging evidence

- Domain, offline, API-client, mobile-sync, and API-boundary tests pass.
- A→B→A IndexedDB isolation, atomic draft→outbox, and Blob persistence are covered.
- `npx tsc --noEmit` passes.
- Next.js production build passes.
- Vite mobile bundle and `cap sync` pass.
- Android `assembleDebug` passes with JDK 21.
- iOS simulator build passes with SPM-resolved Capacitor 8.5.0.
- Synthetic staging integration proves password sign-in, refresh-session restore,
  authorized project/log bootstrap, first delivery, duplicate delivery, and cleanup.
- Unauthenticated mobile API requests return JSON `401` with `Cache-Control: no-store`.
- Supabase security advisors report no schema/RLS/function warning introduced by
  this spike. The staging project still reports the project-level leaked-password
  protection toggle as disabled.
- `npm audit --omit=dev` reports four high-severity findings inherited through
  the root Next.js 16.2.12 dependency (`next`, `nanoid`, `postcss`, and `sharp`),
  with no critical findings. The reported fix is Next.js 16.3.1. That root-app
  upgrade is deliberately deferred to a separately reviewed change rather than
  expanding the mobile spike into an unplanned framework upgrade.

Staging API: `https://railcommand-mobile-staging.vercel.app`

## Remaining gate work

- Unlock the paired iPhone, launch the installed `.dev` app, and complete the
  checklist in `PHASE_1_DEVICE_ACCEPTANCE.md`.
- Sign into Xcode with the Apple developer account and generate a development
  profile containing Associated Domains to validate the HTTPS universal link.
  The custom `railcommand://` scheme can be tested with the existing wildcard
  development profile.
- Connect one Android phone with USB debugging enabled and complete the same test.
- Create/use two synthetic staging QA accounts and perform A→B→A on both devices.

Phase 1 must not be called complete until those physical checks are recorded.
