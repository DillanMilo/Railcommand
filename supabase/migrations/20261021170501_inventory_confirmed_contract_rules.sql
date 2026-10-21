-- Confirmed organization defaults and cross-project annual contract authority.
-- Additive; apply only after reviewed rollout. No proposal value is activated.
alter table public.inventory_cost_revisions add column annual_rate_override numeric check(annual_rate_override between 0 and 1);
create table public.inventory_org_policy (
 organization_id uuid not null references public.organizations(id), version integer not null,
 annual_rate numeric not null check(annual_rate between 0 and 1),
 threshold_amount numeric(14,2) not null check(threshold_amount>=0),
 currency text not null check(currency ~ '^[A-Z]{3}$'),
 period_convention text not null default 'contract_year' check(period_convention='contract_year'),
 spend_basis text not null default 'approved_commitments_plus_proposed' check(spend_basis='approved_commitments_plus_proposed'),
 source text not null check(length(trim(source))>0), created_by uuid references public.profiles(id),
 created_at timestamptz not null default now(), primary key(organization_id,version)
);
create table public.inventory_contracts (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 contract_key text not null check(length(trim(contract_key)) between 1 and 120),
 start_date date not null, name text not null check(length(trim(name)) between 1 and 240), created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), unique(organization_id,contract_key), unique(organization_id,id)
);
create table public.inventory_contract_baselines (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, contract_id uuid not null,
 period_year integer not null check(period_year between 2000 and 2200), currency text not null check(currency ~ '^[A-Z]{3}$'),
 version integer not null, amount numeric(14,2) not null check(amount>=0),
 evidence text not null check(length(trim(evidence)) between 1 and 2000),
 -- Baseline is external approved commitments, EXCLUDING every source tracked here.
 verified_by uuid not null references public.profiles(id), verified_at timestamptz not null default now(),
 foreign key(organization_id,contract_id) references public.inventory_contracts(organization_id,id),
 unique(contract_id,period_year,currency,version)
);
create table public.inventory_contract_sources (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, contract_id uuid not null,
 period_year integer not null check(period_year between 2000 and 2200), currency text not null check(currency ~ '^[A-Z]{3}$'),
 source_key text not null check(length(trim(source_key)) between 1 and 120), amount numeric(14,2) not null check(amount>=0),
 evidence text not null check(length(trim(evidence)) between 1 and 2000),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 foreign key(organization_id,contract_id) references public.inventory_contracts(organization_id,id),
 unique(contract_id,period_year,currency,source_key), unique(organization_id,id)
);
create table public.inventory_exposure_contracts (
 exposure_id uuid primary key references public.inventory_exposures(id), source_id uuid not null references public.inventory_contract_sources(id),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.inventory_contract_commitments (
 source_id uuid primary key references public.inventory_contract_sources(id),
 project_id uuid not null references public.projects(id), request_id uuid not null references public.inventory_requests(id),
 actor_id uuid not null references public.profiles(id), operation_id uuid not null,
 snapshot jsonb not null, created_at timestamptz not null default now()
);
create table public.inventory_supply_chain_assignments (
 project_id uuid not null references public.projects(id), version integer not null,
 actor_id uuid not null references public.profiles(id), assigned_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), primary key(project_id,version)
);
create table public.inventory_approval_evidence (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 request_id uuid not null references public.inventory_requests(id), revision integer not null, action text not null,
 actor_id uuid not null references public.profiles(id), operation_id uuid not null,
 snapshot jsonb not null, created_at timestamptz not null default now()
);
alter table public.inventory_org_policy enable row level security;
revoke all on public.inventory_org_policy from public, anon, authenticated, service_role;
grant select on public.inventory_org_policy to service_role;
create trigger inventory_org_policy_immutable before update or delete on public.inventory_org_policy for each row execute function inventory_private.immutable();
alter table public.inventory_contracts enable row level security;
revoke all on public.inventory_contracts from public, anon, authenticated, service_role;
grant select on public.inventory_contracts to service_role;
create trigger inventory_contracts_immutable before update or delete on public.inventory_contracts for each row execute function inventory_private.immutable();
alter table public.inventory_contract_baselines enable row level security;
revoke all on public.inventory_contract_baselines from public, anon, authenticated, service_role;
grant select on public.inventory_contract_baselines to service_role;
create trigger inventory_contract_baselines_immutable before update or delete on public.inventory_contract_baselines for each row execute function inventory_private.immutable();
alter table public.inventory_contract_sources enable row level security;
revoke all on public.inventory_contract_sources from public, anon, authenticated, service_role;
grant select on public.inventory_contract_sources to service_role;
create trigger inventory_contract_sources_immutable before update or delete on public.inventory_contract_sources for each row execute function inventory_private.immutable();
alter table public.inventory_exposure_contracts enable row level security;
revoke all on public.inventory_exposure_contracts from public, anon, authenticated, service_role;
grant select on public.inventory_exposure_contracts to service_role;
create trigger inventory_exposure_contracts_immutable before update or delete on public.inventory_exposure_contracts for each row execute function inventory_private.immutable();
alter table public.inventory_contract_commitments enable row level security;
revoke all on public.inventory_contract_commitments from public, anon, authenticated, service_role;
grant select on public.inventory_contract_commitments to service_role;
create trigger inventory_contract_commitments_immutable before update or delete on public.inventory_contract_commitments for each row execute function inventory_private.immutable();
alter table public.inventory_supply_chain_assignments enable row level security;
revoke all on public.inventory_supply_chain_assignments from public, anon, authenticated, service_role;
grant select on public.inventory_supply_chain_assignments to service_role;
create trigger inventory_supply_chain_assignments_immutable before update or delete on public.inventory_supply_chain_assignments for each row execute function inventory_private.immutable();
alter table public.inventory_approval_evidence enable row level security;
revoke all on public.inventory_approval_evidence from public, anon, authenticated, service_role;
grant select on public.inventory_approval_evidence to service_role;
create trigger inventory_approval_evidence_immutable before update or delete on public.inventory_approval_evidence for each row execute function inventory_private.immutable();

create or replace function inventory_private.default_policy() returns trigger
language plpgsql security definer set search_path = '' as $$begin
 insert into public.inventory_org_policy(organization_id,version,annual_rate,threshold_amount,currency,source)
 values(new.id,1,0.05,50000,'USD','Wendy-confirmed 2026-10-21; annual ACT/365; contract-year approved commitments plus request; ACT/365; Feb29 anniversary uses Feb28 in non-leap years');
 return new;
end$$;
revoke all on function inventory_private.default_policy() from public,anon,authenticated;
insert into public.inventory_org_policy(organization_id,version,annual_rate,threshold_amount,currency,source)
 select id,1,0.05,50000,'USD','Wendy-confirmed 2026-10-21; annual ACT/365; contract-year approved commitments plus request; ACT/365; Feb29 anniversary uses Feb28 in non-leap years' from public.organizations;
create trigger inventory_org_policy_default after insert on public.organizations for each row execute function inventory_private.default_policy();

alter table public.inventory_requests drop constraint inventory_requests_state_check;
alter table public.inventory_requests add constraint inventory_requests_state_check check(state in ('submitted','verified','awaiting_supply_chain','posted','rejected','cancelled'));
-- Supply Chain identity and private accounting live only in the finance projection.
-- Field clients see a plain waiting state and no financial routing evidence.


alter function inventory_private.token(uuid,uuid) rename to token_phase_one;
alter function public.inventory_read(uuid) rename to inventory_read_phase_one;
alter function public.inventory_read_phase_one(uuid) set schema inventory_private;
revoke all on function inventory_private.inventory_read_phase_one(uuid) from public,anon,authenticated;

-- Anniversary dates are UTC business dates; Feb29 clamps to Feb28 in non-leap years.
create or replace function inventory_private.anniversary(d date,y integer) returns date
language sql immutable set search_path = '' as $$
 select make_date(y,extract(month from d)::integer,least(extract(day from d)::integer,extract(day from (make_date(y,extract(month from d)::integer,1)+interval '1 month - 1 day'))::integer))
$$;
revoke all on function inventory_private.anniversary(date,integer) from public,anon,authenticated;
create or replace function inventory_private.contract_period_start(d date,at_date date) returns date
language sql immutable set search_path = '' as $$
 select inventory_private.anniversary(d,extract(year from at_date)::integer-case when inventory_private.anniversary(d,extract(year from at_date)::integer)>at_date then 1 else 0 end)
$$;
revoke all on function inventory_private.contract_period_start(date,date) from public,anon,authenticated;
create or replace function inventory_private.annual(p uuid,l uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare org uuid; e public.inventory_exposures; s public.inventory_contract_sources; pol public.inventory_org_policy;
 b public.inventory_contract_baselines; total numeric; inc numeric; evidence jsonb; sc public.inventory_supply_chain_assignments; eligible boolean; yr integer; ct public.inventory_contracts; period_start date; period_end date;
begin
 select organization_id into org from public.projects where id=p;
 select * into pol from public.inventory_org_policy where organization_id=org order by version desc limit 1;
 select e0.* into e from public.inventory_cost_revisions c join public.inventory_exposures e0 on e0.id=c.exposure_id where c.project_id=p and c.lot_id=l order by c.version desc limit 1;
 if e.funding in ('funded','committed') then
  return jsonb_build_object('state','already_funded','incremental',0,'requiresSupplyChain',false,'policy',to_jsonb(pol));
 end if;
 select cs.* into s from public.inventory_exposure_contracts ec join public.inventory_contract_sources cs on cs.id=ec.source_id where ec.exposure_id=e.id and cs.organization_id=org;
 if e.id is null or e.funding<>'new' or s.id is null or pol.organization_id is null or s.currency<>pol.currency then
  return jsonb_build_object('state','reconciliation_required','requiresSupplyChain',null,'policy',to_jsonb(pol));
 end if;
 select * into ct from public.inventory_contracts where id=s.contract_id and organization_id=org;
 if ct.start_date is null or current_date<ct.start_date then return jsonb_build_object('state','period_review_required','policy',to_jsonb(pol)); end if;
 period_start:=inventory_private.contract_period_start(ct.start_date,current_date);
 yr:=extract(year from period_start)::integer;
 period_end:=inventory_private.anniversary(ct.start_date,yr+1);
 if s.period_year<>yr then return jsonb_build_object('state','period_review_required','policy',to_jsonb(pol)); end if;
 select * into b from public.inventory_contract_baselines where contract_id=s.contract_id and period_year=s.period_year and currency=s.currency order by version desc limit 1;
 select coalesce(sum(cs.amount),0),coalesce(jsonb_agg(jsonb_build_object('sourceId',cs.id,'sourceKey',cs.source_key,'amount',cs.amount,'evidence',cs.evidence,'projectId',c.project_id,'requestId',c.request_id,'actorId',c.actor_id,'createdAt',c.created_at) order by cs.id),'[]'::jsonb)
 into total,evidence from public.inventory_contract_commitments c join public.inventory_contract_sources cs on cs.id=c.source_id where cs.contract_id=s.contract_id and cs.period_year=s.period_year and cs.currency=s.currency;
 inc:=case when exists(select 1 from public.inventory_contract_commitments where source_id=s.id) then 0 else s.amount end;
 select * into sc from public.inventory_supply_chain_assignments where project_id=p order by version desc limit 1;
 eligible:=exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id where m.project_id=p and m.profile_id=sc.actor_id and m.can_edit and m.project_role in ('manager','superintendent','engineer') and u.organization_id=org);
 return jsonb_build_object('state',case when b.id is null then 'reconciliation_required' else 'complete' end,
  'contractId',s.contract_id,'periodYear',s.period_year,'periodStart',period_start,'periodEndExclusive',period_end,'currency',s.currency,'sourceId',s.id,'sourceKey',s.source_key,'proposedSource',jsonb_build_object('sourceId',s.id,'sourceKey',s.source_key,'amount',s.amount,'evidence',s.evidence,'projectId',p,'actorId',s.created_by),
  'policy',to_jsonb(pol),'baseline',to_jsonb(b),'committed',total,'incremental',inc,'forecast',b.amount+total+inc,'sources',evidence,
  'requiresSupplyChain',b.id is not null and inc>0 and b.amount+total+inc>pol.threshold_amount,
  'assignment',to_jsonb(sc),'eligibleSupplyChain',eligible,
  'likelySplit',b.id is not null and b.amount+total+inc>pol.threshold_amount and
   (select count(*)>=2 and sum(cs.amount)>pol.threshold_amount from public.inventory_contract_sources cs where cs.contract_id=s.contract_id and cs.period_year=s.period_year and cs.currency=s.currency and cs.amount>0 and cs.amount<=pol.threshold_amount and (cs.id=s.id or exists(select 1 from public.inventory_contract_commitments c where c.source_id=cs.id))));
end$$;
revoke all on function inventory_private.annual(uuid,uuid) from public,anon,authenticated;
create or replace function inventory_private.token(p uuid,l uuid) returns text
language sql stable security definer set search_path = '' as $$
 select encode(sha256(convert_to(jsonb_build_object('phaseOne',inventory_private.token_phase_one(p,l),'annual',inventory_private.annual(p,l))::text,'UTF8')),'hex')
$$;
revoke all on function inventory_private.token(uuid,uuid),inventory_private.token_phase_one(uuid,uuid) from public,anon,authenticated;

create or replace function public.inventory_read(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; org uuid; f jsonb;
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
 f:=jsonb_build_object(
  'policy',(select to_jsonb(c) from public.inventory_org_policy c where c.organization_id=org order by version desc limit 1),
  'policyHistory',coalesce((select jsonb_agg(to_jsonb(c) order by version desc) from public.inventory_org_policy c where organization_id=org),'[]'::jsonb),
  'contracts',coalesce((select jsonb_agg(to_jsonb(c) order by c.contract_key) from public.inventory_contracts c where organization_id=org),'[]'::jsonb),
  'baselines',coalesce((select jsonb_agg(to_jsonb(c) order by c.verified_at desc) from public.inventory_contract_baselines c where organization_id=org),'[]'::jsonb),
  'contractSources',coalesce((select jsonb_agg(to_jsonb(c)) from public.inventory_contract_sources c where organization_id=org),'[]'::jsonb),
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
 perform 1 from public.profiles where organization_id=org for share;
 perform 1 from public.change_orders where project_id=p_project_id for share;
 select * into assigned from public.inventory_assignments where project_id=p_project_id;
 if cmd='policy' then
  if not inventory_private.manage(p_project_id) then code:='configuration_denied';
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
  if not inventory_private.manage(p_project_id) then code:='assignment_denied';
  elsif coalesce(sc.version,0) is distinct from (p_command->>'expectedVersion')::integer then code:='stale_assignment';
  elsif (p_command->>'supplyChainId')::uuid in (assigned.lead_id,assigned.pm_id) or not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id where m.project_id=p_project_id and m.profile_id=(p_command->>'supplyChainId')::uuid and m.can_edit and m.project_role in ('manager','superintendent','engineer') and u.organization_id=org) then code:='distinct_eligible_supply_chain_required';
  else
   insert into public.inventory_supply_chain_assignments(project_id,version,actor_id,assigned_by) values(p_project_id,coalesce(sc.version,0)+1,(p_command->>'supplyChainId')::uuid,actor);
   answer:=jsonb_build_object('ok',true);
  end if;
 elsif cmd='assign' then
  if not inventory_private.manage(p_project_id) then code:='assignment_denied';
  elsif not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id join public.projects p on p.id=m.project_id and p.organization_id=u.organization_id where m.project_id=p_project_id and m.profile_id=(p_command->>'leadId')::uuid)
   or not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id join public.projects p on p.id=m.project_id and p.organization_id=u.organization_id where m.project_id=p_project_id and m.profile_id=(p_command->>'pmId')::uuid and m.project_role in ('manager','superintendent','engineer'))
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
       values(p_project_id,lid,cost.version+1,components,nullif(p_command->>'annualRateOverride','')::numeric,p_command->>'creosoteOilReference',mid,actor);
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
    or not exists(select 1 from public.project_members m join public.profiles u on u.id=m.profile_id where m.project_id=p_project_id and m.profile_id=assigned.pm_id and m.can_edit and m.project_role in ('manager','superintendent','engineer') and u.organization_id=org) then code:='current_approver_membership_required';
   elsif actor=req.requester_id then code:='self_approval_denied';
   elsif cmd='verify' and (actor is distinct from assigned.lead_id or req.state<>'submitted') then code:='verification_order_or_assignment_denied';
   elsif cmd='authorize' and (actor is distinct from assigned.pm_id or actor=req.verifier_id or req.state<>'verified' or not inventory_private.manage(p_project_id)) then code:='authorization_order_or_assignment_denied';
   elsif cmd='supply_chain' and (req.state<>'awaiting_supply_chain' or actor is distinct from (annual->'assignment'->>'actor_id')::uuid or actor in (assigned.lead_id,assigned.pm_id,req.verifier_id,req.approver_id) or not inventory_private.manage(p_project_id) or not coalesce((annual->>'eligibleSupplyChain')::boolean,false)) then code:='supply_chain_order_or_assignment_denied';
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
drop policy inventory_events_read on public.inventory_events;
create policy inventory_events_read on public.inventory_events for select to authenticated using(inventory_private.role(project_id) is not null and (action in ('assign','opening','count','submit','revise','cancel','verify','authorize','reject','supply_chain') or inventory_private.finance(project_id)));

-- Project budget recognizes a canonical contract commitment only in the project
-- that committed it. Reusing the financial source elsewhere never buys it again.
create or replace function inventory_private.budget(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('base',pr.budget_total,'spent',pr.budget_spent,
  'changeOrders',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'number',c.number,'amount',c.amount,'status',c.status,'signed',c.approved_by is not null and c.approval_date is not null) order by c.id) from public.change_orders c where c.project_id=p),'[]'::jsonb),
  'adjusted',pr.budget_total+coalesce((select sum(c.amount) from public.change_orders c where c.project_id=p and c.status='approved' and c.approved_by is not null and c.approval_date is not null),0),
  'postedSourceIds',coalesce((select jsonb_agg(e.id order by e.id) from public.inventory_exposures e where e.project_id=p and (exists(select 1 from public.inventory_exposure_contracts ec join public.inventory_contract_commitments cc on cc.source_id=ec.source_id where ec.exposure_id=e.id) or exists(select 1 from public.inventory_request_finance rf join public.inventory_requests r on r.id=rf.request_id and r.revision=rf.revision where r.state='posted' and rf.exposure_id=e.id))),'[]'::jsonb),
  'postedNewExposure',coalesce((select sum(e.amount) from public.inventory_exposures e where e.project_id=p and e.funding='new' and not exists(select 1 from public.inventory_exposure_contracts ec where ec.exposure_id=e.id) and exists(select 1 from public.inventory_requests r join public.inventory_request_finance rf on rf.request_id=r.id and rf.revision=r.revision where r.project_id=p and r.state='posted' and rf.exposure_id=e.id)),0)+coalesce((select sum(cs.amount) from public.inventory_contract_commitments cc join public.inventory_contract_sources cs on cs.id=cc.source_id where cc.project_id=p),0))
 from public.projects pr where pr.id=p
$$;
revoke all on function inventory_private.budget(uuid) from public,anon,authenticated;
