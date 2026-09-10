# Production backup access plan

Status: paused after unexpected CLI login initialization, 2026-09-08.

## September 8 access incident / handoff

The user authorized temporary **read-only** production backup access, without
resetting the existing password or changing user data. CLI authentication succeeded.
Official CLI 2.84.2 source inspection found `initLoginRole` requests
`ReadOnly: false`. Do not use automatic linked CLI database authentication.

A subsequent `supabase db query --linked` invocation, believed to use the
Management API directly, nevertheless printed `Initialising login role...`.
Its SQL was a `BEGIN READ ONLY` role-metadata SELECT followed by `ROLLBACK`.
The result reported `cli_login_postgres` with validity ending
2026-09-08 20:42:22.907322 UTC. No customer-row mutation or export was run.
This command may have created/refreshed write-capable temporary login access
outside the intended authorization. Work stopped; no cleanup, permission change,
or delete-all-login-roles endpoint was invoked.

Next: explain this access change to the user; verify expiry through an explicitly
read-only Management API request that does not initialize CLI login access.
Do not assume the role is deleted at expiry or that an existing session is ended.
Any scoped early revocation needs explicit authorization and an exact target.
The requested backup and restore rehearsal remain incomplete.

### Direct API follow-up

A direct Management API `database/query` request with `read_only: true`
verified that `cli_login_postgres` was expired and had zero active sessions.
No revocation was performed. The API credential was decoded in memory according
to the CLI's official go-keyring format; no credential was printed or saved.

The explicitly authorized `cli/login-role` request with `read_only: true`
created `cli_login_supabase_read_only_user`, TTL 300 seconds. A direct metadata
query confirmed its sole reported membership was `supabase_read_only_user`.
Two bounded session-pooler connection checks failed with password authentication
failure, including one after a five-second propagation wait. The configured
pooler hostname, port, and project suffix matched the linked project metadata.
No export ran and no customer rows were modified. Do not loop login creation or
escalate role privileges. Next investigate the supported read-only-role connection
method, then verify role expiry and complete export/restore coverage.

Further read-only diagnostics confirmed the direct database hostname resolves only
to IPv6 on this network and TCP port 5432 returns `EHOSTUNREACH` without credentials.
Both temporary login roles had zero active sessions. The read-only role uses
`NOINHERIT`; its direct SELECT grants are absent, so any later coverage check must
evaluate its approved `supabase_read_only_user` role via SET ROLE, not mistake
NOINHERIT for missing parent-role coverage. No privileges were changed.
The remaining immediate blocker is a supported authenticated export connection:
the pooler rejected the temporary credentials and the direct endpoint is unreachable.

Final pre-pause check: broader `cli_login_postgres` was expired; the five-minute
read-only login had not yet expired. Both had zero active sessions. No credentials
were retained by the diagnostic processes. Automatic expiry of the latter still
needs confirmation on resume. Goal blocked on authenticated export connectivity;
do not claim that a backup or restore rehearsal has completed.

Target: `gwvftrrknusdfdgiwuij` only. Existing authorization covers logical
export, encrypted local retention for 30 days, Storage inventory, and a disposable
local restore. It does not authorize changing production access.

## Proposed method

Use Supabase's documented Management API endpoint
`POST /v1/projects/{ref}/cli/login-role` with `read_only: true`.
The endpoint returns a role, a temporary password, and `ttl_seconds`.
It requires `database:write` OAuth scope (or `database_write` token permission)
because creating login access is a production security change even when the
resulting connection is read-only. Do not reset the existing postgres password.

Before calling it, verify existing CLI role inventory and obtain explicit approval
for this access change. Authenticate through a supported Supabase management login;
do not extract browser session tokens or reuse unrelated connector credentials.
Keep returned credentials out of chat, command arguments, Git, and logs.

Verify effective privileges before exporting. Do not assume the read-only role can
export every required Auth table, role definition, or RLS-protected record. If any
required content is inaccessible, stop and report the missing coverage; do not
silently elevate privileges or call an incomplete export a verified backup.

Use encrypted transport and read-only transactions with bounded lock waits. Save
exports directly into the approved protected recovery directory without replacing
previous artifacts. Record actual capture time and disposal date 30 days later.
Preserve migration history and custom Auth/Storage schema changes in addition to
the standard roles/schema/data export. Storage object bodies remain excluded.

Restore only locally in a disposable, network-isolated database. Verify completeness
using counts and schema/security metadata without logging customer content. Record
hashes and sanitized evidence. End backup sessions and verify credential expiry.
Do not use the endpoint that deletes all CLI login roles: it could affect unrelated
sessions. Report any remaining role and obtain a scoped cleanup decision if needed.

## Impact and boundaries

The proposed hosted change is separate temporary database login access. No customer
records, existing application passwords, RLS policies, deployments, or application
configuration are to change. Backup reads consume some database resources and egress.
Neither availability nor complete export coverage is established until tested.

Offline classification: online-only operational work. Device caches, drafts, and
queues are unaffected.

## Source

https://supabase.com/docs/reference/api/v1-create-login-role

https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
