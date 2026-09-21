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

Base: released backend branch `codex/mobile-live-backend-20260916`, commit
`4c87511b4098203050b71d1b0cdd83851876f40c`. The original web/offline checkout and
native worktree are untouched. Do not deploy their unrelated in-progress changes.

This migration is not applied to production. Before release, compare the current
function definition/ACL against the reviewed baseline, confirm the recovery plan,
and test the web/mobile shared search with synthetic users in an isolated staging
environment. Apply only this named migration, using project
`gwvftrrknusdfdgiwuij`, not every pending migration from the branch. Lock/statement
timeouts abort rather than wait indefinitely. Post-install verification should
read function/grant metadata; do not enumerate live profiles to prove isolation.
No frontend deployment or native build is inherently required for this backend
fix. If a regression appears, restrict the profile result to an empty list while
investigating rather than reinstating the unscoped profile query.

`npm run build` and an explicit `tsc --noEmit` passed with synthetic configuration
and outbound network blocked. The existing middleware deprecation and dependency
Edge Runtime warnings remain. The initial sparse checkout omitted shared packages;
they were included before the successful build. No application dependency versions
were changed. Staging UI and physical-device acceptance remain pending.

No Auth settings, index removals, policy consolidation, queues, stored records,
or application dependencies are changed. Remaining release gates are recorded in
the task handoff.
