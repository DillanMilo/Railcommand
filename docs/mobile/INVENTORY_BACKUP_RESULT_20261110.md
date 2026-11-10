# Production database backup and isolated Inventory rehearsal — 10 November 2026

**Database copy and faithful local recovery verified. Clean historical integrity
acceptance remains open. Nothing was merged, pushed or deployed.**

The user explicitly approved a separate temporary backup login after the original
database password could not be found. No existing password was reset. The login
had a one-hour expiry, read-all-data membership, no table write privileges and
read-only transactions. Its first permission check stopped before export because
the inherited read grant needed correction. One database export then completed.
The temporary login and its private password file were removed and live absence
was verified before local restore testing.

## Evidence

- Source: RailCommand `gwvftrrknusdfdgiwuij`, organization
  `ffzboakthmscpmrhafnv`. TLS hostname and the project CA were verified.
- Free-plan usage before capture: dashboard showed 0.168 GB of 5 GB uncached
  transfer allowance used for 2 November–2 December. Dashboard figures can lag.
- Source logical row data measured 2,187,017 bytes, below the 50 MB preflight stop
  limit. The one copying client received 3,173,374 bytes, below its 100 MB monitored
  stop threshold. Small additional manifest/control reads are not included in that
  client counter. No repeated full exports, file-bucket download, paid project,
  branch, add-on, plan change or hosted restore.
- Custom-format archive: 1,056,621 bytes;
  SHA-256 `e39bdd98804bb09405b913f393b109f6d3c145e3e64bd44de635136aa8a67836`.
  Role definitions exclude passwords. Auth/application data remains private.
- Capture used one exported read-only snapshot for the archive and row manifest.
  All 83 original tables' row counts and original-column value hashes match the
  recovered copy: public 42, auth 27, storage 10, realtime 2, migration history 1,
  vault 1. Vault has no saved secrets. Existing role memberships, functions,
  constraints, policies, column grants and effective table privileges match.
- Comparison uses the source's float display precision and UTC/public search path.
  All 462 attachment archive rows additionally match a full-precision local COPY
  comparison. The explicit-default ACL on `realtime.schema_migrations` becomes an
  implicit owner-default ACL on restore; effective access is identical. No access
  commands were stripped to force a pass.
- Local restore used a fresh Supabase-compatible PostgreSQL 17 container with no
  network or published ports, no app/Auth/mail workers, no existing volume, and
  bounded CPU/memory. Extension ownership was preserved during local bootstrap.
  Restored customer accounts were not signed in or used as synthetic test actors.

## INV-REL-04 — existing history references, open

The normal data-first restore stopped while validating
`activity_log_project_id_fkey`: **21 activity/history rows refer to absent projects**.
A read-only live aggregate confirmed the same 21 rows already exist on production,
although the existing constraint is marked validated. There were no missing actor
references in that check. No cause, age or affected customer identity is inferred.

To establish faithful recoverability without losing history, the isolated recovery
created the original schema first, then replayed archived data with restore-session
triggers disabled, as in the documented Supabase logical-restore workflow. Triggers
were reenabled before commit. All original rows and the original constraint state
were preserved. This is **faithful recovery of the existing state**, not successful
validation of historical references. Do not delete the 21 entries, fabricate parent
projects, silently assign different projects or mark clean integrity acceptance as
passed. Investigate provenance and propose a history-preserving resolution separately
before declaring the release fully cleared.

## Inventory rehearsal on the saved copy

At source commit `fc9628293f063b869dd4b4f77ff48f924be24d1f`, all seven pending
Inventory/preparation SQL files applied successfully as `postgres` in a bounded
transaction on the isolated copy. There are 24 new Inventory tables. All 83
original tables' counts/values and all original permission, policy, function,
constraint and role definitions remain equivalent afterward; feature additions
are allowed in that comparison. The 21 existing history references remain flagged.
No application commands used customer records as test fixtures.

The generated restore container was removed after results were saved. The original
persistent Phase1 backend, installed apps, original dirty checkout, main and source
feature worktree were not changed. Production still has zero Inventory tables and
zero temporary `railcommand_backup_20261110_*` logins.

## Private recovery files and limits

Retained outside Git under
`~/Library/Application Support/RailCommand/Phase1Local/private/backups/production-20261110T195407Z/`,
with directory 0700 and files 0600: `database.dump`, `roles-no-passwords.sql`,
`original-manifest.json`, checksums/status, before/after comparisons, full-precision
attachment comparison, Inventory SQL hashes and restore diagnostics. No customer
rows, passwords or plaintext data exports are committed to this repository.

This is a **database backup**, including Storage metadata and Auth records. Actual
photo/document bytes, project service configuration and encryption root keys are not
included. Do not describe it as complete project disaster-recovery coverage.
Production data repair, inherited privilege review, independent release review and
physical-client acceptance remain separate gates. Existing web/mobile/offline
behavior is unchanged; this round changed no deployed code or client queues.

Reference: [Supabase logical backup/restore and restore-session trigger handling](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
