# Explicit table grants — September 29, 2026

## Outcome and scope

Supabase stops automatically granting API access to new `public` tables in
existing projects on **October 30, 2026**. Existing objects retain their grants.
The September 23 email explicitly includes migration replay, preview branches,
and local resets. [Supabase announcement](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically).

This patch is based on backend release branch `codex/mobile-live-backend-20260916`
at `337c428`. It is a source/provisioning correction, not a production database
migration. No deployed grants, rows, RLS policies, RPCs, or default privileges
have been changed. Production changes still require separate approval.

- EarthCam embeds now grant authenticated CRUD and service-role CRUD in their
  table-creation migration, with the original project-scoped RLS intact.
- Legacy table-creation scripts for invitations, safety, change orders,
  modifications, weekly reports, documents, QC/QA, demos and EarthCam receive
  explicit grants for their intended roles and operations. Demo credentials are
  service-role-only on fresh creation; no anonymous grant is added anywhere.
- Notifications, email events, UP reporting, and the current mobile bridge
  already declare grants. Their restricted column/RPC contracts are unchanged.
- The historical schema snapshot retains every existing object grant. Its six
  automatic future-table/sequence grants to API roles are removed so restoring
  it cannot silently reintroduce that old dependency. Function defaults remain
  outside this table-grant change.
- CI checks table creation, explicit grants and RLS together, rejects broad
  automatic table/sequence grants, and runs real PostgreSQL role tests.

## Migration and environment rules

Declare the minimum required privileges in the **same file** as `CREATE TABLE`,
RLS enablement and policies. `authenticated` is a role, not project authorization;
retain membership/ownership policies. Server-only tables grant to `service_role`.
Do not copy the email's anonymous SELECT example onto private RailCommand data.
Do not solve a missing grant with `SECURITY DEFINER` or a grant on all tables.

These are edits to historical creation sources because the defect concerns
**fresh creation/replay**. Already-applied versions will not rerun. Do not repair
migration history, replay old migrations on production, or run the archived docs
SQL against production to adopt this patch. Existing deployments need no grant
backfill solely because of the October 30 announcement. If a specific environment
already has a missing privilege, inspect it and propose a narrowly scoped forward
migration separately; production execution needs approval.

For a preview/new database, use the reviewed release branch and baseline, then
apply its migrations with automatic API table grants disabled. Test as an actual
authenticated project member, a nonmember, and anonymous caller, not just the
owner or service role. For a local reset, use a disposable database and verify
the same access after replay. Never reset a linked hosted database or device
storage as part of this work.

`supabase/schema_snapshot.sql` is a historical snapshot, **not a complete current
bootstrap baseline**. It preserves historical ACLs (including older anonymous
ACLs) and needs the corresponding security migrations and Supabase managed
schemas. Do not use it alone as a deployment recipe.

## Verification commands and boundaries

```sh
npm run check:db-grants
npm run test:db-grants
node scripts/verify-web-mobile-parity.mjs
node --import tsx node_modules/mocha/bin/mocha.js 'src/lib/mobile-api/*.test.ts'
npm run build
npx tsc --noEmit
```

The SQL convention gate scans `supabase/migrations`, `docs/migrations`, and the
snapshot. It understands schema-qualified literal CREATE/GRANT/REVOKE SQL,
including quoted simple identifiers and column grants. Comments, string literals
and function bodies cannot satisfy a missing grant. Dynamic table-creation SQL
requires a dedicated test/review; this is not a general SQL parser or a guarantee
that every chosen privilege matches product intent.

The integration runner accepts only a local Docker daemon, starts its own
`postgres:17` container without network or published ports, uses tmpfs and only
synthetic records, and removes its container in `finally`. It never loads `.env`
or connects to Supabase. Three independent databases exercise strict creation,
strict recreation, and old automatic-grant compatibility. Actual repository SQL
creates the affected tables. Minimal auth/storage/base-table fixtures supply
pre-existing dependencies; the real membership helper is loaded from the snapshot.
This is **not** a full Supabase CLI reset, hosted branch, or PostgREST end-to-end
acceptance run.

Assertions cover every tested table's RLS/service access, anonymous denial on
strict fresh creation, authenticated CRUD where intended, cross-project denial,
membership revocation, notification column restrictions, service-only tables,
mobile device ownership, account-deletion RPC-only writes, repeatable EarthCam
DDL, existing-row/grant preservation, and snapshot future-table/sequence defaults.

## Web/mobile and offline impact record

- User-visible behavior: newly provisioned databases retain intended API access
  after automatic grants disappear; no UI change.
- Web: same API queries and original RLS; build and backend regression coverage.
- Native mobile: uses the same backend/database. No bundled UI/domain/client
  change and no mobile binary required. Existing routes and payloads retained.
- Shared API/domain/database: only creation-time explicit ACLs and snapshot future
  defaults. No columns, schemas, policies or function signatures changed.
- Offline classification: **online-only operational/database setup**. Existing
  offline read-only data and draft/queue features retain their classifications.
  No IndexedDB/native-storage migrations, cache changes, sign-out changes, blob
  handling, UUID/idempotency changes or queue deletions. Auth/membership/RLS still
  revalidate at synchronization; saved payloads remain compatible.
- Installed clients: unchanged routes and contracts; backend tests include log
  synchronization, idempotency/conflict and authentication cases. No claim of new
  physical-device acceptance or delivery of previously pending field logs.
- Web-to-mobile/mobile-to-web: same tables and unchanged APIs; automated permission
  and backend tests only. Live cross-device writes were not authorized or run.
- Rollout/rollback: merge the source patch into the release/provisioning branch;
  carry it with any future branch consolidation. No deployment or SQL execution
  is required on existing production for this patch. Source rollback is a Git
  revert, which restores the missing-grant risk for future creation.

## Tracked limitations and follow-ups

- **GRANTS-01 — complete reset baseline (open, release engineering):** this release
  branch has no `supabase/config.toml` or full initial schema migration. Its first
  migration already depends on existing `projects`/`profiles`/`project_members`.
  Consolidate the historical schema, migration history and required managed schema
  setup into a reviewed reproducible baseline, then run an actual local Supabase
  reset and hosted preview smoke test before claiming full provisioning acceptance.
  The isolated role test covers this patch's grant behavior, not that older gap.
- **GRANTS-02 — release branch integration (open until merged):** keep this patch
  based on the mobile-compatible backend. Root offline and native-development
  checkouts are separate in-progress branches; do not deploy them wholesale or
  use their older creation SQL as a reset recipe. Carry this patch during the
  already-required branch consolidation; no native source adaptation is needed.
- **GRANTS-03 — staging/API/device acceptance (pending):** before the next new-table
  feature release, provision the reviewed staging baseline with strict defaults,
  exercise member/nonmember API calls and offline reconnect from supported clients.
  No existing production-grant rewrite is authorized by this implementation.

## Results

Verified locally on September 29, 2026:

- Grant gate: **56 table definitions / 44 SQL files**, passed.
- Gate regression tests: **9 passed**, including missing/comment-only grants.
- Real PostgreSQL 17: **21 created tables in each of three scenarios**, passed.
- Mobile backend compatibility/security tests: **308 passed**.
- Web/mobile action inventory: **127 covered**, with the existing 127 functional
  parity acceptance items still pending (inventory is not device acceptance).
- `npm run build`: passed. Existing middleware deprecation and Edge Runtime
  dependency warnings remain; no build errors.
- `npx tsc --noEmit`, targeted script ESLint and `git diff --check`: passed.
- Full `npm run lint`: passed with 36 existing warnings and zero errors.
- No hosted SQL, full Supabase reset, hosted preview or physical-device run.
  See GRANTS-01 through GRANTS-03 above; those are not claimed as passed.
- No production/staging changes, deployment, mobile build or fixture writes.
