# Project-scoped profile search

## Change and platform impact

- User-visible change: global search returns matching profiles only when they are
  members of a requested project that the caller also belongs to.
- Web: the existing search action and result shape remain unchanged.
- Mobile: the shared online web workspace inherits the same server restriction.
  No bundled native code or native Field tooling changes are needed for this SQL
  patch. A physical-device acceptance run has not been performed.
- Shared API/database: replace only `public.global_search(text, uuid[], integer)`.
  The argument names, return JSON keys, profile fields, and project-record queries
  are preserved. Anonymous execution remains denied. No rows are modified.
- Offline classification: online-only search; this patch does not add offline
  search, modify caches, purge drafts/outboxes, or alter synchronization payloads.
- Installed-client compatibility: unchanged RPC signature and response shape;
  authorized result behavior covered by synthetic database tests. No claim of
  device-level verification. Older clients receive the narrowed profile results
  on their next online query.
- Permissions: profiles must belong to the caller's authorized requested projects;
  caller-controlled project IDs cannot expand that set. Search is read-only, so
  write idempotency and conflict handling are unaffected.
- Web/mobile cross-direction mutation tests: not applicable to this read-only
  database search patch. Staging search checks in both interfaces remain pending.

## Verification

The in-memory Postgres test exercises all six result groups, unrelated profiles,
forged project IDs, multi-project membership, missing identity, non-members,
empty/null project lists, wildcard searches, membership removal, anonymous denial,
result-shape compatibility, and record preservation. All 14 subtests passed
(15 including the parent). The original function fails five isolation cases.
No real user records are used; the harness accepts no database URL or credentials.

With an isolated `@electric-sql/pglite@0.5.8` installation:

```sh
PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js node --test scripts/test-global-search-security.mjs
```

`SECURITY_MIGRATION_UNDER_TEST` can select a local baseline SQL file. Tests used
an outbound-network-blocking preload. Production database test requests: zero.

## Release and rollback

Prepared from released backend branch `codex/mobile-live-backend-20260916`, commit
`4c87511b4098203050b71d1b0cdd83851876f40c`, then integrated with release commit
`2243dda1566890cc52a17bcf1e64daa5be4b9407` before source review. The original
web/offline checkout and native worktree are untouched. Do not deploy their
unrelated in-progress changes.

Applied to production project `gwvftrrknusdfdgiwuij` on September 22, 2026 at
19:43:59 UTC. Supabase recorded migration
`20260922194359_scope_global_search_profiles`; the local filename now matches that
record. Do not apply the older draft timestamp as a second migration. Only this
named migration was applied. The live definition/ACL matched the reviewed
baseline, and a repeatable-read transaction included another definition/ACL/owner
drift guard before replacement. Lock/statement timeouts were 5/30 seconds.

Post-install verification confirmed the exact tested function body, unchanged
owner and execution grants, unchanged policies/table-security metadata, and
unchanged definitions/grants for the other public functions. Counts and full-row
checksums matched across all 46 checked tables and 2,172 records. No live profiles
were enumerated to prove isolation. The same 14 synthetic subtests (15 including
the parent) passed again after aligning the migration filename.
No frontend deployment or native build is inherently required for this backend
fix. If a regression appears, investigate and prepare a reviewed restriction of
the profile result to an empty list rather than reinstating the unscoped query.

`npm run build` and an explicit `tsc --noEmit` passed with synthetic configuration
and outbound network blocked. The existing middleware deprecation and dependency
Edge Runtime warnings remain. The initial sparse checkout omitted shared packages;
they were included before the successful build. No application dependency versions
were changed. Staging UI and physical-device acceptance remain pending.

## September 22 recovery and production checks

A private recovery export passed checksum and JSON readback validation before
the change: all 42 public application tables, Auth users/identities and Storage
bucket/object metadata (46 tables, 2,172 rows, 1,745,788 bytes). The original
function definition, owner and grants were saved separately. This is a scoped
recovery export, not a full backend/Storage-file backup or a rehearsed restore.
The native dump attempt stopped because another temporary CLI login already
existed; that login was preserved and no new database login was created.

- Health Advisors: no findings before or after.
- Security/Performance Advisor finding counts: unchanged; existing callable
  function, RLS, leaked-password and performance recommendations remain separate.
- Production homepage: HTTP 200.
- Mobile bootstrap without authentication: HTTP 401 and `no-store`.
- Anonymous empty-scope RPC: HTTP 401, PostgreSQL permission-denied code `42501`.
- Existing server-role empty-scope RPC: HTTP 200; all six expected empty arrays.
  This read-only check returned no live profiles or project records.
- An initial Management API read-only RPC probe returned HTTP 400; it was not
  counted as a successful test. The direct RPC check above verified the contract.

No Auth settings, indexes, RLS policies, offline queues/drafts, stored records,
frontend deployments, native builds or application dependencies were changed.
Hosted staging UI and physical-device acceptance were not performed; the narrow
SQL patch was verified in isolated Postgres fixtures and by live metadata/API
checks. Broader web/mobile field acceptance remains a separate tracked item.

Source integration records the already-applied migration and its regression test
on the released backend branch. It requires no second live database migration.
Keep this migration in subsequent release history; do not deploy unrelated
root/offline/native work wholesale.
