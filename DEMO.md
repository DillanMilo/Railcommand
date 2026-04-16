# RailCommand Demo Accounts — Instructions

*Last updated: 2026-04-16*

This document covers everything you need to know about the enterprise demo account system. Update this file as the setup evolves.

---

## TL;DR

| Purpose | Email | How you access |
|---------|-------|----------------|
| **Your admin account** | `dillanxx@gmail.com` | Normal login at `/login`, manage demos at `/admin/demos` |
| **Demo: Dillan (PM)** | `dillan@creativecurrents.io` | Visit `/demo/team` → click "Dillan Milosevich" |
| **Demo: Caleb (PM)** | `caleb@lenaserv.com` | Visit `/demo/team` → click "Caleb Douglas" |
| **Demo: Mark (Owner)** | `mark.allen@a5rail.com` | Visit `/demo/team` → click "Mark Allen" |

**You never type the demo passwords** — auto-login happens when you click the role.

---

## Status Tracker

| Task | Status |
|------|--------|
| Code pushed to `main` | ✅ Commit `9407097` |
| Vercel env vars installed | ✅ Confirmed |
| SQL migrations run | ✅ Confirmed (by cowork) |
| Attachments RLS hardened | ✅ Confirmed (by cowork) |
| Admin role set on `dillanxx@gmail.com` | ✅ Confirmed 2026-04-16 |
| Vercel deploy complete | ⬜ Check Vercel dashboard |
| Team demo created | ✅ Live on production |
| Team demo tested | ✅ Confirmed working |
| UP prospect demo created | ⬜ After team demo works |
| TVA prospect demo created | ⬜ After team demo works |

**Production URL:** `https://railcommand.vercel.app`

---

## First-Time Setup (run once)

### Step 1: Make sure you have admin role

Run this in **Supabase Dashboard → SQL Editor**:

```sql
-- Grant admin role to your account
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'dillanxx@gmail.com';

-- Verify
SELECT id, email, full_name, role FROM public.profiles
WHERE email = 'dillanxx@gmail.com';
```

If the SELECT returns 0 rows, sign up at `/login` first with `dillanxx@gmail.com`, complete onboarding, then re-run the UPDATE.

### Step 2: Wait for Vercel deploy

Check [Vercel dashboard](https://vercel.com/dashboard) — latest deploy from `main` should be green (takes 2-3 minutes).

### Step 3: Create the team demo

1. Log into production with `dillanxx@gmail.com`
2. Navigate to `/admin/demos`
3. Click **"Create Demo"**
4. Select **"A5 Rail — Team Demo (Team)"** from the dropdown
5. Click **"Create Demo"** button
6. Wait ~15-20 seconds (creates 3 auth users, org, project, seeds all 12 modules)

You should see the demo appear in the table with:
- Slug: `team`
- Status: Active
- Access count: 0

### Step 4: Test it yourself

1. Open `/demo/team` in an **incognito window**
2. You'll see a role picker with 3 options
3. Click **"Dillan Milosevich"** — auto-login → dashboard
4. You should see:
   - Orange "Demo Mode" banner at the top
   - Full populated project (Englewood Yard Expansion)
   - 15 submittals, 12 RFIs, 25 daily logs, 20 punch list items, etc.

### Step 5: Share with the team

Send Caleb and Mark the production demo link:
```
https://[your-vercel-url]/demo/team
```

They click their name → instant login → start testing.

---

## Demo Data Contents

Each team demo is seeded with realistic railroad construction data:

| Module | Records | Notes |
|--------|---------|-------|
| Milestones | 10 | Mobilization → Final Inspection |
| Submittals | 15 | AREMA rail, ties, turnouts, signals |
| RFIs | 12 | Utility conflicts, PTC, ballast |
| Daily Logs | 25 | Weather, crews, equipment |
| Punch List | 20 | All 4 status stages |
| Safety | 8 | Near miss, recordable, hazards |
| Change Orders | 5 | Rock excavation, turnout upgrade |
| QC/QA | 8 | Inspections, NCRs, tests |
| Documents | 10 | Track plans, specs, contracts |
| Weekly Reports | 8 | CM + contractor reports |
| Modifications | 4 | Plan revisions, amendments |
| Activity Log | 40 | Full project timeline |
| Team Members | 10+ | PM, super, foreman, contractor, inspector |

---

## Testing Checklist

When Caleb or Mark log in, they should verify:

- [ ] Dashboard loads with KPIs and activity feed
- [ ] Submittals page shows 15 items with mixed statuses
- [ ] RFIs page shows 12 items, some answered/closed
- [ ] Daily Logs has 25 entries spanning ~5 weeks
- [ ] Punch List shows items in Open, In Progress, Resolved, Verified
- [ ] Safety shows incident types and severities
- [ ] Schedule page shows 10 milestones with budget
- [ ] Team page shows all members + roles
- [ ] Demo Mode banner appears at top
- [ ] Can create a new RFI/punch list item
- [ ] Can invite a new member via Team page (tests Resend email)
- [ ] RailBot greets by first name ("Hey Dillan")

---

## Invitation Testing

To test the real invite email flow:

1. Log into team demo as Dillan
2. Go to **Team page** → **Add Team Member** → **Invite by Email** tab
3. Enter a test email (use one of your real emails, not the demo emails)
4. Assign a role (e.g., Engineer)
5. Submit
6. Check the test email inbox — should receive a Supabase auth invite from Resend
7. Click the link → creates account → lands on `/invite/[token]` → accept → becomes project member

---

## Resetting the Demo

If data gets messy or you want a fresh state:

1. Go to `/admin/demos`
2. Click the **refresh icon** (↻) on the team demo row
3. Confirm the reset
4. Wait ~15-20 seconds — demo wipes and re-seeds

All 3 login credentials stay the same.

---

## Adding More Demos (after team demo works)

To create a prospect demo for Union Pacific or TVA:

1. Go to `/admin/demos`
2. Click **"Create Demo"**
3. Select from dropdown:
   - **"Union Pacific (Prospect)"** → creates `/demo/up`
   - **"Tennessee Valley Authority (Prospect)"** → creates `/demo/tva`
4. Prospect demos are **single-login** (no role picker) — auto-logs in as PM on visit

To add a brand new prospect (e.g., CSX, BNSF, CPKC):
- Edit `src/lib/demo/types.ts` → add a new entry to `DEMO_PRESETS`
- Commit → push → deploy
- Create from admin dashboard

---

## Troubleshooting

### "Demo not found" on /demo/team
- Migration not run, or demo not created yet via `/admin/demos`
- Solution: Go to admin dashboard and create it

### "Admin access required" on /admin/demos
- Your profile doesn't have `role = 'admin'`
- Solution: Run the SQL in Step 1 of First-Time Setup

### Seeder hangs / returns error
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env vars
- Check Vercel function logs for the specific error
- Most common cause: email already exists in Supabase auth (collision)

### Email notifications not arriving
- Check Resend dashboard for delivery status
- Verify `RESEND_API_KEY` is set in Vercel
- Check Supabase Authentication → Email settings

### Demo login fails with "Invalid credentials"
- The demo was created but auth user wasn't (partial seed failure)
- Solution: Reset the demo from `/admin/demos`

### I want to change a demo email
- Edit `src/lib/demo/types.ts` → `DEMO_PRESETS`
- Commit → push → deploy
- Reset the demo from admin dashboard (to recreate with new email)

---

## Security Notes

- Demo data is isolated by RLS policies on `project_members`
- Attachments have `project_id` column with membership-scoped policies
- Each demo has its own organization and project (no cross-demo leakage)
- Demo auth users are real Supabase users — they have the same RLS protections as production users
- Admin API routes (`/api/admin/demo/*`) require `role = 'admin'` in profiles
- Public API routes: `/api/admin/demo/lookup` and `/api/admin/demo/track` (needed for `/demo/[slug]` entry page)

---

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/demo/types.ts` | Presets (team, UP, TVA) and types |
| `src/lib/demo/seeder.ts` | Creates full demo with all data |
| `src/lib/demo/reset.ts` | Wipe + re-seed utility |
| `src/lib/demo/auth.ts` | Demo lookup and auth helpers |
| `src/app/demo/[slug]/page.tsx` | Entry route (auto-auth + role picker) |
| `src/app/(app)/admin/demos/page.tsx` | Admin dashboard |
| `src/app/api/admin/demo/*` | 5 API routes (lookup, track, list, create, reset) |
| `src/components/layout/DemoBanner.tsx` | "Demo Mode" banner |
| `docs/migrations/2026-04-15_demo_accounts.sql` | Demo tables migration |
| `docs/migrations/2026-04-15_attachments_rls_fix.sql` | Attachments isolation fix |
| `docs/migrations/FULL_MIGRATION_ALL.sql` | Consolidated migration bundle |

---

## Next Steps After Team Demo Works

1. Create UP prospect demo (`/demo/up`)
2. Create TVA prospect demo (`/demo/tva`)
3. Test data isolation — log into team demo, verify you can't see UP data
4. Share prospect demo links with Caleb for the pitch conversation
5. When ready to show UP/TVA, reset the demos for clean state before the pitch

---

## Changelog

| Date | Change |
|------|--------|
| 2026-04-15 | Initial demo system built (Phase 13) |
| 2026-04-15 | Attachments RLS hardened (added `project_id` + membership policies) |
| 2026-04-16 | Demo emails updated to real emails (`dillan@creativecurrents.io`, `caleb@lenaserv.com`, `mark.allen@a5rail.com`) |
| 2026-04-16 | DEMO.md created |
| 2026-04-16 | Confirmed `dillanxx@gmail.com` has admin role. Production URL: railcommand.vercel.app |
| 2026-04-16 | Team demo created and tested working. Credentials shared with Mark & Caleb. |
| 2026-04-16 | Fixed infinite recursion RLS bug on project_members + projects tables (was blocking invitation acceptance). Migration: `2026-04-16_fix_project_members_recursion.sql` |
