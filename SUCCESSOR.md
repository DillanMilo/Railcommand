# SUCCESSOR BRIEF — RailCommand
### An operating manual for the next model working on this project

**Written:** July 5, 2026 (updated July 9), by the model that ran the full audit, verified the live database, shipped the Phase 14 hardening, and wrote FORGE.md.
**For:** Whatever model assists Dillan next. You are inheriting a real production system with real users. Read this before you touch anything.
**Companions:** HANDOFF.md (current task list) · FORGE.md (vertical cloning) · PROJECT.md (build history) · memory files in the Claude project directory.

---

## 0. Who you're working with

Dillan Milosevich, CTO of Creative Currents LLC, building RailCommand for his client A5 Rail. He is fast-moving, trusts you with real authority, says "go ahead and get this done" and means it. His stated values, repeatedly: **don't over-engineer, don't overcomplicate.** He prefers parallel agents for big tasks, work committed to `beta_N` branches (currently `beta_4`; never straight to `main` unless he says so), and PROJECT.md/FEATURES.md kept current alongside feature work. When he makes a business call that contradicts your security instincts (it will happen — see §10), state the risk once, clearly, then execute his decision without relitigating.

## 1. What this project is really trying to accomplish

On paper: a construction/rail project-management SaaS. Actually: **two products in one repo.**

1. **RailCommand the product** — a focused, mobile-first alternative to Procore for rail construction, currently in pilot with A5 Rail. It wins by being simpler, not by feature parity. The sales motion runs through the demo system: prospects get a `/demo/[slug]` link, trial it with real auth sessions, invite their own team members, and convert. The demo system is therefore **production infrastructure, not a toy** — treat it with the same care as the billing page of a normal SaaS.
2. **RailCommand the engine** — a white-label trade-PM platform that gets cloned per vertical (VoltCommand for electrical is next, then HVAC etc.). This is the client's actual growth thesis. FORGE.md is the playbook. The strategic consequence: **every engine improvement compounds across future verticals; every hack in the engine gets cloned into every future product.** Judge your changes accordingly.

Success in the next 6 months looks like: pilot users convert to paying, zero data-loss incidents, VoltCommand forged and live. It does not look like: a redesigned architecture, a test pyramid, or feature count.

## 2. Highest-leverage next steps (in order)

1. **Keys rotation** (Dillan personally): Supabase service-role, OpenAI, Resend — outstanding since June. Nag him gently once per session until done.
2. **Verify the cron post-deploy.** The overdue-reminders cron lied ("success, 0 sent") every weekday for weeks because it queried nonexistent columns. It's fixed on `main` now, but nobody has watched a real scheduled run succeed yet. Check Vercel cron logs. (It's the only cron left — daily-log reminders were removed entirely on 2026-07-07, a product decision.)
3. **Resolve the demo-data question.** The active demo project ("Englewood Yard Expansion", slug `team`) had ZERO module data on 2026-07-05, yet trial users are actively on it. Either they're happily building their own data (fine) or the demo looks broken to prospects (bad). Dillan must decide; a reset wipes trial-user additions, so never reset without his explicit go.
4. **Sentry** — there is no error tracking at all. Every server action swallows errors into UI toasts. Needs Dillan to create the account/DSN; the wiring is a half-day.
5. **Fix the >4.5MB upload path** — `uploadAttachment` pushes bytes through a server action; Vercel caps that at ~4.5MB regardless of the `bodySizeLimit: '100mb'` config lie in next.config.ts. Two other paths upload direct-to-storage and work. Consolidate onto direct-to-storage.
6. **Product top-3 from the audit:** reviewer-notes dialog on submittal Reject (FEATURES.md promises it; Caleb-types notice), project-switch should land on Dashboard not Submittals (`Sidebar.tsx` / `Topbar.tsx`, one line each), and a "needs my attention" row on the dashboard.
7. **Supabase Pro before real launch** — pilot runs on Free with manual dump backups (see §6). The moment there's a paying customer, Pro is non-negotiable.
8. **VoltCommand** — when the client says go, follow FORGE.md exactly. Don't freelance the process.

## 3. What NOT to overbuild

Candidly — the temptations you will feel, and why to resist them:

- **Don't rewrite the client-side SPA into proper server components.** 38 of 43 pages are `'use client'` with a homemade `useQuery` hook and zero caching. Yes, it offends Next.js sensibilities. It is also coherent, consistent, shipped, and fine at pilot scale. The 500-row caps bought years of headroom. Revisit only when a real customer has a real slow page.
- **Don't introduce react-query/SWR/tRPC/Zustand.** The homemade hook works and every page uses it identically. Swapping it is a 40-file diff for zero user-visible value.
- **Don't build the shared vertical config layer.** FORGE.md §7 already made this call: not until 3+ verticals exist. Two products don't justify the abstraction.
- **Don't write a test suite crusade.** There's mocha for earthcam/ip-reputation and CI runs lint+tsc. A Playwright smoke test of the 3 core workflows before launch would be worth it; 80% unit coverage would not.
- **Don't add realtime subscriptions, queues, microservices, Redis** (exception: if chat abuse actually happens, the in-memory rate limiter needs a real store — that's reactive, not speculative).
- **Don't expand RBAC.** Two-layer roles cover it. The unused `requiredAction` nav plumbing should be *used* (role-aware nav), not extended.
- **Don't "improve" the demo invite emails back into suppression.** Implemented and reverted 2026-07-05 at Dillan's explicit direction — trial users must invite teammates. This is a business decision. Respect it.
- **Don't re-add daily-log reminder emails.** Dillan removed the entire cron + templates on 2026-07-07 (users found the nagging counterproductive, evidently). Same category as the invite-email reversal: a product decision, not an oversight.
- **Don't consolidate the docs.** BACKEND.md is a 200KB historical spec, not live truth. The live truth is the code + `supabase/schema_snapshot.sql`. Leave the archaeology alone.

## 4. Core user workflows (protect these paths)

1. **Field crew files a daily log from a phone**: bottom nav → Logs → New Log. Two taps to the form. This is the single most important flow in the product — any change adding friction here is a regression no matter what it improves.
2. **PM reviews a submittal**: dashboard KPI card (deep-links pre-filtered) → item → Approve/Reject. Known gap: no reviewer-notes prompt (see §2.6).
3. **Exec checks health**: login → dashboard KPIs + CPI/SPI. Overdue counts are now computed truthfully from `due_date` (`isRfiOverdue` in `date-utils.ts`) — never regress this to trusting `status === 'overdue'`; nothing writes that status.
4. **The sales loop**: admin creates demo at `/admin/demos` → prospect hits `/demo/[slug]` → auto-auth into a real session → trials it → invites team members (real emails, deliberate) → access-request funnel for pricing. Break any link in this chain and you've broken revenue, not a feature.
5. **Admin demo management**: create/reset/deactivate. Reset re-seeds but **destroys trial-user additions** and is guarded by `organizations.is_demo` (fail-closed).

## 5. Key risks and unknowns

- **No automatic backups** (Free plan, pilot decision). Mitigation: local dumps to gitignored `backups/` before every schema change — `supabase db dump --linked --data-only -f backups/data_<date>.sql`. If you do anything schema-touching without a fresh dump, you have failed at your job.
- **Real production data exists**: A5 Rail orgs hold real early work (Potter Arkansas daily logs, UPRR Global II submittals). There are also **two orgs both named "A5 Rail"** — consolidation is pending and any org-level operation must double-check which is which by UUID, not name.
- **242 orphaned rows** from a pre-FK-era wipe (project `f807c3c7…`) — invisible junk, cleanup pending, harmless until someone writes a service-role query that assumes referential integrity.
- **Platform-admin bypass**: `permissions-helper.ts` grants `profiles.role='admin'` access to any project in any org, contradicting the DB-level isolation, and earthcam actions do service-role writes behind that check. Known, accepted for now, scope it someday.
- **Demo passwords are hardcoded in git** (`src/lib/demo/types.ts`, `RailDemo2026!*`) and usable at the normal login. Accepted for pilot; rotate/generate at seed-time eventually.
- **Migration discipline is 3 weeks old.** Before July, prod schema drifted ahead of the repo (the numbering trigger existed only in prod; the FULL bundle was a stale landmine we deleted). The discipline now: ALL schema changes via `supabase/migrations/` + `supabase db push`. One untracked SQL-editor paste breaks the truth again. Guard this fiercely.
- **Newest, least-battle-tested code:** the standalone client dashboard (`src/app/client/page.tsx`, ~1,000 lines, added 2026-07-07) plus the `email_events` table (`supabase/migrations/20260707153000_email_events.sql`) and related email/send changes. This landed after the audit — it has had none of the scrutiny the rest of the app got. Apply the §14 checklist to it retroactively when you first touch anything nearby. (Encouraging sign: its schema change went through `supabase/migrations/` — the discipline is holding.)
- **Unknown:** actual trial-user behavior (are they active? in which project?), Resend deliverability at scale, and whether the client's vertical thesis gets funded — don't build ahead of that signal.

## 6. Technical architecture guidance

**Stack:** Next.js App Router + Supabase (auth/Postgres+RLS/storage) + Vercel + Resend + OpenAI. Effectively an SPA: client pages → custom `useQuery` hooks (`src/hooks/useData.ts`) → server actions (`src/lib/actions/*`, one file per module, uniform `ActionResult`) → Supabase with RLS. Three clients in `src/lib/supabase/`: `server` (user-scoped, RLS applies), `client` (browser), `admin` (service-role, RLS bypassed — server-only, always behind an explicit auth check).

**Tenancy:** project-scoped RLS via `project_members`, verified sound on 2026-07-05. Orgs matter for tiers and the `is_demo` flag, not isolation.

**Integrity:** all 9 numbered tables (SUB/RFI/PL/DOC/QC/SAF/CO/MOD/WR) get numbers from the `assign_entity_number()` BEFORE INSERT trigger + `entity_number_sequences` + `unique (project_id, number)`. The app-side count-then-insert code still runs but is overwritten by the trigger — it's dead weight you may remove opportunistically, never a thing to trust.

**Ground truths, in order of authority:**
1. The live database (query it: `supabase db query --linked -o json "<sql>"` — CLI is linked and authenticated)
2. `supabase/schema_snapshot.sql` + `supabase/migrations/`
3. The code
4. Docs, in descending freshness: HANDOFF.md → PROJECT.md → FEATURES.md → BACKEND.md (historical)

When the repo and the live DB disagree, the DB is right and the repo has a bug to fix. This exact disagreement produced half the audit findings.

**Conventions that already exist — use them, don't invent parallels:** `date-utils.ts` for all date-only handling (TZ bugs are why it exists), `QueryError` for fetch errors, 500-row list caps, `head: true` count queries (pattern in `chat/route.ts`), fail-closed env checks on crons/email, `getDemoProjectIds` suppression in notification paths.

## 7. Product and business strategy guidance

- **Caleb Douglas is the roadmap oracle.** PhD civil engineer, TVA veteran, Procore power user, beta tester. His 16-item feedback list drove V2. When prioritizing product work, ask "would Caleb notice this?" before "is this architecturally satisfying?" The remaining audit product items (§2.6, HANDOFF.md §4) are ranked by exactly that.
- **The demo IS the funnel.** Demo polish beats feature additions for revenue. An empty demo project (see §2.3) is a worse bug than any exception.
- **Pricing is gated** behind the access-request flow deliberately — enterprise-style sales, not self-serve. Don't build billing/Stripe until Dillan asks.
- **Verticals multiply value.** A fix to the engine ships to every future *Command. When choosing between a RailCommand-specific hack and an engine-level fix of equal cost, take the engine-level fix. When the engine fix costs 3× more, ask Dillan.
- **Feature requests filter:** universal to trade contractors → engine. Rail-only → skin (and skeptically). Neither → probably no.

## 8. Good decisions vs bad decisions

**A good decision here:** smallest diff that fixes a *lie* or removes *friction in a core loop*; additive DB change verified against live data first; follows an existing in-repo pattern; independently deployable on a beta branch; build + tsc clean; leaves a truthful trail in PROJECT.md.

**A bad decision:** introduces an abstraction with one caller; renames DB entities for terminology reasons (labels are UI-only — FORGE.md invariant); touches engine logic to serve one vertical; trusts repo docs over the live DB; catches an error and returns success; refactors 30 files to "clean up" while fixing a 3-line bug; adds a dependency where 20 lines of code would do.

**The historical pattern to internalize:** every serious bug found in the audit was a *silent lie* — the cron reporting success while dead, fetch errors rendering as empty projects, overdue counts trusting a status nothing writes, a migration bundle whose header claimed "complete/safe" while missing 15 files. This codebase's failure mode is not crashes; it's confident wrongness. Loud failure is a feature. Preserve every 500, every error state, every fail-closed check.

## 9. How to review future work on this project

Run the checklist in §14 mechanically, then ask three judgment questions:

1. **"What does this change make silent?"** Any new catch-and-continue, any `const { data } = await` that discards `error`, any default that papers over a missing env var — reject or fix.
2. **"Does this match the module next door?"** All 12 modules are structural siblings. A change that makes one module special (different fetch pattern, different error style, different numbering) is drift; make it match or make all 12 better.
3. **"If this is wrong, how do we find out?"** Acceptable answers: a 500 in Vercel logs, a Sentry event, a failing build. Unacceptable: "a user will tell us."

For DB-touching work, additionally verify against the live database before AND after — actual `supabase db query` checks, not assumptions. That habit is what caught the check-constraint issue, the empty demo, and the sequence-seeding requirement.

## 10. What to be especially careful about

- **`resetDemo`/`deleteDemo`** service-role delete an entire org **including its auth users**. The `is_demo` guardrail (fail-closed) protects this — never weaken it, never add a bypass flag, never trust `demo_accounts` targeting without it.
- **`deleteProject`** is one hard delete cascading through 19 FK paths, gated only on `profiles.role='admin'`, with no backups on Free plan. Treat any code path near it as radioactive.
- **The service-role client** (`admin.ts`) bypasses RLS. Every new usage needs an explicit auth check above it, in the same function, visible in the same diff.
- **Dillan's business calls override security preferences.** Precedent: demo invite emails (suppression reverted), Pro upgrade (deferred). State the risk once, put it in HANDOFF.md, execute his decision. Do not re-implement reverted guardrails "while you're in there."
- **Don't recreate a "run everything" SQL bundle.** The deleted FULL_MIGRATION_ALL.sql claimed to be complete and safe while being neither; someone nearly re-exposing plaintext demo passwords by trusting its header is the closest this project came to a security incident.
- **Dates:** date-only fields are `YYYY-MM-DD` strings end-to-end via `date-utils.ts`. `new Date("2026-03-13")` shifts a day in US timezones — this bug family is why the util exists.
- **Prod deploys happen on push to `main`** via Vercel. `main` = production. Beta branches are where work lives.

## 11. Questions to ask Dillan before acting

- Anything **destructive or irreversible**: deletes, resets, applying migrations to prod, orphan cleanup, org consolidation. (He'll say yes fast — but he says it explicitly, every time. The permission classifier will also stop you; don't route around it.)
- Anything touching the **demo while trial users are active** — reset, re-seed, credential changes.
- **Merging to `main` / deploying.** Committing+pushing to the beta branch is pre-approved; production is his call per batch.
- Changing **email behavior** in any direction (who gets emailed, suppression, templates) — it's the sales channel.
- Anything with **billing** (Supabase Pro, new paid services like Sentry) — his card, his call.
- **Scope beyond the known lists** (Caleb's items, HANDOFF.md, the audit backlog) — new features need his sign-off, not your initiative.
- When starting **VoltCommand**: the FORGE.md §4 interview questions, verbatim.

## 12. What to do WITHOUT asking

- Read-only verification against the live DB (`supabase db query --linked` — introspection and SELECTs).
- Local backup dumps before schema work (`backups/` is gitignored).
- Typecheck, lint, build; running the dev server to verify.
- Additive code fixes within known scope, committed and pushed to the current `beta_N` branch (established pattern: commit+push together).
- Spinning up parallel agents for multi-part tasks (he explicitly prefers this) — with strict file boundaries per agent.
- Keeping PROJECT.md (and FEATURES.md when user-facing behavior changes) current with the work.
- Updating the Claude memory files when project facts change.
- Fixing outright lies when you find them (a swallowed error, a wrong label, a dead link) — smallest diff, note it in the commit.

## 13. Simple execution roadmap

**Phase A — Pilot stability (now → first paying customer):**
Keys rotated → overdue-reminders cron observed green in Vercel → demo-data decision → Sentry wired → upload path consolidated → product top-3 (§2.6). Nothing else unless it breaks.

**Phase B — Launch gate (at first real customer):**
Supabase Pro (backups + image transforms) → real photo thumbnails + lazy loading → orphan cleanup + A5 Rail org consolidation → Playwright smoke of the 3 core workflows → demo password regeneration.

**Phase C — VoltCommand (when client greenlights):**
FORGE.md, start to finish. Fresh clone, Forge Prompt interview, new Supabase/Vercel/Resend, smoke test, first dump. Engine fixes discovered during forging go to RailCommand first, then merge down.

**Phase D — Scale (only when real usage demands):**
Dashboard server-side count queries → rate limiting with a real store → nav consolidation (Safety+QC/QA merge, Cameras demotion) → role-aware nav → consider the shared vertical config layer at 3+ verticals.

## 14. Review checklist for future Claude Code / Cursor work

Before accepting any diff into a beta branch:

- [ ] `npx tsc --noEmit` and `npm run build` clean
- [ ] No `const { data } = await` discarding `error` on any Supabase call in changed code
- [ ] No new service-role usage without an adjacent, explicit auth check
- [ ] Fail-closed checks still fail closed (CRON_SECRET, EMAIL_API_KEY, `is_demo` guard)
- [ ] Schema changes: in `supabase/migrations/` only, additive, verified against live data, dump taken first
- [ ] No DB table/column renames for terminology (labels are UI-only)
- [ ] New list queries have ORDER BY + `.limit()` (500 is house standard)
- [ ] Date-only values flow as strings through `date-utils.ts` helpers
- [ ] Error and empty states render (QueryError pattern) — a failed fetch must not look like empty data
- [ ] Change matches its sibling modules' structure; no one-off patterns
- [ ] Demo paths still suppressed in notification/cron sends; demo invite emails still WORK (both deliberate)
- [ ] PROJECT.md updated; commit message says what changed and why; on `beta_N`, not `main`

## 15. If you only remember five things

1. **The live database is the truth; verify, don't assume.** The CLI is linked — query it. Half of everything important this project learned came from checking prod instead of trusting the repo.
2. **This codebase fails by lying, not by crashing.** Your highest-value work is making failure loud: keep the 500s, the error states, the fail-closed checks. Never trade truthfulness for polish.
3. **Engine vs. skin is the business model.** Engine changes belong in RailCommand and compound across every future vertical; labels and branding are skin; database names are never terminology.
4. **Dillan decides trade-offs; you surface them once.** He runs a pilot with real users and real constraints. State the risk plainly, record it in HANDOFF.md, then execute his call — the demo-invite reversal is the template.
5. **Smallest safe diff, on a beta branch, additive in the database, with a fresh dump behind you.** That recipe shipped an entire hardening pass into production without breaking a single trial user. It works. Keep using it.

---

*Good luck. The foundation is verified and solid; the discipline that keeps it that way is described above. Your job is not to be impressive — it's to keep this thing truthful, shipping, and simple enough that one person can run it.*
