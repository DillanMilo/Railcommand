# Main reconciliation and Next.js patch - October 5, 2026

## Resulting release source

PR #20 reconciles `main` with `origin/codex/mobile-live-backend-20260916` at
`696512f`, then retains the dependency patch `bef814f`. Before this change, `main`
was `4b4500c` while railcommand.io ran runtime commit `7ffc69f` in deployment
`dpl_93nt1tL7FW63Guh94XiBjtfXAgGh`. Vercel automatically deploys `main` and assigns
production domains, so applying the patch without this reconciliation would have
removed the released mobile backend routes.

Application source (`src`, `public`, `packages`, Next config and TypeScript config)
matches the deployed `7ffc69f` source exactly. Later release-branch commits add
documentation, the already-applied profile-search migration record, and reviewed
fresh-database grant checks. No hosted migration, old-migration replay, permission
rewrite, or live record change is part of this release.

## Dependency and platform impact

- Next.js and eslint-config-next: 16.3.0 -> 16.3.8. Required transitive dependencies
  move with them, including Sharp 0.35.3 -> 0.35.5. Other direct dependency versions
  are retained. React stays at 19.2.7. No codemod or application migration is needed.
- Web/shared online Workspace: receives the patched runtime with the existing
  mobile API, authentication bridge, pilot restrictions, daily-log conflict and
  retry handling, and workspace export/navigation behavior retained.
- Native app: no bundled source, dependency, version, signed build or store change.
  The separate Expo development branch is not integrated by this release.
- Shared API/domain/database: released route implementations and contracts are
  unchanged. The profile-search SQL is already applied; historical grant edits
  affect fresh creation only and must not be replayed on production.
- Offline classification: Workspace remains online-only; native Field tools keep
  their existing offline draft/queue behavior. Persisted payloads, operation UUIDs,
  idempotency keys, conflicts and native storage are unchanged. No device cache,
  draft or queue is purged. The released static-only service worker is retained.
- Older installed clients retain the same API and synchronization contracts.
  The mobile compatibility suite tests permissions, retry, conflict, account and
  storage boundaries with synthetic transport. No production mutation fixtures
  or physical-device acceptance were performed for this dependency patch.

## Validation

- Production webpack build and standalone TypeScript check: passed with synthetic
  public Supabase configuration; no live credentials used for the local build.
- Mobile backend compatibility/security: 308 tests passed.
- Web/shared-domain/API-client tests: 88 Mocha cases passed, plus the standalone
  RailBot and IP-reputation assertions.
- Lint: passed, zero errors and 36 warnings.
- Grant gate: 56 table definitions across 44 SQL files passed; 9 gate tests passed.
- Disposable PostgreSQL: 21 created tables in each of preview, reset and legacy
  default-grant scenarios passed. Docker was started for this test; the runner
  removed its synthetic, network-isolated container afterward.
- Web/mobile inventory: 127 actions covered. Its existing physical/functional
  parity acceptance items remain separate from this release.
- Runtime source comparison with deployed commit `7ffc69f`: no application diff.
- Before-release live checks: homepage/login HTTP 200; mobile bootstrap, sync and
  workspace-ticket issuance reject missing authentication with HTTP 401/no-store;
  invalid workspace exchange returns HTTP 403/no-store.

Remote CI, preview validation, merge commit and final production deployment
identity are recorded on PR #20. Existing middleware deprecation and lint warnings
remain; this patch does not claim full dependency-audit remediation or physical
iPhone/Android acceptance.

## Rollout and rollback

Push the reconciled candidate, require CI and preview checks, merge PR #20 into
`main`, and verify the automatic production deployment serves that exact revision
and preserves mobile authentication/no-store responses. No database or mobile
build rollout accompanies it. Production environment gates must be retained.

Rollback the runtime by reassigning the previous production deployment
`dpl_93nt1tL7FW63Guh94XiBjtfXAgGh`. In source, revert the dependency patch on the
reconciled `main`; do not restore the pre-reconciliation `4b4500c` runtime or remove
the mobile backend. Existing applied database migrations remain in place.
