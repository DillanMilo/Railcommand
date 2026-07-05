# RailCommand — Audit & Hardening Handoff

**Date:** July 5, 2026
**Branch:** `beta_4` (pushed; NOT yet merged to `main`)
**Scope:** Full architecture / security / product / data-integrity audit + hardening pass, verified against the live Supabase database.

---

## 1. State of the system (verified against live DB)

**Healthy — confirmed, not assumed:**
- All migrations applied; RLS enabled on every public table; chat tables correctly owner-scoped
- All 5 criticals from the June 15 security audit are fixed and verified in code
- Multi-tenant isolation is project-scoped RLS and sound; no cross-tenant path found for regular or demo users
- Atomic entity numbering now covers all 9 numbered tables (SUB/RFI/PL/DOC/QC/SAF/CO/MOD/WR) with `unique (project_id, number)` backstops — applied to prod 2026-07-05
- `organizations.is_demo` flag live; demo wipe (reset/delete) now refuses to touch any org not flagged — only "A5 Rail — Team Demo" is flagged
- Full prod schema snapshot in repo: `supabase/schema_snapshot.sql`
- Local backups (schema + data + auth users) in gitignored `backups/` — taken 2026-07-05

**Fixed on `beta_4` — goes live when you deploy:**
- Overdue-reminders cron (was silently dead: wrong column names + nonexistent statuses, errors discarded, reported success daily). Both crons now return 500 on query failure
- Truthful overdue counts: dashboard + RFI list (incl. Overdue tab) compute from `due_date` at read time
- Failed fetches show an error + Retry on all 9 module list pages instead of looking like an empty project; Daily Logs list got its missing empty state
- Query limits: module lists capped at 500 rows, dashboard at 1,000
- Stale `FULL_MIGRATION_ALL.sql` deleted (would have re-exposed demo passwords if re-run)

**Deliberate business decisions (do not "fix"):**
- Demo users CAN send real invitation emails — trial users invite their team members (suppression was implemented and reverted 2026-07-05 at Dillan's direction)
- Supabase stays on Free plan during pilot — mitigated by local dumps before schema changes

---

## 2. Immediate actions (this week)

| # | Action | Who | Why |
|---|--------|-----|-----|
| 1 | **Merge/deploy `beta_4`** | Dillan | The cron fix, truthful overdue, and error states are not live until deployed. Prod is still running the broken cron today. |
| 2 | **Rotate API keys** (Supabase service-role, OpenAI, Resend) → update in Vercel | Dillan | Outstanding since the June audit. |
| 3 | **Look at the demo data question** | Dillan | The demo project ("Englewood Yard Expansion") had zero submittals/RFIs/logs/punch when checked. If trial users expect showcase data, it needs a re-seed — but a reset wipes anything they've added and is therefore ON HOLD pending your call. |

## 3. Near-term (before or at real launch)

1. **Upgrade Supabase to Pro** — automatic daily backups + image transforms. Until then, take a dump before schema changes: `supabase db dump --linked --data-only -f backups/data_<date>.sql`
2. **Add Sentry** — there is currently zero error visibility; server actions swallow all errors into UI toasts. Needs a Sentry account/DSN from Dillan first
3. **Unify the three upload paths** onto direct-to-storage — the server-action path fails for files >4.5MB on Vercel regardless of config. Then real photo thumbnails via Supabase image transforms (Pro feature) + `loading="lazy"`
4. **Clean up 242 orphaned rows** from deleted project `f807c3c7…` (48 submittals, 48 logs, 36 RFIs, 61 milestones, 48 punch, 1 attachment) — invisible junk from a pre-FK wipe. One reviewed DELETE, after a fresh dump
5. **Consolidate the two "A5 Rail" organizations** (one has 1 project, the other 3) — real early data is split across them (Potter Arkansas logs, UPRR Global II submittals)
6. **Dashboard count-query refactor** — KPIs are computed client-side from raw rows (now capped at 1,000). Move stats to server-side `head: true` count queries; requires touching the dashboard page, deferred to keep this pass safe

## 4. Product backlog (from the review — highest impact first)

1. Require a note on submittal Reject / Request-Revision (promised in FEATURES.md; one dialog — first thing a Procore-native reviewer notices)
2. Route project switches to Dashboard, not Submittals (`Sidebar.tsx`, `Topbar.tsx`)
3. "What needs my attention" row on the dashboard (awaiting your review / assigned to you / your overdue)
4. Merge Safety + QC/QA into one nav entry with tabs; demote Cameras out of primary nav (13 items → ~10)
5. Role-aware navigation (the `requiredAction` plumbing in `constants.ts` exists but is unused — every role sees everything)
6. Viewer-role zero-project empty state ("ask your PM to add you", not "create your first project")
7. Weekly Reports: "Draft from this week's daily logs" as primary creation path
8. Drop patch notes from the notification badge count
9. Replace `alert()` error dialogs on the Photos page
10. Mobile nav: Punch List / Photos are buried behind "More" while office workflows hold prime tab slots

## 5. Operational runbook notes

- **All schema changes** now go through `supabase/migrations/` + `supabase db push` (CLI is linked). No more untracked SQL-editor pastes — that's how the migration drift happened
- **Backup before schema changes:** `supabase db dump --linked --data-only -f backups/data_<date>.sql` (plus `--schema auth` variants for auth users)
- **Demo reset** (`/admin/demos`) works again and is guarded: it will refuse any org without `is_demo = true`
- **Cron health:** after deploying `beta_4`, check Vercel logs for the two crons — they now fail loud, so a red run means a real problem (previously they lied green)
- Known cosmetic quirk: legacy seed data uses 4-digit numbers (`SUB-0120`) while the trigger issues 3-digit (`SUB-005`); formats can never collide, purely visual

## 6. Security posture summary

Remaining known risks, in order (none launch-blocking during a pilot):
1. Platform-admin app-layer bypass (`permissions-helper.ts`) contradicts the DB-level isolation, and EarthCam writes use the service-role client after that check — scope or remove when convenient
2. Demo passwords are hardcoded in git (`src/lib/demo/types.ts`) and stored plaintext — acceptable for demos, but rotate the `RailDemo2026!*` values and consider seeder-generated passwords later
3. In-memory rate limiters (chat, email, access-request) reset per serverless instance — replace with Upstash/Redis when traffic warrants
4. No error tracking (see Sentry above)

---

*Prepared by Claude (4-agent audit + live-DB verification + hardening pass), July 5, 2026. Companion detail lives in PROJECT.md → Phase 14.*
