# Mobile Phase 0 evidence

Last updated: 2026-08-20

This is the redacted evidence record for the Phase 0 gate. Secret values,
credentials, passwords, signing keys, and private account identifiers are kept
out of version control.

## Isolation

- Work is on branch `codex/mobile-phase-0` in an isolated worktree created from
  committed revision `2a1958b9056db10826a1db9b06e6cf459ca688d7`.
- The primary RailCommand worktree, live Vercel project, and production Supabase
  project were not changed.
- The local mobile configuration uses `io.railcommand.app.dev`, the dedicated
  staging Supabase project, and the dedicated staging Vercel origin.
- Seven focused environment-guard tests pass, including rejection of production
  bundle ID, backend references, origins, and server-only credentials.

## Store and account evidence

- Apple membership, Account Holder access, seller details, and the Free Apps
  Agreement were verified.
- Apple production and development App IDs are registered with Associated
  Domains and Push Notifications enabled.
- Apple App Store Connect app ID `6803576049` reserves **RailCommand** and
  `io.railcommand.app`. It is public, free, and available only in the United
  States; 174 other regions are unavailable. Mac and Vision Pro availability is
  disabled for mobile v1.
- Google Play organization identity and production access are verified. The
  personal-account 12-testers/14-days rule does not apply. **RailCommand** and
  `io.railcommand.app` are reserved by Play app ID `4974656059116836796`.
- The Account Owner approved the Developer Program Policies and applicable US
  export-law declarations. The app is free, and the production track targets
  only the United States.
- Google Play reports that releases are signed by Play. The Account Owner is
  responsible for the future upload key and release pipeline.

## Staging evidence

- A dedicated staging Supabase project exists in a separate organization with
  automatic RLS enabled and automatic new-table Data API exposure disabled.
- Its private fixture manifest has RLS enabled and grants neither anonymous nor
  authenticated users direct select access.
- A synthetic `.test` QA identity and synthetic organization/project manifest
  exist. No production data or real customer identity was copied. The generated
  QA password was not retained and must be reset before physical-device testing.
- A dedicated Vercel project has Production, Preview, and Development staging
  environment values. Its protected staging deployment returns the RailCommand
  app and reaches the staging Supabase endpoint; an anonymous 401 is expected.
- A dedicated no-cost Firebase project contains only the development Android app
  `io.railcommand.app.dev`. No production Firebase app or credential was created.

## Verification

- `npm run test:mobile-env`: pass (7 tests)
- `npx tsc --noEmit`: pass
- `npm run build`: pass with staging configuration
- Android Studio 2026.1, Android Platform 36 revision 2, Android Build Tools
  36.0.0, and Platform Tools 37.0.1 are installed. The Account Owner explicitly
  accepted the Android SDK License Agreement on 2026-08-20.

## Approval and gate result

- The accountable business owner approved the 30-day account-deletion and
  organizational-record-retention policy on 2026-08-20.
- Apple and Google identifiers are reserved and both store records are limited
  to the United States.
- Account access, staging isolation, safety guards, toolchain baseline, v1 scope,
  distribution, commerce, deletion, and retention decisions are complete.

Phase 0 is complete as of 2026-08-20. This is a readiness gate, not authorization
to connect a development build to production or submit either app for review.
