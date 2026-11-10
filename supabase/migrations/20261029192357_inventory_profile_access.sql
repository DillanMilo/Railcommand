-- TCO profile access: additive, local-first. No role-enum or invitation changes.
create table public.inventory_cost_access (
 project_id uuid not null references public.projects(id), member_id uuid not null references public.profiles(id),
 version integer not null check(version>0), can_view boolean not null,
 source text not null check(length(trim(source))>0), actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), primary key(project_id,member_id,version)
);
alter table public.inventory_cost_access enable row level security;
revoke all on public.inventory_cost_access from public,anon,authenticated,service_role;
grant select on public.inventory_cost_access to service_role;
create trigger inventory_cost_access_immutable before update or delete on public.inventory_cost_access for each row execute function inventory_private.immutable();

create or replace function inventory_private.admin(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select inventory_private.role(p) is not null and exists(
 select 1 from public.profiles u join public.projects pr on pr.organization_id=u.organization_id
 join public.project_members m on m.project_id=pr.id and m.profile_id=u.id
 where pr.id=p and u.id=auth.uid() and u.role='admin' and m.can_edit)
$$;
create or replace function inventory_private.manage(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select inventory_private.admin(p) or (inventory_private.role(p)='manager' and exists(
 select 1 from public.project_members where project_id=p and profile_id=auth.uid() and can_edit))
$$;
create or replace function inventory_private.finance(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(inventory_private.role(p) is not null and (
 inventory_private.admin(p) or inventory_private.role(p) in ('manager','owner') or
 (inventory_private.role(p) in ('engineer','superintendent') and (
 coalesce((select a.can_view from public.inventory_cost_access a where a.project_id=p and a.member_id=auth.uid() order by version desc limit 1),false) or
 exists(select 1 from public.inventory_supply_chain_assignments a join public.project_members m on m.project_id=a.project_id and m.profile_id=a.actor_id
 where a.project_id=p and a.actor_id=auth.uid() and m.can_edit and a.version=(select max(version) from public.inventory_supply_chain_assignments where project_id=p))
 ))),false)
$$;
revoke all on function inventory_private.admin(uuid),inventory_private.manage(uuid),inventory_private.finance(uuid) from public,anon,authenticated;
grant execute on function inventory_private.finance(uuid) to authenticated;

create or replace function public.inventory_read(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; org uuid; f jsonb; scoped uuid[];
begin
 result:=inventory_private.inventory_read_phase_one(p_project_id);
 result:=jsonb_set(result,'{lots}',coalesce((select jsonb_agg(l||jsonb_build_object('opening_quantity',(select sum(m.quantity) from public.inventory_movements m where m.lot_id=(l->>'id')::uuid and m.kind='opening'))) from jsonb_array_elements(result->'lots') l),'[]'::jsonb));
 if result ? 'error' then return result; end if;
 -- Explicit allowlist on the field boundary, including additive online events.
 if not inventory_private.finance(p_project_id) then
  result:=jsonb_set(result,'{events}',coalesce((select jsonb_agg(e) from jsonb_array_elements(result->'events') e where e->>'action' in ('assign','opening','count','submit','revise','cancel','verify','authorize','reject','supply_chain')),'[]'::jsonb));
  return result;
 end if;
 select organization_id into org from public.projects where id=p_project_id;
 select coalesce(array_agg(c.id),array[]::uuid[]) into scoped from public.inventory_contracts c where c.organization_id=org and (inventory_private.admin(p_project_id) or exists(select 1 from public.inventory_exposure_contracts ec join public.inventory_exposures e on e.id=ec.exposure_id join public.inventory_contract_sources cs on cs.id=ec.source_id where e.project_id=p_project_id and cs.contract_id=c.id));
 f:=jsonb_build_object(
  'canConfigurePolicy',inventory_private.admin(p_project_id),
  'canManageAccess',inventory_private.admin(p_project_id),
  'canApproveSupplyChain',exists(select 1 from public.inventory_supply_chain_assignments a join public.project_members m on m.project_id=a.project_id and m.profile_id=a.actor_id where a.project_id=p_project_id and a.actor_id=auth.uid() and m.can_edit and m.project_role in ('manager','superintendent','engineer') and a.version=(select max(version) from public.inventory_supply_chain_assignments where project_id=p_project_id)),
  'costAccess',case when inventory_private.admin(p_project_id) then coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at desc) from public.inventory_cost_access a where a.project_id=p_project_id),'[]'::jsonb) else '[]'::jsonb end,
  'policy',(select to_jsonb(c) from public.inventory_org_policy c where c.organization_id=org order by version desc limit 1),
  'policyHistory',coalesce((select jsonb_agg(to_jsonb(c) order by version desc) from public.inventory_org_policy c where organization_id=org),'[]'::jsonb),
  'contracts',coalesce((select jsonb_agg(to_jsonb(c) order by c.contract_key) from public.inventory_contracts c where organization_id=org and c.id=any(scoped)),'[]'::jsonb),
  'baselines',coalesce((select jsonb_agg(to_jsonb(c) order by c.verified_at desc) from public.inventory_contract_baselines c where organization_id=org and c.contract_id=any(scoped)),'[]'::jsonb),
  'contractSources',coalesce((select jsonb_agg(to_jsonb(c)) from public.inventory_contract_sources c where organization_id=org and c.contract_id=any(scoped)),'[]'::jsonb),
  'annual',coalesce((select jsonb_agg(jsonb_build_object('lotId',l.id,'evaluation',inventory_private.annual(p_project_id,l.id))) from public.inventory_lots l where l.project_id=p_project_id),'[]'::jsonb),
  'supplyChainAssignment',(select to_jsonb(c) from public.inventory_supply_chain_assignments c where project_id=p_project_id order by version desc limit 1),
  'approvalEvidence',coalesce((select jsonb_agg(to_jsonb(c) order by created_at desc) from public.inventory_approval_evidence c where project_id=p_project_id),'[]'::jsonb));
 return jsonb_set(result,'{finance}',result->'finance'||f);
end$$;
revoke all on function public.inventory_read(uuid) from public,anon;
grant execute on function public.inventory_read(uuid) to authenticated;

create or replace function public.inventory_execute(p_project_id uuid,p_operation_id uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 actor uuid:=auth.uid(); role_name text; cmd text:=p_command->>'action'; payload_hash text;
 previous public.inventory_receipts; lot public.inventory_lots; req public.inventory_requests;
 assigned public.inventory_assignments; current_count public.inventory_counts;
 cost public.inventory_cost_revisions; exposure public.inventory_exposures;
 rid uuid; lid uuid; mid uuid; sid uuid; qty integer; old_state text; code text;
 answer jsonb; budget jsonb; forecast numeric; increment numeric; version_no integer; components jsonb;
 org uuid; annual jsonb; policy public.inventory_org_policy; contract public.inventory_contracts; canonical public.inventory_contract_sources; baseline public.inventory_contract_baselines; sc public.inventory_supply_chain_assignments; pending_sc boolean:=false;
 keys text[]:=array['log','mill','trucking','treating','drying','creosote','rail_car','install_labour','inspection','carrying_cost','disposal'];
begin
 if actor is null or p_operation_id is null or p_command is null then return jsonb_build_object('error','Authentication and operation identity required','code','denied'); end if;
 payload_hash:=encode(sha256(convert_to(jsonb_build_object('projectId',p_project_id,'command',p_command)::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(actor::text||p_operation_id::text,0));
 role_name:=inventory_private.role(p_project_id);
 if role_name is null then
  insert into public.inventory_denials(actor_id,operation_id,code) values(actor,p_operation_id,'access_denied');
  return jsonb_build_object('error','Project access required','code','denied');
 end if;
 if not exists(select 1 from public.project_members m where m.project_id=p_project_id and m.profile_id=actor and m.can_edit) then
  insert into public.inventory_denials(actor_id,project_id,operation_id,code) values(actor,p_project_id,p_operation_id,'write_denied');
  return jsonb_build_object('error','Project write permission required','code','denied');
 end if;
 select * into previous from public.inventory_receipts where actor_id=actor and operation_id=p_operation_id;
 if found then
  if previous.digest<>payload_hash then return jsonb_build_object('error','Operation identity already used for different input','code','operation_conflict'); end if;
  return previous.result;
 end if;
 begin
 -- Global order: actor/UUID -> organization -> project -> lot -> request.
 -- Serializes every cross-project source, policy, reconciliation and final commitment.
 select organization_id into org from public.projects where id=p_project_id;
 perform pg_advisory_xact_lock(hashtextextended('inventory-org:'||org::text,0));
 select * into policy from public.inventory_org_policy where organization_id=org order by version desc limit 1;
 -- All feature mutations lock project -> lot -> request, including source revisions.
 perform 1 from public.projects where id=p_project_id for update;
 perform 1 from public.project_members where project_id=p_project_id for share;
 perform 1 from public.profiles where organization_id=org or id=actor for share;
 -- Initial checks precede a potentially long org-lock wait. Re-read under the
 -- project/member/profile locks and retain them through the mutation's commit.
 role_name:=inventory_private.role(p_project_id);
 if role_name is null or not exists(select 1 from public.projects where id=p_project_id and organization_id=org) then
  code:='access_denied'; raise exception using errcode='P0002',message=code;
 end if;
 if not exists(select 1 from public.project_members where project_id=p_project_id and profile_id=actor and can_edit) then
  code:='write_denied'; raise exception using errcode='P0002',message=code;
 end if;
 perform 1 from public.change_orders where project_id=p_project_id for share;
 select * into assigned from public.inventory_assignments where project_id=p_project_id;
 if cmd='cost_access' then
  if not inventory_private.admin(p_project_id) then code:='access_management_denied';
  elsif not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id where m.project_id=p_project_id and m.profile_id=(p_command->>'memberId')::uuid and m.project_role in ('engineer','superintendent') and u.organization_id=org) then code:='eligible_cost_viewer_required';
  elsif coalesce((select max(version) from public.inventory_cost_access where project_id=p_project_id and member_id=(p_command->>'memberId')::uuid),0) is distinct from (p_command->>'expectedVersion')::integer then code:='stale_cost_access';
  elsif jsonb_typeof(p_command->'canViewCost') is distinct from 'boolean' then code:='access_value_required';
  else
   insert into public.inventory_cost_access(project_id,member_id,version,can_view,source,actor_id) values(p_project_id,(p_command->>'memberId')::uuid,(p_command->>'expectedVersion')::integer+1,(p_command->>'canViewCost')::boolean,p_command->>'source',actor);
   answer:=jsonb_build_object('ok',true);
  end if;
 elsif cmd='policy' then
  if not inventory_private.admin(p_project_id) then code:='configuration_denied';
  elsif policy.version is distinct from (p_command->>'expectedVersion')::integer then code:='stale_policy';
  else
   insert into public.inventory_org_policy(organization_id,version,annual_rate,threshold_amount,currency,source,created_by)
    values(org,policy.version+1,(p_command->>'annualRate')::numeric,(p_command->>'thresholdAmount')::numeric,p_command->>'currency',p_command->>'source',actor);
   answer:=jsonb_build_object('ok',true);
  end if;
 elsif cmd='contract' then
  if not inventory_private.manage(p_project_id) then code:='configuration_denied';
  else
   insert into public.inventory_contracts(organization_id,contract_key,start_date,name,created_by) values(org,trim(p_command->>'contractKey'),nullif(p_command->>'startDate','')::date,trim(p_command->>'name'),actor);
   answer:=jsonb_build_object('ok',true);
  end if;
 elsif cmd='baseline' then
  select * into contract from public.inventory_contracts where id=(p_command->>'contractId')::uuid and organization_id=org;
  select * into baseline from public.inventory_contract_baselines where contract_id=contract.id and period_year=(p_command->>'periodYear')::integer and currency=p_command->>'currency' order by version desc limit 1;
  if not inventory_private.manage(p_project_id) then code:='configuration_denied';
  elsif contract.id is null then code:='invalid_contract';
  elsif coalesce(baseline.version,0) is distinct from (p_command->>'expectedVersion')::integer then code:='stale_baseline';
  elsif coalesce((p_command->>'verifiedExcludesTrackedSources')::boolean,false) is not true then code:='baseline_reconciliation_required';
  else
   insert into public.inventory_contract_baselines(organization_id,contract_id,period_year,currency,version,amount,evidence,verified_by)
    values(org,contract.id,(p_command->>'periodYear')::integer,p_command->>'currency',coalesce(baseline.version,0)+1,(p_command->>'amount')::numeric,p_command->>'evidence',actor);
   answer:=jsonb_build_object('ok',true);
  end if;
 elsif cmd='supply_chain_assign' then
  select * into sc from public.inventory_supply_chain_assignments where project_id=p_project_id order by version desc limit 1;
  if not inventory_private.admin(p_project_id) then code:='assignment_denied';
  elsif coalesce(sc.version,0) is distinct from (p_command->>'expectedVersion')::integer then code:='stale_assignment';
  elsif (p_command->>'supplyChainId')::uuid in (assigned.lead_id,assigned.pm_id) or not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id where m.project_id=p_project_id and m.profile_id=(p_command->>'supplyChainId')::uuid and m.can_edit and m.project_role in ('manager','superintendent','engineer') and u.organization_id=org) then code:='distinct_eligible_supply_chain_required';
  else
   insert into public.inventory_supply_chain_assignments(project_id,version,actor_id,assigned_by) values(p_project_id,coalesce(sc.version,0)+1,(p_command->>'supplyChainId')::uuid,actor);
   answer:=jsonb_build_object('ok',true);
  end if;
 elsif cmd='assign' then
  if not inventory_private.manage(p_project_id) then code:='assignment_denied';
  elsif not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id join public.projects p on p.id=m.project_id and p.organization_id=u.organization_id where m.project_id=p_project_id and m.profile_id=(p_command->>'leadId')::uuid)
   or not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id join public.projects p on p.id=m.project_id and p.organization_id=u.organization_id where m.project_id=p_project_id and m.profile_id=(p_command->>'pmId')::uuid and m.project_role='manager' and m.can_edit)
   or p_command->>'leadId'=p_command->>'pmId' then code:='distinct_current_members_required';
  elsif assigned.project_id is not null and assigned.version<>coalesce((p_command->>'expectedVersion')::integer,0) then code:='stale_assignment';
  else
   insert into public.inventory_assignments(project_id,lead_id,pm_id) values(p_project_id,(p_command->>'leadId')::uuid,(p_command->>'pmId')::uuid)
   on conflict(project_id) do update set lead_id=excluded.lead_id,pm_id=excluded.pm_id,version=public.inventory_assignments.version+1;
   answer:=jsonb_build_object('ok',true);
  end if;
 elsif cmd='opening' then
  if not inventory_private.manage(p_project_id) then code:='opening_denied';
  elsif length(trim(coalesce(p_command->>'source','')))=0 then code:='source_required';
  else
   qty:=(p_command->>'quantity')::integer;
   if qty<=0 then code:='positive_quantity_required';
   else
    insert into public.inventory_materials(project_id,code,name) values(p_project_id,trim(p_command->>'materialCode'),trim(p_command->>'material')) on conflict on constraint inventory_materials_project_id_code_key do update set code=excluded.code returning id into mid;
    insert into public.inventory_locations(project_id,name) values(p_project_id,trim(p_command->>'yard')) on conflict(project_id,name) do update set name=excluded.name returning id into sid;
    insert into public.inventory_lots(project_id,material_id,location_id,received_at,age_source,readiness,inspection_accepted,drying_started_at,drying_completed_at,balance)
     values(p_project_id,mid,sid,nullif(p_command->>'receivedAt','')::date,p_command->>'source',coalesce(p_command->>'readiness','ready'),coalesce((p_command->>'inspectionAccepted')::boolean,false),nullif(p_command->>'dryingStartedAt','')::date,nullif(p_command->>'dryingCompletedAt','')::date,qty) returning id into lid;
    insert into public.inventory_movements(project_id,lot_id,quantity,kind,actor_id,operation_id) values(p_project_id,lid,qty,'opening',actor,p_operation_id);
    components:=(select jsonb_object_agg(k,jsonb_build_object('amount',null,'status','awaiting_wendy','source','')) from unnest(keys) k);
    insert into public.inventory_cost_revisions(project_id,lot_id,version,components,created_by) values(p_project_id,lid,1,components,actor);
    if not exists(select 1 from public.inventory_configuration where project_id=p_project_id) then
     insert into public.inventory_configuration(project_id,version,source,created_by) values(p_project_id,1,'Awaiting Wendy',actor);
    end if;
    answer:=jsonb_build_object('ok',true,'lotId',lid);
   end if;
  end if;
 elsif cmd='configuration' then
  if not inventory_private.manage(p_project_id) then code:='configuration_denied';
  else
   select coalesce(max(version),0) into version_no from public.inventory_configuration where project_id=p_project_id;
   if version_no<>coalesce((p_command->>'expectedVersion')::integer,0) then code:='stale_configuration';
   else
    insert into public.inventory_configuration(project_id,version,annual_rate,storage_daily,threshold_amount,currency,bands,source,created_by)
    values(p_project_id,version_no+1,nullif(p_command->>'annualRate','')::numeric,nullif(p_command->>'storageDaily','')::numeric,nullif(p_command->>'thresholdAmount','')::numeric,nullif(p_command->>'currency',''),p_command->'bands',coalesce(p_command->>'source','Awaiting Wendy'),actor);
    answer:=jsonb_build_object('ok',true);
   end if;
  end if;
 else
  lid:=nullif(p_command->>'lotId','')::uuid; rid:=nullif(p_command->>'requestId','')::uuid;
  if rid is not null then select lot_id into lid from public.inventory_requests where id=rid and project_id=p_project_id; end if;
  select * into lot from public.inventory_lots where id=lid and project_id=p_project_id for update;
  if lot.id is null then
   insert into public.inventory_denials(actor_id,operation_id,code) values(actor,p_operation_id,'access_denied');
   return jsonb_build_object('error','Record unavailable','code','denied');
  end if;
  if rid is not null then select * into req from public.inventory_requests where id=rid and project_id=p_project_id for update; end if;
  select * into current_count from public.inventory_counts where lot_id=lid order by created_at desc,id desc limit 1;
  if lot.version<>coalesce((p_command->>'lotVersion')::integer,0) then code:='stale_lot';
  elsif rid is not null and req.version<>coalesce((p_command->>'expectedVersion')::integer,0) then code:='stale_request';
  elsif cmd='cost' then
   if not inventory_private.manage(p_project_id) then code:='cost_denied';
   elsif nullif(p_command->>'annualRateOverride','')::numeric is not null and nullif(p_command->>'annualRateOverride','')::numeric is distinct from (select annual_rate_override from public.inventory_cost_revisions where lot_id=lid order by version desc limit 1) and not inventory_private.admin(p_project_id) then code:='configuration_denied';
   else
    select * into cost from public.inventory_cost_revisions where lot_id=lid order by version desc limit 1;
    components:=p_command->'components';
    if cost.version<>coalesce((p_command->>'costVersion')::integer,0) then code:='stale_cost';
    elsif components is null or jsonb_typeof(components)<>'object' or (select count(*) from jsonb_object_keys(components))<>11
      or exists(select 1 from unnest(keys) k where not components ? k)
      or exists(select 1 from jsonb_each(components) e where not e.value ? 'amount' or not e.value ? 'status' or jsonb_typeof(e.value->'amount') not in ('number','null') or jsonb_typeof(e.value->'source')<>'string' or (e.value->>'amount')::numeric<0 or e.value->>'status' not in ('awaiting_wendy','estimate','actual','commitment') or not e.value ? 'source')
      or components->'carrying_cost'->>'amount' is not null then code:='invalid_cost_components';
    else
     mid:=nullif(p_command->>'exposureId','')::uuid;
     if mid is null then
      insert into public.inventory_exposures(project_id,source_key,funding,amount,source,milestone_id,change_order_id,created_by)
       values(p_project_id,p_command->>'sourceKey',p_command->>'funding',nullif(p_command->>'incrementalAmount','')::numeric,p_command->>'source',nullif(p_command->>'milestoneId','')::uuid,nullif(p_command->>'changeOrderId','')::uuid,actor) returning id into mid;
     elsif not exists(select 1 from public.inventory_exposures where project_id=p_project_id and id=mid) then code:='invalid_source';
     end if;
     if code is null and p_command->>'contractId' is not null and p_command->>'contractId'<>'' then
      select * into contract from public.inventory_contracts where id=(p_command->>'contractId')::uuid and organization_id=org;
      if contract.id is null then code:='invalid_contract';
      else
       select * into exposure from public.inventory_exposures where id=mid;
       if exposure.funding='new' then
        select * into canonical from public.inventory_contract_sources where contract_id=contract.id and period_year=(p_command->>'periodYear')::integer and currency=p_command->>'currency' and source_key=exposure.source_key;
        if canonical.id is null then
         insert into public.inventory_contract_sources(organization_id,contract_id,period_year,currency,source_key,amount,evidence,created_by)
          values(org,contract.id,(p_command->>'periodYear')::integer,p_command->>'currency',exposure.source_key,exposure.amount,exposure.source,actor) returning * into canonical;
        elsif canonical.amount<>exposure.amount or canonical.evidence<>exposure.source then code:='source_evidence_conflict';
        end if;
        if code is null then
         if exists(select 1 from public.inventory_exposure_contracts where exposure_id=mid and source_id<>canonical.id) then code:='source_scope_conflict';
         elsif not exists(select 1 from public.inventory_exposure_contracts where exposure_id=mid) then
          insert into public.inventory_exposure_contracts(exposure_id,source_id,created_by) values(mid,canonical.id,actor);
         end if;
        end if;
       end if;
      end if;
     end if;
     if code is null then
      insert into public.inventory_cost_revisions(project_id,lot_id,version,components,annual_rate_override,creosote_oil_reference,exposure_id,created_by)
       values(p_project_id,lid,cost.version+1,components,case when inventory_private.admin(p_project_id) then nullif(p_command->>'annualRateOverride','')::numeric else cost.annual_rate_override end,p_command->>'creosoteOilReference',mid,actor);
      answer:=jsonb_build_object('ok',true);
     end if;
    end if;
   end if;
  elsif cmd='count' then
   if actor is distinct from assigned.lead_id and not inventory_private.manage(p_project_id) then code:='count_denied';
   elsif length(trim(coalesce(p_command->>'reason','')))=0 then code:='reason_required';
   else
    insert into public.inventory_counts(project_id,lot_id,lot_version,expected,counted,actor_id,reason) values(p_project_id,lid,lot.version,lot.balance,(p_command->>'quantity')::integer,actor,p_command->>'reason');
    answer:=jsonb_build_object('ok',true);
   end if;
  elsif cmd='submit' then
   qty:=(p_command->>'quantity')::integer;
   if role_name not in ('foreman','manager','superintendent','engineer','contractor') then code:='request_denied';
   elsif assigned.lead_id is null or assigned.pm_id is null or actor in (assigned.lead_id,assigned.pm_id) then code:='three_distinct_people_required';
   elsif lot.readiness<>'ready' or not lot.inspection_accepted then code:='stock_not_ready';
   elsif qty<=0 or qty>lot.balance then code:='insufficient_stock';
   else
    insert into public.inventory_requests(project_id,lot_id,requester_id,quantity,work_location,reason,state,review_token)
     values(p_project_id,lid,actor,qty,trim(p_command->>'workLocation'),trim(p_command->>'reason'),'submitted',inventory_private.token(p_project_id,lid)) returning * into req;
    insert into public.inventory_request_revisions(project_id,request_id,revision,payload,review_token,actor_id)
     values(p_project_id,req.id,1,jsonb_build_object('quantity',req.quantity,'workLocation',req.work_location,'reason',req.reason,'lotVersion',lot.version,'leadId',assigned.lead_id,'pmId',assigned.pm_id,'policyVersion',assigned.version),req.review_token,actor);
    insert into public.inventory_request_finance(request_id,revision,project_id,cost_revision_id,exposure_id,budget_snapshot)
     select req.id,req.revision,p_project_id,c.id,c.exposure_id,inventory_private.budget(p_project_id) from public.inventory_cost_revisions c where c.lot_id=lid order by c.version desc limit 1;
    rid:=req.id; answer:=jsonb_build_object('ok',true,'requestId',rid,'version',req.version);
   end if;
  elsif req.id is null then code:='unknown_action';
  elsif cmd in ('revise','cancel') then
   if req.state in ('posted','cancelled') then code:='immutable_posted_request';
   elsif actor<>req.requester_id then code:='request_owner_required';
   else
    if cmd='cancel' then
     update public.inventory_requests set state='cancelled',version=version+1 where id=rid returning * into req;
    else
     qty:=coalesce((p_command->>'quantity')::integer,req.quantity);
     if qty<=0 or qty>lot.balance then code:='insufficient_stock';
     else
      update public.inventory_requests set quantity=qty,work_location=coalesce(nullif(trim(p_command->>'workLocation'),''),work_location),reason=coalesce(nullif(trim(p_command->>'reason'),''),reason),state='submitted',version=version+1,revision=revision+1,verifier_id=null,approver_id=null,review_token=inventory_private.token(p_project_id,lid) where id=rid returning * into req;
      insert into public.inventory_request_finance(request_id,revision,project_id,cost_revision_id,exposure_id,budget_snapshot)
       select req.id,req.revision,p_project_id,c.id,c.exposure_id,inventory_private.budget(p_project_id) from public.inventory_cost_revisions c where c.lot_id=lid order by c.version desc limit 1;
      insert into public.inventory_request_revisions(project_id,request_id,revision,payload,review_token,actor_id) values(p_project_id,rid,req.revision,jsonb_build_object('quantity',req.quantity,'workLocation',req.work_location,'reason',req.reason,'lotVersion',lot.version,'leadId',assigned.lead_id,'pmId',assigned.pm_id,'policyVersion',assigned.version),req.review_token,actor);
     end if;
    end if;
    if code is null then answer:=jsonb_build_object('ok',true,'requestId',rid,'version',req.version); end if;
   end if;
  elsif cmd in ('verify','authorize','supply_chain','reject') then
   old_state:=req.state;
   annual:=inventory_private.annual(p_project_id,lid);
   if not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id where m.project_id=p_project_id and m.profile_id=assigned.lead_id and m.can_edit and u.organization_id=org)
    or not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id where m.project_id=p_project_id and m.profile_id=assigned.pm_id and m.can_edit and m.project_role='manager' and u.organization_id=org) then code:='current_approver_membership_required';
   elsif actor=req.requester_id then code:='self_approval_denied';
   elsif cmd='verify' and (actor is distinct from assigned.lead_id or req.state<>'submitted') then code:='verification_order_or_assignment_denied';
   elsif cmd='authorize' and (actor is distinct from assigned.pm_id or actor=req.verifier_id or req.state<>'verified' or not inventory_private.manage(p_project_id)) then code:='authorization_order_or_assignment_denied';
   elsif cmd='supply_chain' and (req.state<>'awaiting_supply_chain' or actor is distinct from (annual->'assignment'->>'actor_id')::uuid or actor in (assigned.lead_id,assigned.pm_id,req.verifier_id,req.approver_id) or not inventory_private.finance(p_project_id) or not coalesce((annual->>'eligibleSupplyChain')::boolean,false)) then code:='supply_chain_order_or_assignment_denied';
   elsif cmd='reject' and not ((actor=assigned.lead_id and req.state='submitted') or (actor=assigned.pm_id and req.state='verified' and actor<>req.verifier_id and inventory_private.manage(p_project_id))) then code:='rejection_denied';
   elsif cmd='reject' and length(trim(coalesce(p_command->>'reason','')))=0 then code:='reason_required';
   elsif req.review_token<>inventory_private.token(p_project_id,lid) then code:='review_changed_rebase_required';
   elsif cmd<>'reject' and (lot.readiness<>'ready' or not lot.inspection_accepted) then code:='stock_not_ready';
   elsif cmd<>'reject' and current_count.id is not null and (current_count.lot_version<>lot.version or current_count.counted<>lot.balance) then code:='count_review_required';
   elsif cmd<>'reject' and req.quantity>lot.balance then code:='insufficient_stock';
   else
    if cmd in ('authorize','supply_chain') then
     select * into cost from public.inventory_cost_revisions where lot_id=lid order by version desc limit 1;
     select * into exposure from public.inventory_exposures where id=cost.exposure_id and project_id=p_project_id;
     if exposure.id is null or exposure.funding='unknown' then code:='review_required';
     else
      budget:=inventory_private.budget(p_project_id);
      increment:=case when exposure.funding='new' and not exists(select 1 from public.inventory_exposure_contracts ec join public.inventory_contract_commitments cc on cc.source_id=ec.source_id where ec.exposure_id=exposure.id) and not exists(select 1 from public.inventory_requests r join public.inventory_request_finance rf on rf.request_id=r.id and rf.revision=r.revision where r.project_id=p_project_id and r.state='posted' and rf.exposure_id=exposure.id) then exposure.amount else 0 end;
      forecast:=(budget->>'spent')::numeric+(budget->>'postedNewExposure')::numeric+increment;
      if forecast>(budget->>'adjusted')::numeric then code:='review_required'; end if;
     end if;
     if code is null and annual->>'state' not in ('complete','already_funded') then code:='contract_reconciliation_required'; end if;
     if code is null and coalesce((annual->>'requiresSupplyChain')::boolean,false) then
      if not coalesce((annual->>'eligibleSupplyChain')::boolean,false) or (annual->'assignment'->>'actor_id')::uuid in (req.requester_id,assigned.lead_id,assigned.pm_id) then code:='supply_chain_assignment_required';
      elsif cmd='authorize' then pending_sc:=true;
      end if;
     end if;
     if code is null and not pending_sc then
      if annual->>'state'='complete' and (annual->>'incremental')::numeric>0 then
       insert into public.inventory_contract_commitments(source_id,project_id,request_id,actor_id,operation_id,snapshot)
        values((annual->>'sourceId')::uuid,p_project_id,rid,actor,p_operation_id,annual);
      end if;
      update public.inventory_lots set balance=balance-req.quantity,version=version+1 where id=lid returning * into lot;
      insert into public.inventory_movements(project_id,lot_id,request_id,quantity,kind,actor_id,operation_id) values(p_project_id,lid,rid,-req.quantity,'issue',actor,p_operation_id);
     end if;
    end if;
    if code is null then
     update public.inventory_requests set state=case cmd when 'verify' then 'verified' when 'authorize' then case when pending_sc then 'awaiting_supply_chain' else 'posted' end when 'supply_chain' then 'posted' else 'rejected' end,version=version+1,verifier_id=case when cmd='verify' then actor else verifier_id end,approver_id=case when cmd='authorize' then actor else approver_id end where id=rid returning * into req;
     insert into public.inventory_approval_evidence(project_id,request_id,revision,action,actor_id,operation_id,snapshot)
      values(p_project_id,rid,req.revision,cmd,actor,p_operation_id,annual);
     answer:=jsonb_build_object('ok',true,'requestId',rid,'version',req.version,'balance',lot.balance);
    end if;
   end if;
  else code:='unknown_action';
  end if;
 end if;
 if code is not null then raise exception using errcode='P0002',message=code; end if;
 exception when no_data_found then null;
 when invalid_text_representation or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range or check_violation or not_null_violation or foreign_key_violation or unique_violation then
  code:='invalid_input';rid:=null;answer:=null;
 end;
 if code is not null then
  insert into public.inventory_denials(actor_id,project_id,request_id,operation_id,code) values(actor,p_project_id,rid,p_operation_id,code);
  answer:=jsonb_build_object('error',replace(code,'_',' '),'code',code);
 else
  if cmd in ('submit','revise') then
   insert into public.inventory_approval_evidence(project_id,request_id,revision,action,actor_id,operation_id,snapshot)
    values(p_project_id,rid,req.revision,cmd,actor,p_operation_id,inventory_private.annual(p_project_id,lid));
  end if;
  insert into public.inventory_events(project_id,request_id,actor_id,operation_id,action,previous_state,next_state,revision,reason)
   values(p_project_id,rid,actor,p_operation_id,cmd,old_state,req.state,req.revision,case when cmd in ('reject','cancel','count','revise') then p_command->>'reason' else null end);
 end if;
 insert into public.inventory_receipts(actor_id,operation_id,project_id,digest,result) values(actor,p_operation_id,p_project_id,payload_hash,answer);
 return answer;
end$$;
revoke all on function public.inventory_execute(uuid,uuid,jsonb) from public, anon;
grant execute on function public.inventory_execute(uuid,uuid,jsonb) to authenticated;

