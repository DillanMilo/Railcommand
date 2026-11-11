-- Limited release only. Empty by default; enrollment is managed by the release
-- operator and never changes existing project membership or cost permissions.
create table public.inventory_beta_participants (
 project_id uuid not null references public.projects(id),
 profile_id uuid not null references public.profiles(id),
 enabled boolean not null default true,
 approval_reference text not null check(length(trim(approval_reference))>0),
 created_at timestamptz not null default now(),
 primary key(project_id,profile_id)
);
alter table public.inventory_beta_participants enable row level security;
revoke all on public.inventory_beta_participants from public,anon,authenticated,service_role;
grant select,insert,update on public.inventory_beta_participants to service_role;

-- All Inventory RPCs and operational-table RLS already use this predicate.
-- Keep its original membership/role meaning, with an additional pilot restriction.
create or replace function inventory_private.role(p uuid) returns text
language sql stable security definer set search_path = '' as $$
 select m.project_role::text from public.project_members m
 join public.projects pr on pr.id=m.project_id
 join public.profiles u on u.id=m.profile_id
 where m.project_id=p and m.profile_id=auth.uid()
 and exists(select 1 from public.inventory_beta_participants pilot
  where pilot.project_id=p and pilot.profile_id=auth.uid() and pilot.enabled)
$$;
revoke all on function inventory_private.role(uuid) from public,anon,authenticated;
grant execute on function inventory_private.role(uuid) to authenticated;

create or replace function public.inventory_beta_access(p_project_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and inventory_private.role(p_project_id) is not null
$$;
revoke all on function public.inventory_beta_access(uuid) from public,anon,authenticated,service_role;
grant execute on function public.inventory_beta_access(uuid) to authenticated;
