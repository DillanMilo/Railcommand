# RailCommand database source

The snapshot contains explicit existing-object ACLs; its historical row policies
and object grants are not a substitute for later hardening migrations. Apply the
reviewed migration chain in order when rebuilding an isolated database. The
legacy scripts in `docs/migrations/` are not a complete fresh-database bootstrap.

## Explicit Data API permissions (October 30, 2026)

New public tables need explicit grants; RLS policies alone do not make a table
accessible. In the same migration, enable RLS, install the ownership/admin
policies, and grant only the operations each role needs. Use `authenticated` for
signed-in clients and `service_role` only for server operations. Do not grant
`anon` access unless the data is intentionally public. Server-only tables must
have no client grants. Serial-backed inserts also need `USAGE` on the specific
sequence. Do not restore automatic grants with `ALTER DEFAULT PRIVILEGES ...
GRANT` or grant access to every table in the schema.

Validate new migrations against an isolated fixture database with automatic
grants disabled. Exercise allowed access, denied anonymous access, cross-user
RLS, server-only access, and serial-backed inserts where applicable. Existing
applied migrations do not rerun: these source edits are for future creation and
reviewed rebuilds, and are not a request to apply SQL to a live database. Preserve
any later permission revocations when replaying the migration chain.

Web/mobile impact: no routes, payloads, bundled clients, or offline queues change.
This preserves database access for compatible web and native callers on future
rebuilds. Offline classification: not applicable to SQL source maintenance;
existing drafts and outboxes are unchanged. No deployment or mobile build is needed.
