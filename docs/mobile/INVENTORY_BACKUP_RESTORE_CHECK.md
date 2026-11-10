# Inventory Beta — no-cost backup and restore check

Prepared 10 November 2026. **Production capture and production-data restore have
not run.** The synthetic local rehearsal passes; it does not replace this gate.
No paid branch, plan upgrade, password reset, temporary hosted role, linked-project
reset, merge or deployment is needed or authorized.

## Source and destination

- Read source: RailCommand `gwvftrrknusdfdgiwuij`, organization Railcommand
  `ffzboakthmscpmrhafnv`. Direct host: `db.gwvftrrknusdfdgiwuij.supabase.co`.
- Write destination: a **new, disposable, isolated local database only**. No
  existing Phase1 volume, runtime, app cache or local user database may be reused.
- Keep archives outside Git in
  `~/Library/Application Support/RailCommand/Phase1Local/private/backups/`.
  Create a new dated subfolder with mode 0700 and files with mode 0600. These
  contain private database data, including Auth records; do not share or commit.

## Capture prerequisites

Use the existing database password, entered privately at the terminal prompt.
The connector OAuth grant is not a PostgreSQL password. **Do not reset an existing
password to complete this check.** No password, database URL containing a password,
API secret or recovery code belongs in chat, shell history, logs or repository files.
Obtain the project's public database CA certificate from its connection settings.
Use TLS `verify-full`; do not disable certificate verification.

The installed PostgreSQL 17 Docker client can read the source without installing
another server or creating a hosted login role. Use a direct connection; if IPv6
is unavailable, use the **session** pooler connection shown by this exact project's
Connect panel, with user `postgres.gwvftrrknusdfdgiwuij`. Do not buy an IPv4 add-on
or use the transaction pooler for this workflow.

## Production capture checklist — still pending

1. Verify the project reference and private output directory. Record the live
   deployment SHA and current migration history. Review active workloads before
   taking a short read-only snapshot.
2. In an authenticated `psql` source session, start
   `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, set bounded statement/lock
   timeouts and call `pg_export_snapshot()`. Keep that session open only while
   capturing the archive and baseline; then `ROLLBACK`. Do not run application
   RPCs, DDL, data changes or privilege changes.
3. With the PostgreSQL 17 client, use `pg_dump --format=custom --snapshot=SNAPSHOT_ID`
   against the pinned source, saving directly into the private folder. Set
   `PGOPTIONS=-c default_transaction_read_only=on -c lock_timeout=5000` and TLS
   `verify-full`. Use a private password prompt, never a password command argument.
   Include the database schema/data, Auth and Storage metadata, extension
   declarations, ACLs, policies, constraints and `supabase_migrations` history;
   do not use an export that silently excludes managed schemas or history.
4. In the original snapshot session capture per-table original-column row hashes
   and counts (sorted canonical row JSON), plus schema/column ACLs, policies,
   constraints, function definitions and sequence values. This must use the same
   exported snapshot so normal field writes cannot create false differences.
5. Separately capture role definitions without passwords, using
   `pg_dumpall --roles-only --no-role-passwords`, and record extensions/owners.
   Role metadata is not a replacement for user/Auth data in the archive.
6. Check every process exit code, list the archive with `pg_restore --list`, and
   record file sizes and SHA-256 checksums in a manifest. Retain partial files as
   visibly incomplete; never label a failed or empty archive as a successful backup.

## Isolated local restore checklist — still pending

1. Use a fresh local Supabase-compatible PostgreSQL 17 container with a random
   `railcommand-restore-check-...` name, no published ports, no network, no existing
   volume and no app/Auth/Storage worker processes. A disposable database needs
   compatible Supabase extensions and managed roles; plain PostgreSQL alone is
   insufficient evidence for a full Supabase restore.
2. Review role/extension bootstrap against the archive. Restore into an empty
   database with `pg_restore --single-transaction --exit-on-error`. Never use
   `--clean` against a source or existing local database. Never skip restore errors
   or strip ACLs/owners just to get a green result. Managed-role conflicts or
   unavailable extensions stop the check for review.
3. Compare restored original values/IDs, sorted row hashes, counts, role and column
   privileges, policies, function bodies, constraints, sequence state and migration
   history with the snapshot manifest. Check foreign keys, duplicates and approved
   collaborator access using synthetic identities only. Restored customer accounts
   must not be signed in or connected to a live mail, push or webhook service.
4. Only inside this disposable restore, rehearse the pending Inventory SQL in
   reviewed order. Recompare every original column/row and legacy ACL/policy;
   Inventory may add its own data/objects but must not rewrite existing records or
   revoke existing project access. Record failures and duration before any release.
5. Remove only the generated disposable container after recording results. Retain
   the private source archive and manifest. This is a rehearsal, not a production
   rollback: never overwrite newer live field work with an older snapshot.

## Scope limits

A PostgreSQL dump contains Storage **metadata**, not the stored photos/documents
themselves. Preserve the live buckets and separately inventory/export their bytes
before claiming a complete project disaster-recovery backup. Vault/column-encryption
keys and project configuration are not contained in a logical dump; investigate
their use before claiming those objects are recoverable. Do not retrieve or rotate
encryption root keys as part of this preparation. Keep restored services offline.

## Tested now

Run `node scripts/test-inventory-backup-restore.mjs`. It accepts no remote URL or
existing restore target, uses a network-isolated disposable PostgreSQL container,
and verifies archive/restore of synthetic UUIDs, fractional stock, JSON evidence,
cross-organization/null-organization memberships, ACL/RLS, function definitions,
constraints and migration history, including denied reads/writes and unchanged
source values. It is a transport rehearsal, **not production backup acceptance**.

References: [Supabase backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html),
[PostgreSQL pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
