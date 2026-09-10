# Recovery export check — 2026-09-09

Read-only local inspection confirmed all three exported files match the user's
reported byte counts and SHA-256 digests. File permissions are 0600. The artifacts
remain outside Git in the approved recovery directory.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| roles.sql | 297 | 25873cec56a2cc6514e204f420231777f85c03da818caa7090cdcdfa89776ecd |
| schema.sql | 178100 | ee2001e8ea0fc5142668a4325f8609e21e100b5d53cac6ad884c8d249c7ee138 |
| data.sql | 806901 | 68a66fec3e751b6642ff37abcc95a1d223c3d59f27f53153bbbe635194f463bf |

The data export contains 66 COPY sections, including auth and storage data.
The filtered schema lacks those tables' definitions; migration history data is
also excluded. This is not yet a self-contained verified recovery set.

Prepared a read-only supplemental export for unfiltered schema definitions and
Supabase migration history. It refuses overwrite, requires hidden interactive
password entry and FileVault, uses TLS/session pooler, and bounds lock/connect
waits. Shell syntax checked only; supplement not executed yet.

Next: obtain the supplemental exports, refresh Storage metadata inventory as
needed, restore into an isolated disposable local database, compare data counts
and security/schema definitions, and record 30-day retention. Storage object
bodies are not part of the authorized inventory-only scope.

Offline classification: online-only operational work; caches/outbox unchanged.
Production data/deployments unchanged. No claim of verified recovery or launch readiness.

## Completed isolated restore rehearsal

Supplemental files verified present with 0600 permissions:
- full-schema.sql: 487495 bytes, SHA-256 6d69014fb21cb11c828e2162f6f6601701647df94fe6024f2e64f5bf897afa64
- migration-history.sql: 66329 bytes, SHA-256 cb7d38c17e4caad979fc6a10d43c88fc1a8b9607a9b8fcf65b31bef0424d302d

Used installed public.ecr.aws/supabase/postgres:17.6.1.063, matching the captured
production engine release. Disposable container railcommand-recovery-20260909
had network=none, no published ports, and /tmp (including PGDATA) on tmpfs.
Inert baseline roles were created locally. Initial atomic schema restore rolled
back because Supabase internal event-trigger ownership requires supabase_admin
to be a superuser; this role was corrected locally only. The subsequent full
schema restore exited 0. Data (66 COPY sections), migration history (1 COPY
section), and exported role configuration each restored with exit status 0.

Compared every COPY section with corresponding restored columns, sorting text
rows and comparing SHA-256 values in memory: 67 sections, 2116 exported rows,
zero mismatches. No row contents or credential values were printed.

Container stopped after verification, clearing its RAM-backed database copy;
the protected original backup files remain intact. Production was not contacted
or modified by this rehearsal. This proves restoration of the captured export,
not point-in-time consistency across separately captured schema/data, complete
Storage object-body recovery, or readiness to enable mobile production writes.
Retention/evidence manifests and release gates still need reconciliation.
