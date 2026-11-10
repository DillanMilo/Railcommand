-- Explicit recovery of an ambiguous identity without private payload replay.
-- This shares inventory_execute's actor/UUID lock, so a delayed original either
-- wins once, or finds this immutable never-applied receipt and cannot mutate.
create or replace function public.inventory_settle(p_project_id uuid, p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 actor uuid := auth.uid();
 previous public.inventory_receipts;
 answer jsonb;
begin
 if actor is null or p_operation_id is null then
  return jsonb_build_object('error','Authentication and operation identity required','code','denied');
 end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_operation_id::text,0));
 if inventory_private.role(p_project_id) is null or not exists (
  select 1 from public.project_members m
  where m.project_id=p_project_id and m.profile_id=actor and m.can_edit
 ) then
  return jsonb_build_object('error','Project write permission required','code','denied');
 end if;
 select * into previous from public.inventory_receipts
 where actor_id=actor and operation_id=p_operation_id;
 if found then
  if previous.project_id<>p_project_id then
   return jsonb_build_object('error','Operation unavailable','code','denied');
  end if;
  return previous.result;
 end if;
 answer := jsonb_build_object('ok',false,'code','operation_not_applied',
  'error','Original operation was not applied. Saved field work is available; review current data before a new decision.');
 insert into public.inventory_receipts(actor_id,operation_id,project_id,digest,result)
 values(actor,p_operation_id,p_project_id,
  encode(sha256(convert_to(jsonb_build_object('projectId',p_project_id,'command',jsonb_build_object('action','settle'))::text,'UTF8')),'hex'),answer);
 return answer;
end;
$$;
revoke all on function public.inventory_settle(uuid,uuid) from public, anon;
grant execute on function public.inventory_settle(uuid,uuid) to authenticated;
