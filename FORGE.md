# ⚒️ THE COMMAND FORGE
### Cloning the RailCommand engine into new verticals (VoltCommand, HVACCommand, …)

**Owner:** Dillan Milosevich — Creative Currents LLC
**Engine of record:** RailCommand (`this repo`, `main` branch)
**Last updated:** July 5, 2026

---

## 1. What this is

RailCommand is two things fused together:

- **The Engine** — a construction-trade project management core: auth + two-layer RBAC, project-scoped multi-tenant RLS, 12 workflow modules, atomic entity numbering, notifications/crons, demo system, AI assistant, PWA shell. None of this is rail-specific.
- **The Skin** — everything that makes it *Rail*: the name, branding, seed/demo data, terminology, module emphasis, and marketing copy.

To launch a new vertical (e.g. **VoltCommand** for electrical), you clone the repo, hand your AI editor the prompt in §4, answer its discovery questions, and follow the backend flow in §5. The engine is never rewritten — only re-skinned.

**Golden rule: the Engine is edited only in RailCommand.** Bug fixes and engine improvements land here first, then flow downstream to clones (§7). If you find yourself editing auth, RLS, server actions, or permissions logic inside a clone, stop — fix it in RailCommand and pull it down.

---

## 2. The Engine (never changes per vertical)

| Layer | What it is | Where |
|---|---|---|
| Stack | Next.js App Router, Supabase (auth/Postgres+RLS/storage), Vercel, Resend, OpenAI | — |
| Access control | Org roles (Admin/Manager/Member/Viewer) × project roles; `permissions-helper.ts`; project-scoped RLS via `project_members` | `src/lib/permissions*`, DB policies |
| Modules | Dashboard, Submittals, RFIs, Daily Logs, Punch List, Safety, QC/QA, Documents, Photos, Weekly Reports, Schedule, Team | `src/app/(app)/projects/[id]/*` |
| Data layer | One server-action file per module, uniform `ActionResult`, 3 Supabase clients (server/client/admin), 500-row list caps | `src/lib/actions/*`, `src/lib/supabase/*` |
| Integrity | `assign_entity_number()` trigger + `entity_number_sequences` + `unique (project_id, number)` on all 9 numbered tables | DB (in `schema_snapshot.sql`) |
| Notifications | Resend email + 2 Vercel crons (fail-loud), demo suppression, per-recipient rate limits | `src/lib/notifications`, `src/app/api/cron/*` |
| Demo system | `demo_accounts`/`demo_team_logins`, seeder w/ presets, `/demo/[slug]` auto-auth, `organizations.is_demo` wipe guardrail | `src/lib/demo/*` |
| AI assistant | Chat route w/ role-filtered tools, streaming, conversations tables (owner-scoped RLS) | `src/app/api/chat/*`, `src/lib/railbot/*` |
| Full DB truth | Complete schema snapshot + tracked migrations | `supabase/schema_snapshot.sql`, `supabase/migrations/` |

**The 12 modules are trade-universal.** Submittals, RFIs, daily logs, punch lists, safety incidents, QC — electrical and HVAC contractors run the exact same workflows. Verticalization is 90% language, seed data, and emphasis — not new features.

## 3. The Skin (changes per vertical)

| Surface | RailCommand today | Per-vertical work |
|---|---|---|
| Product name | RailCommand / "A5 Rail" | Global rename (strings, `package.json` name, PWA manifest, meta/OG tags, favicon) |
| Brand theme | `rc-` CSS variables (orange/blue), Plus Jakarta Sans / DM Sans / JetBrains Mono | New palette + fonts in globals; keep the `rc-` var *names* so components don't change |
| AI assistant | "RailBot" | Rename + system-prompt trade context (e.g. "VoltBot", NEC code awareness) |
| Terminology | Rail/track language in copy, placeholders, empty states | Trade sweep (see prompt) — labels and copy only, never DB column names |
| Seed + demo data | Railroad projects (UPRR, TVA presets), rail work items, rail equipment | Trade-realistic projects, companies, crews, equipment, work categories in `seed-data.ts` + `DEMO_PRESETS` |
| Vertical extras | EarthCam cameras module, thermal photos | Keep, adapt, or remove per vertical (Cameras is optional everywhere) |
| Marketing/legal copy | FEATURES.md, login/access-request copy, email templates, terms/privacy | Rewrite for the vertical |
| Infrastructure | Supabase project `gwvftrrknusdfdgiwuij`, Vercel project, Resend domain | **Brand-new instances per vertical — never shared** (§5) |

---

## 4. The Forge Prompt (hand this to your AI editor)

> Copy everything in the block below into a fresh AI-editor session opened in a **fresh clone** of the RailCommand repo. It will interview you, then execute.

```markdown
# COMMAND FORGE — Vertical Clone Directive

You are re-skinning a production application. This repo is a clone of
RailCommand, a construction-trade project management platform. Your job is
to transform it into a new vertical WITHOUT touching its engine.

## STEP 0 — Read first, in this order
1. FORGE.md (this playbook — especially the Engine table in §2)
2. HANDOFF.md (current state + known remaining work)
3. PROJECT.md Phase 14 (the 2026-07 hardening — you must not regress it)
4. supabase/schema_snapshot.sql (the database truth)

## STEP 1 — Interview me (ask ALL of these before changing anything)
1. Product name + tagline? (e.g. "VoltCommand — command your electrical projects")
2. Vertical + typical project types? (e.g. electrical: commercial fit-outs,
   panel upgrades, EV charging installs, substation work)
3. Brand palette (primary/accent hex), font preferences, logo file provided?
4. AI assistant name? (e.g. VoltBot)
5. Terminology overrides? (defaults are trade-universal: Submittals, RFIs,
   Daily Logs, Punch List, Safety, QC/QA — confirm each or rename the LABEL)
6. Keep, adapt, or drop: Cameras module? Thermal photos? Weather in daily logs?
7. Demo preset companies + 3 realistic demo projects for this trade?
8. Safety incident types + QC categories for this trade?
   (electrical example: arc flash, LOTO violation, grounding fault;
    insulation resistance test, torque verification, panel labeling QC)
9. Domain name + support email + Resend sending domain?
10. Anything in FEATURES.md that should be emphasized differently for this
    vertical's buyers?

Wait for my answers. Then present a short execution plan and proceed.

## STEP 2 — Execute (the re-skin)
A. Global rename: RailCommand→{Name}, RailBot→{BotName}, A5 Rail→{Client},
   package.json name, PWA manifest, favicon/meta/OG, README title.
B. Theme: update CSS variable VALUES in globals (keep the `rc-` variable
   NAMES so zero component files change). Swap fonts in the root layout.
C. Terminology sweep: user-facing strings only — page titles, nav labels,
   empty states, placeholders, email subject/body copy, PDF headers.
D. Seed + demo: rewrite src/lib/demo/seed-data.ts and DEMO_PRESETS in
   src/lib/demo/types.ts with the trade-realistic data from my answers.
   Generate NEW random demo passwords — do not reuse RailCommand's.
E. AI assistant: rename + adjust the system prompt/tool descriptions for
   the trade. Do not change the tool implementations or role filtering.
F. Docs: rewrite FEATURES.md for the vertical; reset PROJECT.md to a
   Phase-1 checklist for this product; update BACKEND.md project refs.
G. Remove or adapt vertical extras per my answers (Cameras/thermal).
H. Create .env.example entries unchanged in SHAPE — new values come later.

## STEP 3 — Hard invariants (violating any of these is a failed job)
1. NEVER modify: src/lib/actions/* logic, permissions-helper.ts, RLS
   policies, supabase client setup, cron auth checks, rate limiting,
   entity-numbering trigger/migrations, demo wipe guardrail (is_demo).
2. NEVER rename database tables or columns. Terminology changes are
   UI-label-only. "Submittals" can display as anything; the table stays
   `submittals`.
3. Keep every fail-closed check fail-closed (CRON_SECRET, EMAIL_API_KEY,
   is_demo verification). Keep crons returning 500 on query errors.
4. All schema changes go in supabase/migrations/ — never ad-hoc SQL.
5. No secrets in code. No demo passwords committed (generate at seed time
   or store only in the new project's demo_accounts rows).
6. The app must build (npm run build) and typecheck (npx tsc --noEmit)
   clean before you report done.

## STEP 4 — Report
Deliver: list of changed files by category, anything from my answers you
could not honor and why, and the exact remaining manual steps (they should
match FORGE.md §5 — flag any drift you noticed).
```

---

## 5. Backend migration flow (new vertical = new backend)

Never point a clone at RailCommand's Supabase/Vercel/Resend. One vertical, one stack. ~2 hours total.

**A. Supabase (≈45 min)**
1. Create a new Supabase project (name it after the vertical; note the project ref + region — US region to match the US-only posture).
2. In the clone repo: `supabase login` (if needed) → `supabase link --project-ref <new-ref>`.
3. Bootstrap the schema — the snapshot is the baseline:
   ```bash
   cp supabase/schema_snapshot.sql supabase/migrations/<timestamp>_baseline.sql
   supabase db push --linked
   ```
   Then delete the old RailCommand-era files in `supabase/migrations/` that predate the baseline (their contents are already inside the snapshot) and keep migrating forward from here, always via `supabase/migrations/` + `db push`.
4. Storage buckets (they're data, not schema — the snapshot doesn't create them): create `avatars` (public), `project-photos`, `thermal-photos` (if kept), `project-documents` (all private). Bucket RLS policies ARE in the snapshot.
5. Auth settings (Dashboard → Authentication): enable Email provider, confirm-email ON, min password 8, leaked-password protection; configure Google OAuth with a new Google Cloud client for the new domain; set Site URL + redirect URLs.
6. Email templates: paste the vertical-branded versions (the Forge Prompt rewrites the copy; templates live in Dashboard → Auth → Templates).
7. `npm run types:gen` after updating the project id in `package.json`'s `types:gen` script.

**B. Vercel (≈20 min)**
1. New Vercel project from the new GitHub repo; production branch `main`.
2. Env vars (Production/Preview/Dev) — same shape as `.env.example`, all NEW values: new Supabase URL + anon + service-role, new `OPENAI_API_KEY`, new `RESEND_API_KEY`, fresh random `CRON_SECRET`, `EMAIL_API_KEY`, `NOTIFICATIONS_API_KEY`, `ADMIN_DASHBOARD_PASSWORD`, and the product domain in `NEXT_PUBLIC_SITE_URL`.
3. `vercel.json` crons carry over unchanged (they auth with the new `CRON_SECRET`).

**C. Resend (≈15 min)**
1. Add + verify the new sending domain (SPF/DKIM DNS records).
2. Update the from-address constants the Forge Prompt flagged.
3. Send a test: `npm run test:email`.

**D. Seed & verify (≈30 min)**
1. Deploy, log in, create the first org/project.
2. Create a demo from `/admin/demos` (seeder now marks orgs `is_demo` automatically).
3. Smoke test: file a daily log from a phone → create + approve a submittal → invite a user (email arrives) → run each cron once with the secret (`curl -H "Authorization: Bearer $CRON_SECRET" <url>/api/cron/...`) → confirm 200s and expected `emailsSent`.
4. Take the first local backup: `supabase db dump --linked --data-only -f backups/data_<date>.sql`.

---

## 6. Per-vertical launch checklist

- [ ] Forge Prompt executed; build + typecheck clean
- [ ] §5 A–D complete (new Supabase, Vercel, Resend; smoke tests pass)
- [ ] Demo preset seeded and demo link tested end-to-end
- [ ] New keys stored in a password manager — nothing shared with other verticals
- [ ] Terms/Privacy pages reviewed for the new product name
- [ ] HANDOFF.md items relevant to the engine re-checked (they apply to every clone)
- [ ] Upgrade the new Supabase project to Pro before real customer data

## 7. Keeping clones in sync with the engine

Clone each vertical as a **GitHub fork (or a repo with RailCommand added as a git remote)**:

```bash
git remote add engine https://github.com/DillanMilo/Railcommand.git
# When RailCommand lands engine fixes (like the 2026-07-05 hardening):
git fetch engine && git merge engine/main    # resolve skin-file conflicts, keep engine changes
```

Skin files (seed data, presets, copy, theme values) will conflict — keep the clone's version. Engine files (actions, permissions, crons, migrations) — keep the engine's version. If a merge ever feels risky, cherry-pick the specific engine commits instead.

**When you have 3+ verticals**, revisit extracting a true shared config layer (`vertical.config.ts` for name/theme/terminology/presets) in RailCommand itself so downstream merges stop conflicting on skin files. Don't build that today — two products don't justify it.

---

*Forged from the 2026-07-05 full audit. The engine you're cloning was verified that day: RLS on every table, atomic numbering on all 9 numbered tables, fail-loud crons, guarded demo wipes, schema truth in version control.*
