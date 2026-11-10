-- Initial live rollout only: apply this preparation BEFORE deploying the new
-- web/API, then apply the four inventory migrations in their original order.
-- Existing table/column grants and RLS stay unchanged during preparation.
-- A fresh chronological reset already has the final RPCs: never replace them.
do $bridge$
begin
 if to_regprocedure('public.project_finance(uuid)') is null then
  execute $fn$
   create function public.project_finance(p_project_id uuid)
   returns table(id uuid,budget_total numeric,budget_spent numeric)
   language sql stable security invoker set search_path = '' as $body$
    select p.id,p.budget_total,p.budget_spent from public.projects p
    where p.id=p_project_id and auth.uid() is not null and exists(
     select 1 from public.profiles u where u.id=auth.uid() and u.organization_id=p.organization_id
     and (u.role='admin' or exists(select 1 from public.project_members m
      where m.project_id=p.id and m.profile_id=u.id and m.project_role in ('manager','superintendent','engineer','owner'))))
   $body$
  $fn$;
  revoke all on function public.project_finance(uuid) from public,anon;
  grant execute on function public.project_finance(uuid) to authenticated;
 end if;
 if to_regprocedure('public.milestone_finance(uuid)') is null then
  execute $fn$
   create function public.milestone_finance(p_project_id uuid)
   returns table(id uuid,budget_planned numeric,budget_actual numeric,percent_complete numeric)
   language sql stable security invoker set search_path = '' as $body$
    select m.id,m.budget_planned,m.budget_actual,m.percent_complete from public.milestones m
    join public.projects p on p.id=m.project_id
    where p.id=p_project_id and auth.uid() is not null and exists(
     select 1 from public.profiles u where u.id=auth.uid() and u.organization_id=p.organization_id
     and (u.role='admin' or exists(select 1 from public.project_members member
      where member.project_id=p.id and member.profile_id=u.id and member.project_role in ('manager','superintendent','engineer','owner'))))
   $body$
  $fn$;
  revoke all on function public.milestone_finance(uuid) from public,anon;
  grant execute on function public.milestone_finance(uuid) to authenticated;
 end if;
end $bridge$;
notify pgrst, 'reload schema';
