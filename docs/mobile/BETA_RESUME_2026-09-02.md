# Bounded beta resume — 2026-09-02

## Current source and safety boundary

- Local branch: `codex/mobile-beta-readiness-20260902`.
- Worktree: `/private/tmp/railcommand-mobile-recovered-20260901`.
- Base: `7758aeb4d3bcd1e2026e9ea0a68e2e4f923b60ee`, with the verified recovered
  mobile source and September 2 egress hardening. This is not `main` or the
  unrelated dirty Desktop checkout.
- No deployment, hostname change, store upload, production connection, schema
  change, password reset, or account/data mutation occurred in this pass.

## Completed this pass

1. Revalidated the recovery handoff against the actual files. The September 1
   signed-in runner ended because its password prompt expired; it never signed
   in or created test data. Do not treat the old Terminal session as running.
2. Re-ran the existing exact-Preview preflight: HTTPS, JSON, no-store, and
   unauthenticated mobile bootstrap rejection pass. This is not signed-in API
   acceptance and does not prove the mobile device can bypass Vercel protection.
3. Created a separate local beta-readiness branch without changing `main`, the
   original mobile branch, or any remote ref.
4. Closed a runtime safeguard gap: even if public environment variables say
   `production`, debug builds, simulators/emulators, and builds without a matching
   native production profile now fail before creating service clients. Staging
   beta and explicit physical-device release configurations remain supported.
   This uses the existing `expo-device` dependency; no dependency was added.

## Verification of current local source

- `npm run test:mobile`: **506 passing** (27 domain, 5 offline, 13 API client,
  210 Expo, 247 mobile API, 4 association tests).
- `npm run test:mobile-env`: **13 passing**.
- Beta profile + Preview verifier tests: **23 passing**.
- Mobile workspace TypeScript and repository `npx tsc --noEmit`: **pass**.
- Targeted ESLint for the runtime guard/wiring/tests: **pass**.
- `npm run build -- --webpack`: **pass**, existing middleware-deprecation warning.
- `npm run export --workspace @railcommand/mobile`: iOS and Android **pass**.
  These are local compilation exports, not signed/installable beta acceptance.
- `git diff --check`: **pass**.
- Changed/untracked candidate-file scan: no private-key block, long secret-key
  value, or private credential filename detected. Ignored environment/signing
  material is not a source/checkpoint input.

## Next bounded sequence

1. Obtain explicit permission to deploy this source to one new Preview in
   `railcommand-mobile-staging`. Preserve all current host assignments and
   production. Do not deploy the unrelated Desktop checkout.
2. Verify the new Preview, then run the existing bounded reviewer workflow once
   with a privately entered staging reviewer password. It retains at most one
   synthetic daily log, photo, RFI, and Submittal; never reset credentials or
   delete prior records. Keep exact target validation in place when updating the
   dated runner. Test the new code, not only the older Preview.
3. Establish separately approved, device-reachable staging hosting. A protected
   unique Preview and Vercel-authenticated browser/CLI are not proof of native
   access. Never embed a Vercel bypass secret in the mobile app.
4. Separately authorize one store-signed staging beta build and internal upload,
   inspect automatic distribution first, then run one updated iPhone/iPad
   regression. No repeated reviewer video or device fleet is required.

## Still not launch acceptance

- Staging safeguard acceptance was not recovered with the deployed snapshot.
  Do not rerun previously applied SQL or assert it passed. Reconcile that evidence
  before any production-connected beta, using the dated backend-readiness gaps.
- Production compatibility, scoped safeguards, necessary additive mobile
  contracts, rollout/rollback, and exact production authorization remain separate.
  A staging beta does not allow customers to use production accounts/data.
- Physical Android and supervised accessibility acceptance remain tracked
  release gates; the earlier hardware exception is not real-device evidence.
- No TestFlight/Play beta upload or current-device acceptance is proven here.

## Offline classification

Runtime environment checks are **online-only configuration safety** and fail
before network access. They do not open, clear, migrate, or repoint local storage.
Daily logs/photos remain **offline draft/queue**, cached record text remains
**offline read-only**, and account/link/attachment operations remain **online-only**.
Pending staging work must never be silently redirected to production.

Related evidence: [egress audit](./MOBILE_EGRESS_AUDIT_2026-09-02.md),
[backend readiness](./BACKEND_READINESS_2026-08-30.md), and
[Phase 5 device/beta gate](./PHASE_5_DEVICE_BETA.md).
