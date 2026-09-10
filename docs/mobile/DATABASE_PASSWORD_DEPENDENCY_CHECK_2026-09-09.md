# Database password dependency check — 2026-09-09

Scope: read-only inspection; no password reset, production data changes, or deploy.
Offline classification: online-only operational work; device drafts/outbox unchanged.

## Evidence

- Main workspace Vercel link identifies production project
  `prj_AKXr0Bz4LLmh3mWBwwbp1nQRvKfw`.
- `vercel env ls production` succeeded for `railcommand`. Values stayed encrypted.
  The listing includes Supabase URL, anon key, and service-role key, but no
  DATABASE_URL, POSTGRES_URL, PGPASSWORD, or SUPABASE_DB_PASSWORD.
- Local `src/lib/supabase/client.ts` and `server.ts` use URL/anon-key API clients;
  `admin.ts` uses URL/service-role-key API client.
- Search of main workspace src/scripts/.github/package.json found no direct
  PostgreSQL URL or database-password variable references.
- In the recovered mobile worktree, those references appeared only in the
  backup script and recovery-evidence tests.

## Conclusion and limits

No database-password dependency was found in the inspected web app or current
production Vercel variable names. This does not prove that outside integrations,
database clients, CI secrets, or older deployed code have no direct connections.
No production password reset is authorized by this inspection. A separately
approved reset must retain the new secret privately and update any identified
direct database consumers. API keys are separate credentials; do not rotate them.

The logical backup and disposable restore rehearsal remain incomplete. This
inspection is not evidence that production is ready for mobile writes or release.
