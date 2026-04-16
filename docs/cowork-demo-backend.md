# Cowork Prompt: Enterprise Demo Account System — Backend Setup

## Context
RailCommand has a new enterprise demo account system built in the frontend. It creates real Supabase auth users, organizations, projects, and seeds all 12 modules of realistic railroad construction data. Demo accounts are accessed via `/demo/[slug]` URLs — zero friction for prospects.

The frontend code is complete and TypeScript-clean. This cowork session handles the **Supabase backend setup** needed to make it work.

---

## Tasks (in order)

### 1. Run the demo_accounts migration
Execute the SQL in `docs/migrations/2026-04-15_demo_accounts.sql` in the Supabase SQL Editor.

This creates:
- `demo_accounts` table (slug, company_name, organization_id, project_id, demo_user_id, is_active, is_team_demo, demo_password, expires_at, access_count, last_accessed_at)
- `demo_team_logins` table (for multi-user team demos — links demo_account_id to profile_id with email/password/role)
- Indexes on slug, active status, account_id, email
- RLS policies: SELECT open to all (needed for `/demo/[slug]` lookup), mutations restricted to service role only

### 2. Verify all prior migrations have been run
The demo seeder inserts into ALL project tables. Confirm these tables exist:
- `organizations`, `profiles`, `projects`, `project_members`
- `submittals`, `rfis`, `daily_logs`, `daily_log_personnel`, `daily_log_equipment`, `daily_log_work_items`
- `punch_list_items`, `milestones`, `safety_incidents`, `change_orders`
- `qcqa_reports`, `project_documents`, `weekly_reports`, `modifications`
- `activity_log`, `attachments`, `project_invitations`

If any table is missing, check `docs/migrations/` for the corresponding SQL file and run it.

### 3. Verify RLS policies for demo isolation
The seeder creates real Supabase auth users. Demo data is isolated by the existing RLS policies (all tables use `project_members` membership checks). Verify:

- Each data table has a SELECT policy requiring `project_members` membership
- Each data table has INSERT/UPDATE policies requiring membership
- The `demo_accounts` and `demo_team_logins` tables have open SELECT but no public INSERT/UPDATE/DELETE

**Quick test query** (run as anon role after seeding a demo):
```sql
-- This should return ZERO rows when authenticated as a non-demo user
SELECT * FROM submittals WHERE project_id = '<demo_project_id>';
```

### 4. Verify the `log_activity` RPC exists
The seeder inserts into `activity_log` directly (bypasses the RPC since it uses service role). But the app's normal flow uses the `log_activity` RPC from `docs/migrations/2026-04-09_log_activity_rpc.sql`. Confirm it exists:

```sql
SELECT proname FROM pg_proc WHERE proname = 'log_activity';
```

If missing, run `docs/migrations/2026-04-09_log_activity_rpc.sql`.

### 5. Confirm the `on_auth_user_created` trigger behavior
The seeder creates auth users via `admin.auth.admin.createUser()` and then upserts profiles. The existing `on_auth_user_created` trigger may auto-create a bare profile row. The seeder uses `upsert` with `onConflict: 'id'` to handle this gracefully — but confirm the trigger exists and doesn't block the upsert.

### 6. Verify Supabase Storage buckets
The demo doesn't seed file uploads, but the app expects these buckets to exist:
- `avatars` (public)
- `project-photos` (private, RLS by project membership)
- `thermal-photos` (private, RLS by project membership)

If missing, run `docs/migrations/2026-04-08_avatars_bucket.sql` and `docs/migrations/2026-04-09_private_photo_buckets.sql`.

### 7. Test the full flow
After all migrations are confirmed:

1. **From your admin account**, navigate to `/admin/demos`
2. Click "Create Demo" → select "A5 Rail — Team Demo (Team)" → Create
3. Wait for seeding to complete (may take 10-20 seconds — it creates auth users, org, project, and ~150 entity records)
4. Copy the demo link (`/demo/team`)
5. Open in an incognito window
6. You should see the **role picker** with Dillan (Manager), Caleb (Manager), Mark (Owner)
7. Click "Dillan Milosevich" → auto-login → redirected to dashboard with full data
8. Verify the "Demo Mode" banner appears at the top
9. Navigate through all modules — submittals, RFIs, punch list, etc. should all have data
10. Test the invite flow: go to Team page → Add Team Member → Invite by Email

### 8. Test prospect demo
1. From `/admin/demos`, create the "Union Pacific (Prospect)" demo
2. Open `/demo/up` in incognito
3. Should auto-login immediately (no role picker — single user)
4. Verify full data isolation — UP demo should NOT see Team demo data

### 9. Test invitation flow within team demo
1. Log in as Dillan (manager) via `/demo/team`
2. Go to Team page → click "Add Team Member" → "Invite by Email" tab
3. Enter one of the other demo emails (e.g., `caleb-demo@railcommand.app`)
4. Assign a role (e.g., Engineer)
5. The invitation should be created successfully
6. Log out, go to `/demo/team`, log in as Caleb
7. Navigate to any pending invitations or check the team page
8. Note: Since demo users already have auth accounts, the invitation email won't be needed — they can accept from the invite page directly

---

## File Reference
| File | Purpose |
|------|---------|
| `docs/migrations/2026-04-15_demo_accounts.sql` | Demo tables migration |
| `src/lib/demo/seeder.ts` | Seeds full demo with all 12 modules |
| `src/lib/demo/reset.ts` | Wipe + re-seed utility |
| `src/lib/demo/types.ts` | 3 presets: team, up, tva |
| `src/lib/demo/auth.ts` | Demo lookup and auth helpers |
| `src/app/demo/[slug]/page.tsx` | Auto-auth entry route |
| `src/app/api/admin/demo/*/route.ts` | Admin API endpoints |
| `src/app/(app)/admin/demos/page.tsx` | Admin dashboard UI |

## Demo Credentials
| Demo | Slug | Email | Password | Role |
|------|------|-------|----------|------|
| **Team — Dillan** | team | dillan-demo@railcommand.app | RailDemo2026!team | PM (full access) |
| **Team — Caleb** | team | caleb-demo@railcommand.app | RailDemo2026!caleb | PM (full access) |
| **Team — Mark** | team | mark-demo@railcommand.app | RailDemo2026!mark | Owner (budget view) |
| **Union Pacific** | up | up-demo@railcommand.app | RailDemo2026!up | PM (full access) |
| **TVA** | tva | tva-demo@railcommand.app | RailDemo2026!tva | PM (full access) |

## Troubleshooting
- **"Demo not found" on /demo/[slug]**: Migration not run, or demo not created yet via admin dashboard
- **Auth fails**: Check Supabase Auth → Users tab — demo users should appear with confirmed emails
- **Empty modules**: Seeder may have partially failed — check browser console / network tab for API errors. Reset the demo from admin dashboard.
- **RLS errors on insert**: Seeder uses service-role client (bypasses RLS). If seeing RLS errors, the `SUPABASE_SERVICE_ROLE_KEY` env var may be missing or wrong.
- **"relation does not exist"**: A migration hasn't been run. Check `docs/migrations/` for the missing table.
