-- Add a structural is_demo flag to organizations.
--
-- The demo reset/wipe utility performs service-role deletes (org, project,
-- and every auth user in the org) trusting demo_accounts.organization_id
-- blindly. This flag gives it a hard guardrail: reset/delete refuses to
-- touch any organization not explicitly marked as a demo org.
--
-- Additive only: new column with default false, backfilled from the demo
-- accounts that already exist. No RLS or behavior change for existing code.

begin;

alter table public.organizations
  add column if not exists is_demo boolean not null default false;

-- Backfill: every org currently targeted by a demo account is a demo org.
update public.organizations o
set is_demo = true
where exists (
  select 1 from public.demo_accounts d where d.organization_id = o.id
);

commit;
