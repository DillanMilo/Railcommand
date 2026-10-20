-- Phase 1: additive, RPC-only material issue pilot. No hosted execution.
-- No seed records, confirmed rates, threshold values or default finance assumptions.
create schema if not exists inventory_private;
revoke all on schema inventory_private from public, anon, authenticated;

create or replace function inventory_private.role(p uuid) returns text
language sql stable security definer set search_path = '' as $$
 select m.project_role::text from public.project_members m
 join public.projects pr on pr.id=m.project_id
 join public.profiles u on u.id=m.profile_id and u.organization_id=pr.organization_id
 where m.project_id=p and m.profile_id=auth.uid()
$$;
create or replace function inventory_private.finance(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(inventory_private.role(p) in ('manager','superintendent','engineer','owner'),false)
$$;
create or replace function inventory_private.manage(p uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce(inventory_private.role(p) in ('manager','superintendent','engineer'),false) and exists(select 1 from public.project_members m where m.project_id=p and m.profile_id=auth.uid() and m.can_edit)
$$;
revoke all on all functions in schema inventory_private from public, anon, authenticated;
-- RLS invokes only these read predicates; their schema is not exposed by PostgREST.
grant usage on schema inventory_private to authenticated;
grant execute on function inventory_private.role(uuid), inventory_private.finance(uuid) to authenticated;

create table public.inventory_materials (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 code text not null, name text not null, unit text not null default 'each' check(unit='each'),
 unique(project_id,code), unique(project_id,id)
);
create table public.inventory_locations (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 name text not null, unique(project_id,name), unique(project_id,id)
);
create table public.inventory_assignments (
 project_id uuid primary key references public.projects(id), lead_id uuid not null references public.profiles(id),
 pm_id uuid not null references public.profiles(id), version integer not null default 1,
 check(lead_id<>pm_id)
);
create table public.inventory_lots (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 material_id uuid not null, location_id uuid not null,
 received_at date, age_source text not null, readiness text not null check(readiness in ('ready','drying','quarantined')),
 inspection_accepted boolean not null default false,
 drying_started_at date, drying_completed_at date, drying_min_months integer not null default 4 check(drying_min_months=4),
 drying_max_months integer not null default 10 check(drying_max_months=10),
 balance integer not null check(balance>=0), version integer not null default 1,
 unique(project_id,id),
 foreign key(project_id,material_id) references public.inventory_materials(project_id,id),
 foreign key(project_id,location_id) references public.inventory_locations(project_id,id)
);
alter table public.change_orders add constraint inventory_co_project_key unique(project_id,id);
alter table public.milestones add constraint inventory_milestone_project_key unique(project_id,id);
create table public.inventory_exposures (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 source_key text not null, funding text not null check(funding in ('funded','committed','new','unknown')),
 amount numeric(14,2) check(amount>=0), source text not null,
 milestone_id uuid, change_order_id uuid,
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(project_id,id), unique(project_id,source_key),
 check(funding<>'new' or amount is not null),
 foreign key(project_id,milestone_id) references public.milestones(project_id,id),
 foreign key(project_id,change_order_id) references public.change_orders(project_id,id)
);
create table public.inventory_cost_revisions (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, lot_id uuid not null,
 version integer not null, components jsonb not null, creosote_oil_reference text,
 exposure_id uuid, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(project_id,lot_id,version), unique(project_id,id),
 foreign key(project_id,lot_id) references public.inventory_lots(project_id,id),
 foreign key(project_id,exposure_id) references public.inventory_exposures(project_id,id)
);
create table public.inventory_configuration (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
 version integer not null, status text not null default 'unconfirmed' check(status='unconfirmed'),
 annual_rate numeric check(annual_rate>=0), storage_daily numeric check(storage_daily>=0),
 threshold_amount numeric check(threshold_amount>=0), currency text, bands jsonb,
 source text not null, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(project_id,version)
);
create table public.inventory_requests (
 id uuid primary key default gen_random_uuid(), number bigint generated always as identity,
 project_id uuid not null, lot_id uuid not null, requester_id uuid not null references public.profiles(id),
 quantity integer not null check(quantity>0), work_location text not null check(length(work_location) between 1 and 240),
 reason text not null check(length(reason) between 1 and 2000),
 state text not null check(state in ('submitted','verified','posted','rejected','cancelled')),
 version integer not null default 1, revision integer not null default 1,
 verifier_id uuid references public.profiles(id), approver_id uuid references public.profiles(id),
 review_token text not null, created_at timestamptz not null default now(),
 unique(project_id,id),
 foreign key(project_id,lot_id) references public.inventory_lots(project_id,id),
 check(verifier_id is null or verifier_id<>requester_id),
 check(approver_id is null or (approver_id<>requester_id and approver_id<>verifier_id))
);
create table public.inventory_request_revisions (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, request_id uuid not null,
 revision integer not null, payload jsonb not null, review_token text not null,
 actor_id uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 unique(request_id,revision), foreign key(project_id,request_id) references public.inventory_requests(project_id,id)
);
create table public.inventory_request_finance (
 request_id uuid not null, revision integer not null, project_id uuid not null,
 cost_revision_id uuid, exposure_id uuid, budget_snapshot jsonb not null,
 primary key(request_id,revision),
 foreign key(project_id,request_id) references public.inventory_requests(project_id,id),
 foreign key(project_id,cost_revision_id) references public.inventory_cost_revisions(project_id,id),
 foreign key(project_id,exposure_id) references public.inventory_exposures(project_id,id)
);
alter table public.inventory_request_finance enable row level security;
revoke all on public.inventory_request_finance from public,anon,authenticated,service_role;
grant select on public.inventory_request_finance to authenticated,service_role;
create policy inventory_request_finance_read on public.inventory_request_finance for select to authenticated using(inventory_private.finance(project_id));
create table public.inventory_events (
 id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), request_id uuid,
 actor_id uuid not null references public.profiles(id), operation_id uuid not null,
 action text not null, previous_state text, next_state text, revision integer, reason text,
 created_at timestamptz not null default now(),
 foreign key(project_id,request_id) references public.inventory_requests(project_id,id)
);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, lot_id uuid not null, request_id uuid unique,
 quantity integer not null check(quantity<>0), kind text not null check(kind in ('opening','issue')),
 actor_id uuid not null references public.profiles(id), operation_id uuid not null,
 created_at timestamptz not null default now(),
 foreign key(project_id,lot_id) references public.inventory_lots(project_id,id),
 foreign key(project_id,request_id) references public.inventory_requests(project_id,id),
 check((kind='opening' and quantity>0 and request_id is null) or (kind='issue' and quantity<0 and request_id is not null))
);
create table public.inventory_counts (
 id uuid primary key default gen_random_uuid(), project_id uuid not null, lot_id uuid not null,
 lot_version integer not null, expected integer not null, counted integer not null check(counted>=0),
 actor_id uuid not null references public.profiles(id), reason text not null, created_at timestamptz not null default now(),
 foreign key(project_id,lot_id) references public.inventory_lots(project_id,id)
);
create table public.inventory_receipts (
 actor_id uuid not null references public.profiles(id), operation_id uuid not null,
 project_id uuid not null references public.projects(id), digest text not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(actor_id,operation_id)
);
create table public.inventory_denials (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id),
 project_id uuid references public.projects(id), request_id uuid, operation_id uuid not null,
 code text not null, created_at timestamptz not null default now(),
 foreign key(project_id,request_id) references public.inventory_requests(project_id,id)
);

alter table public.inventory_materials enable row level security;
revoke all on public.inventory_materials from public, anon, authenticated, service_role;
grant select on public.inventory_materials to authenticated, service_role;
create policy inventory_materials_read on public.inventory_materials for select to authenticated using (inventory_private.role(project_id) is not null);

alter table public.inventory_locations enable row level security;
revoke all on public.inventory_locations from public, anon, authenticated, service_role;
grant select on public.inventory_locations to authenticated, service_role;
create policy inventory_locations_read on public.inventory_locations for select to authenticated using (inventory_private.role(project_id) is not null);

alter table public.inventory_assignments enable row level security;
revoke all on public.inventory_assignments from public, anon, authenticated, service_role;
grant select on public.inventory_assignments to authenticated, service_role;
create policy inventory_assignments_read on public.inventory_assignments for select to authenticated using (inventory_private.role(project_id) is not null);

alter table public.inventory_lots enable row level security;
revoke all on public.inventory_lots from public, anon, authenticated, service_role;
grant select on public.inventory_lots to authenticated, service_role;
create policy inventory_lots_read on public.inventory_lots for select to authenticated using (inventory_private.role(project_id) is not null);

alter table public.inventory_requests enable row level security;
revoke all on public.inventory_requests from public, anon, authenticated, service_role;
grant select on public.inventory_requests to authenticated, service_role;
create policy inventory_requests_read on public.inventory_requests for select to authenticated using (inventory_private.role(project_id) is not null);

alter table public.inventory_request_revisions enable row level security;
revoke all on public.inventory_request_revisions from public, anon, authenticated, service_role;
grant select on public.inventory_request_revisions to authenticated, service_role;
create policy inventory_request_revisions_read on public.inventory_request_revisions for select to authenticated using (inventory_private.role(project_id) is not null);

alter table public.inventory_events enable row level security;
revoke all on public.inventory_events from public, anon, authenticated, service_role;
grant select on public.inventory_events to authenticated, service_role;
create policy inventory_events_read on public.inventory_events for select to authenticated using (inventory_private.role(project_id) is not null and (action not in ('cost','configuration') or inventory_private.finance(project_id)));

alter table public.inventory_movements enable row level security;
revoke all on public.inventory_movements from public, anon, authenticated, service_role;
grant select on public.inventory_movements to authenticated, service_role;
create policy inventory_movements_read on public.inventory_movements for select to authenticated using (inventory_private.role(project_id) is not null);

alter table public.inventory_counts enable row level security;
revoke all on public.inventory_counts from public, anon, authenticated, service_role;
grant select on public.inventory_counts to authenticated, service_role;
create policy inventory_counts_read on public.inventory_counts for select to authenticated using (inventory_private.role(project_id) is not null);

alter table public.inventory_exposures enable row level security;
revoke all on public.inventory_exposures from public, anon, authenticated, service_role;
grant select on public.inventory_exposures to authenticated, service_role;
create policy inventory_exposures_read on public.inventory_exposures for select to authenticated using (inventory_private.finance(project_id));

alter table public.inventory_cost_revisions enable row level security;
revoke all on public.inventory_cost_revisions from public, anon, authenticated, service_role;
grant select on public.inventory_cost_revisions to authenticated, service_role;
create policy inventory_cost_revisions_read on public.inventory_cost_revisions for select to authenticated using (inventory_private.finance(project_id));

alter table public.inventory_configuration enable row level security;
revoke all on public.inventory_configuration from public, anon, authenticated, service_role;
grant select on public.inventory_configuration to authenticated, service_role;
create policy inventory_configuration_read on public.inventory_configuration for select to authenticated using (inventory_private.finance(project_id));

alter table public.inventory_receipts enable row level security;
revoke all on public.inventory_receipts from public, anon, authenticated, service_role;
grant select on public.inventory_receipts to authenticated, service_role;
create policy inventory_receipts_read on public.inventory_receipts for select to authenticated using (actor_id=auth.uid() and inventory_private.role(project_id) is not null);

alter table public.inventory_denials enable row level security;
revoke all on public.inventory_denials from public, anon, authenticated, service_role;
grant select on public.inventory_denials to authenticated, service_role;
create policy inventory_denials_read on public.inventory_denials for select to authenticated using (actor_id=auth.uid() or (inventory_private.role(project_id) is not null and project_id is not null));

create index inventory_requests_project on public.inventory_requests(project_id,created_at);
create index inventory_lots_project on public.inventory_lots(project_id);
create index inventory_events_request on public.inventory_events(project_id,request_id,created_at);
create index inventory_counts_lot on public.inventory_counts(lot_id,created_at);
create index inventory_costs_lot on public.inventory_cost_revisions(lot_id,version);
create index inventory_exposures_project on public.inventory_exposures(project_id);
create or replace function inventory_private.immutable() returns trigger
language plpgsql set search_path = '' as $$begin raise exception 'Append-only inventory evidence' using errcode='42501'; end$$;
create trigger inventory_exposures_immutable before update or delete on public.inventory_exposures for each row execute function inventory_private.immutable();
create trigger inventory_cost_revisions_immutable before update or delete on public.inventory_cost_revisions for each row execute function inventory_private.immutable();
create trigger inventory_configuration_immutable before update or delete on public.inventory_configuration for each row execute function inventory_private.immutable();
create trigger inventory_request_revisions_immutable before update or delete on public.inventory_request_revisions for each row execute function inventory_private.immutable();
create trigger inventory_events_immutable before update or delete on public.inventory_events for each row execute function inventory_private.immutable();
create trigger inventory_movements_immutable before update or delete on public.inventory_movements for each row execute function inventory_private.immutable();
create trigger inventory_counts_immutable before update or delete on public.inventory_counts for each row execute function inventory_private.immutable();
create trigger inventory_receipts_immutable before update or delete on public.inventory_receipts for each row execute function inventory_private.immutable();
create trigger inventory_denials_immutable before update or delete on public.inventory_denials for each row execute function inventory_private.immutable();

create trigger inventory_request_finance_immutable before update or delete on public.inventory_request_finance for each row execute function inventory_private.immutable();

create or replace function inventory_private.budget(p uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('base',pr.budget_total,'spent',pr.budget_spent,
  'changeOrders',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'number',c.number,'amount',c.amount,'status',c.status,'signed',c.approved_by is not null and c.approval_date is not null) order by c.id) from public.change_orders c where c.project_id=p),'[]'::jsonb),
  'adjusted',pr.budget_total+coalesce((select sum(c.amount) from public.change_orders c where c.project_id=p and c.status='approved' and c.approved_by is not null and c.approval_date is not null),0),
  'postedSourceIds',coalesce((select jsonb_agg(distinct rf.exposure_id order by rf.exposure_id) from public.inventory_request_finance rf join public.inventory_requests r on r.id=rf.request_id and r.revision=rf.revision where r.project_id=p and r.state='posted'),'[]'::jsonb),
  'postedNewExposure',coalesce((select sum(e.amount) from public.inventory_exposures e where e.project_id=p and e.funding='new' and exists(select 1 from public.inventory_requests r join public.inventory_request_finance rf on rf.request_id=r.id and rf.revision=r.revision where r.project_id=p and r.state='posted' and rf.exposure_id=e.id)),0))
 from public.projects pr where pr.id=p
$$;
create or replace function inventory_private.token(p uuid,l uuid) returns text
language sql stable security definer set search_path = '' as $$
 select encode(sha256(convert_to(jsonb_build_object('budget',inventory_private.budget(p),
  'lot',(select to_jsonb(lot) from public.inventory_lots lot where lot.id=l and lot.project_id=p),
  'cost',(select to_jsonb(c) from public.inventory_cost_revisions c where c.project_id=p and c.lot_id=l order by c.version desc limit 1),
  'configuration',(select to_jsonb(c) from public.inventory_configuration c where c.project_id=p order by c.version desc limit 1),
  'assignment',(select to_jsonb(a) from public.inventory_assignments a where a.project_id=p))::text,'UTF8')),'hex')
$$;
create or replace function public.inventory_read(p_project_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare role_name text; result jsonb; financial jsonb;
begin
 role_name:=inventory_private.role(p_project_id);
 if role_name is null then return jsonb_build_object('error','Project access required'); end if;
 result:=jsonb_build_object('projectId',p_project_id,'asOf',now(),'canManage',inventory_private.manage(p_project_id),
 'actors',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',coalesce(nullif(u.full_name,''),u.email,u.id::text),'role',m.project_role) order by u.id) from public.project_members m join public.profiles u on u.id=m.profile_id join public.projects pr on pr.id=m.project_id and pr.organization_id=u.organization_id where m.project_id=p_project_id),'[]'::jsonb),
 'assignments',(select to_jsonb(a) from public.inventory_assignments a where a.project_id=p_project_id),
 'lots',coalesce((select jsonb_agg(to_jsonb(l)||jsonb_build_object('material',m.name,'yard',s.name,'condition',case when l.received_at is null then 'unknown_age' when current_date-l.received_at>=60 then 'aged' else 'current' end,
 'latestCount',(select to_jsonb(c) from public.inventory_counts c where c.lot_id=l.id order by c.created_at desc,c.id desc limit 1))) from public.inventory_lots l join public.inventory_materials m on m.id=l.material_id join public.inventory_locations s on s.id=l.location_id where l.project_id=p_project_id),'[]'::jsonb),
 'requests',coalesce((select jsonb_agg(to_jsonb(r)-'review_token' order by r.created_at desc) from public.inventory_requests r where r.project_id=p_project_id),'[]'::jsonb),
 'revisions',coalesce((select jsonb_agg(to_jsonb(rv)-'review_token' order by rv.created_at,rv.revision) from public.inventory_request_revisions rv where rv.project_id=p_project_id),'[]'::jsonb),
 'events',coalesce((select jsonb_agg((case when inventory_private.finance(p_project_id) then to_jsonb(e) else to_jsonb(e)-'reason' end) order by e.created_at desc,e.id desc) from public.inventory_events e where e.project_id=p_project_id and (e.action not in ('cost','configuration') or inventory_private.finance(p_project_id))),'[]'::jsonb),
 'denials',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.inventory_denials d where d.project_id=p_project_id),'[]'::jsonb));
 if inventory_private.finance(p_project_id) then
  financial:=jsonb_build_object('budget',inventory_private.budget(p_project_id),
   'costs',coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.inventory_cost_revisions c where c.project_id=p_project_id),'[]'::jsonb),
   'sources',coalesce((select jsonb_agg(to_jsonb(e)) from public.inventory_exposures e where e.project_id=p_project_id),'[]'::jsonb),
   'configuration',(select to_jsonb(c) from public.inventory_configuration c where c.project_id=p_project_id order by c.version desc limit 1),
   'milestones',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'name',m.name)) from public.milestones m where m.project_id=p_project_id),'[]'::jsonb),
   'requestSnapshots',coalesce((select jsonb_agg(to_jsonb(rf) order by rf.request_id,rf.revision) from public.inventory_request_finance rf where rf.project_id=p_project_id),'[]'::jsonb),
   'evaluation','incomplete_awaiting_wendy');
  result:=result||jsonb_build_object('finance',financial);
 end if;
 return result;
end$$;
revoke all on function public.inventory_read(uuid) from public, anon;
grant execute on function public.inventory_read(uuid) to authenticated;

-- Returning denials (rather than raising) keeps the denial evidence committed.
-- Foreign probes retain only the caller/operation and a generic code.
create or replace function public.inventory_execute(p_project_id uuid,p_operation_id uuid,p_command jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 actor uuid:=auth.uid(); role_name text; cmd text:=p_command->>'action'; payload_hash text;
 previous public.inventory_receipts; lot public.inventory_lots; req public.inventory_requests;
 assigned public.inventory_assignments; current_count public.inventory_counts;
 cost public.inventory_cost_revisions; exposure public.inventory_exposures;
 rid uuid; lid uuid; mid uuid; sid uuid; qty integer; old_state text; code text;
 answer jsonb; budget jsonb; forecast numeric; increment numeric; version_no integer; components jsonb;
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
 -- All feature mutations lock project -> lot -> request, including source revisions.
 perform 1 from public.projects where id=p_project_id for update;
 perform 1 from public.change_orders where project_id=p_project_id for share;
 select * into assigned from public.inventory_assignments where project_id=p_project_id;
 if cmd='assign' then
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
     if code is null then
      insert into public.inventory_cost_revisions(project_id,lot_id,version,components,creosote_oil_reference,exposure_id,created_by)
       values(p_project_id,lid,cost.version+1,components,p_command->>'creosoteOilReference',mid,actor);
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
  elsif cmd in ('verify','authorize','reject') then
   old_state:=req.state;
   if actor=req.requester_id then code:='self_approval_denied';
   elsif cmd='verify' and (actor is distinct from assigned.lead_id or req.state<>'submitted') then code:='verification_order_or_assignment_denied';
   elsif cmd='authorize' and (actor is distinct from assigned.pm_id or actor=req.verifier_id or req.state<>'verified' or not inventory_private.manage(p_project_id)) then code:='authorization_order_or_assignment_denied';
   elsif cmd='reject' and not ((actor=assigned.lead_id and req.state='submitted') or (actor=assigned.pm_id and req.state='verified' and actor<>req.verifier_id and inventory_private.manage(p_project_id))) then code:='rejection_denied';
   elsif cmd='reject' and length(trim(coalesce(p_command->>'reason','')))=0 then code:='reason_required';
   elsif req.review_token<>inventory_private.token(p_project_id,lid) then code:='review_changed_rebase_required';
   elsif cmd<>'reject' and (lot.readiness<>'ready' or not lot.inspection_accepted) then code:='stock_not_ready';
   elsif cmd<>'reject' and current_count.id is not null and (current_count.lot_version<>lot.version or current_count.counted<>lot.balance) then code:='count_review_required';
   elsif cmd<>'reject' and req.quantity>lot.balance then code:='insufficient_stock';
   else
    if cmd='authorize' then
     select * into cost from public.inventory_cost_revisions where lot_id=lid order by version desc limit 1;
     select * into exposure from public.inventory_exposures where id=cost.exposure_id and project_id=p_project_id;
     if exposure.id is null or exposure.funding='unknown' then code:='review_required';
     else
      budget:=inventory_private.budget(p_project_id);
      increment:=case when exposure.funding='new' and not exists(select 1 from public.inventory_requests r join public.inventory_request_finance rf on rf.request_id=r.id and rf.revision=r.revision where r.project_id=p_project_id and r.state='posted' and rf.exposure_id=exposure.id) then exposure.amount else 0 end;
      forecast:=(budget->>'spent')::numeric+(budget->>'postedNewExposure')::numeric+increment;
      if forecast>(budget->>'adjusted')::numeric then code:='review_required'; end if;
     end if;
     if code is null then
      update public.inventory_lots set balance=balance-req.quantity,version=version+1 where id=lid returning * into lot;
      insert into public.inventory_movements(project_id,lot_id,request_id,quantity,kind,actor_id,operation_id) values(p_project_id,lid,rid,-req.quantity,'issue',actor,p_operation_id);
     end if;
    end if;
    if code is null then
     update public.inventory_requests set state=case cmd when 'verify' then 'verified' when 'authorize' then 'posted' else 'rejected' end,version=version+1,verifier_id=case when cmd='verify' then actor else verifier_id end,approver_id=case when cmd='authorize' then actor else approver_id end where id=rid returning * into req;
     answer:=jsonb_build_object('ok',true,'requestId',rid,'version',req.version,'balance',lot.balance);
    end if;
   end if;
  else code:='unknown_action';
  end if;
 end if;
 exception when invalid_text_representation or numeric_value_out_of_range or check_violation or not_null_violation or foreign_key_violation or unique_violation then
  code:='invalid_input';rid:=null;answer:=null;
 end;
 if code is not null then
  insert into public.inventory_denials(actor_id,project_id,request_id,operation_id,code) values(actor,p_project_id,rid,p_operation_id,code);
  answer:=jsonb_build_object('error',replace(code,'_',' '),'code',code);
 else
  insert into public.inventory_events(project_id,request_id,actor_id,operation_id,action,previous_state,next_state,revision,reason)
   values(p_project_id,rid,actor,p_operation_id,cmd,old_state,req.state,req.revision,case when cmd in ('reject','cancel','count','revise') then p_command->>'reason' else null end);
 end if;
 insert into public.inventory_receipts(actor_id,operation_id,project_id,digest,result) values(actor,p_operation_id,p_project_id,payload_hash,answer);
 return answer;
end$$;
revoke all on function public.inventory_execute(uuid,uuid,jsonb) from public, anon;
grant execute on function public.inventory_execute(uuid,uuid,jsonb) to authenticated;
create or replace function public.inventory_receipt(p_project_id uuid,p_operation_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select result from public.inventory_receipts where actor_id=auth.uid() and project_id=p_project_id and operation_id=p_operation_id and inventory_private.role(p_project_id) is not null
$$;
revoke all on function public.inventory_receipt(uuid,uuid) from public, anon;
grant execute on function public.inventory_receipt(uuid,uuid) to authenticated;
revoke all on function inventory_private.budget(uuid),inventory_private.token(uuid,uuid),inventory_private.manage(uuid),inventory_private.immutable() from public,anon,authenticated;

-- Column grants make legacy financial values inaccessible to direct field clients.
revoke select on public.projects from authenticated, anon;
grant select(id,name,description,status,start_date,target_end_date,actual_end_date,location,client,created_by,created_at,updated_at,organization_id,turnover_date,substantial_completion_date,project_completion_date) on public.projects to authenticated;
revoke select on public.milestones from authenticated, anon;
grant select(id,project_id,name,description,target_date,actual_date,status,percent_complete,sort_order,created_at,updated_at) on public.milestones to authenticated;

-- Restrictive policy composes with existing membership policies; does not widen them.
create policy inventory_co_finance_boundary on public.change_orders as restrictive for select to authenticated using(inventory_private.finance(project_id));
create or replace function public.project_finance(p_project_id uuid)
returns table(id uuid,budget_total numeric,budget_spent numeric)
language sql stable security definer set search_path = '' as $$
 select p.id,p.budget_total,p.budget_spent from public.projects p where p.id=p_project_id and inventory_private.finance(p.id)
$$;
revoke all on function public.project_finance(uuid) from public,anon;
grant execute on function public.project_finance(uuid) to authenticated;
create or replace function public.milestone_finance(p_project_id uuid)
returns table(id uuid,budget_planned numeric,budget_actual numeric,percent_complete numeric)
language sql stable security definer set search_path = '' as $$
 select m.id,m.budget_planned,m.budget_actual,m.percent_complete from public.milestones m where m.project_id=p_project_id and inventory_private.finance(p_project_id)
$$;
revoke all on function public.milestone_finance(uuid) from public,anon;
grant execute on function public.milestone_finance(uuid) to authenticated;

revoke select on public.change_orders from anon;
create policy inventory_activity_finance_boundary on public.activity_log as restrictive for select to authenticated using(not(entity_type='change_order' or (entity_type='project' and description ilike '%change order%')) or inventory_private.finance(project_id));

-- Rejection reasons may contain commercial details. Field clients receive the
-- safe event shape; authorized readers obtain the full reason via inventory_read.
revoke select on public.inventory_events from authenticated;
grant select(id,project_id,request_id,actor_id,operation_id,action,previous_state,next_state,revision,created_at) on public.inventory_events to authenticated;

revoke select on public.inventory_request_revisions from authenticated;
grant select(id,project_id,request_id,revision,payload,actor_id,created_at) on public.inventory_request_revisions to authenticated;
