-- Owner-approved Inventory Beta availability to every existing project member.
-- Restore the original membership predicate; keep roles, finance permissions,
-- approvals, RPC-only writes, existing pilot records and all stock/history intact.
create or replace function inventory_private.role(p uuid) returns text
language sql stable security definer set search_path = '' as $$
 select m.project_role::text from public.project_members m
 join public.projects pr on pr.id=m.project_id
 join public.profiles u on u.id=m.profile_id
 where m.project_id=p and m.profile_id=auth.uid()
$$;
revoke all on function inventory_private.role(uuid) from public,anon,authenticated;
grant execute on function inventory_private.role(uuid) to authenticated;
-- inventory_beta_access keeps its compatible RPC name and response shape.
-- It now checks current project membership through the same role predicate.
