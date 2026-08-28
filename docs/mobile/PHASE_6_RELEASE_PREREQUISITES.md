# Phase 6 release prerequisites

This file holds production and submission work that must not block completion of the
isolated Phase 4 compliance package and must not run during Phase 5 device QA.

## Production safety boundary

No mobile branch, database migration, store build, or association-file patch may merge
into `main`, deploy to `railcommand.io`, or connect to production merely because Phase 4
is complete. Phase 5 must first produce an approved release candidate. Every production
mutation still requires action-time authorization naming the exact target and change.

## Pending production association deployment

Status: **prepared, tested, and deferred**.

- Isolated branch: `codex/mobile-association-files`
- Commit: `efa26a7`
- Baseline: production `main` commit `149c4ce`
- Vercel preview: deployment `dpl_tFi9d6b9xk5aN3W6dLC9YvzWYTKa` (`READY`)
- Local validation: focused association tests, ESLint, `npx tsc --noEmit`, and
  `npm run build` passed with Next.js 16.3.0.
- Local HTTP acceptance: both routes returned direct `200 application/json` for the
  production host, and an unknown host returned `404`.
- Current live state: both routes return `307` to login. This is expected until the
  separately authorized Phase 6 deployment.

The patch adds only:

- `/.well-known/apple-app-site-association` for Apple team `PQAGLH9L66` and bundle
  `io.railcommand.app`;
- `/.well-known/assetlinks.json` for package `io.railcommand.app` and the approved
  public Google Play App Signing SHA-256 fingerprint; and
- an exact-path middleware bypass so Apple and Google can retrieve those documents
  without a RailCommand session.

It contains no database migration, environment-variable change, Supabase mutation,
customer-data access, mobile API change, store submission, or release action.

## Offline classification

**Online-only infrastructure.** Operating systems retrieve association documents over
HTTPS. They read or write no private RailCommand data and do not alter the mobile
draft/outbox guarantees. If the files are unavailable, verified HTTPS deep links fall
back safely; offline daily-log work remains stored on the device.

## Phase 6 execution gate

After Phase 5 accepts the release candidate:

1. Rebase or recreate the minimal association patch against the then-current `main`;
   do not merge the broader mobile phase branch.
2. Repeat focused tests, TypeScript, lint, and the production build.
3. Obtain explicit authorization to merge the named minimal commit and allow the
   resulting production deployment.
4. Verify ordinary live health plus both association URLs immediately after deployment.
5. Confirm Apple association retrieval and Google Digital Asset Links verification.
6. Roll back the production deployment and revert the minimal commit if health or
   association verification fails.
7. Only then mark the production-association prerequisite complete and proceed with
   signed store artifacts and submission approvals.
