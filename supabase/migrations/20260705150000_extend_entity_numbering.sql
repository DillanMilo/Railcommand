-- Extend atomic entity numbering to all remaining numbered tables.
--
-- Prod already has assign_entity_number() + entity_number_sequences + unique
-- (project_id, number) indexes for submittals / rfis / punch_list_items.
-- This migration extends the same pattern to the six tables still using
-- race-prone count-then-insert numbering in the app layer:
--   project_documents (DOC-), qcqa_reports (QC-), safety_incidents (SAF-),
--   change_orders (CO-), modifications (MOD-), weekly_reports (WR-).
--
-- Additive only. Verified before authoring (2026-07-05): zero duplicate
-- (project_id, number) pairs exist in any of the six tables, so the unique
-- indexes cannot fail. App-side number generation keeps working — the
-- trigger simply overwrites its value with the atomic one.

begin;

-- 0. Widen the entity_type check constraint (was limited to the original
--    three types) before seeding the six new ones.
alter table public.entity_number_sequences
  drop constraint if exists entity_number_sequences_entity_type_check;
alter table public.entity_number_sequences
  add constraint entity_number_sequences_entity_type_check
  check (entity_type = any (array[
    'submittal', 'rfi', 'punch_list',
    'document', 'qcqa', 'safety',
    'change_order', 'modification', 'weekly_report'
  ]::text[]));

-- 1. Seed sequences from existing per-project max numbers so trigger-assigned
--    numbers continue after existing data instead of colliding with it.
--    regexp_replace strips the prefix: 'DOC-012' -> 12.
insert into public.entity_number_sequences (project_id, entity_type, current_value)
select project_id, seed.entity_type, seed.max_val
from (
  select project_id, 'document'::text as entity_type,
         max(coalesce(nullif(regexp_replace(number, '\D', '', 'g'), '')::int, 0)) as max_val
  from public.project_documents group by project_id
  union all
  select project_id, 'qcqa',
         max(coalesce(nullif(regexp_replace(number, '\D', '', 'g'), '')::int, 0))
  from public.qcqa_reports group by project_id
  union all
  select project_id, 'safety',
         max(coalesce(nullif(regexp_replace(number, '\D', '', 'g'), '')::int, 0))
  from public.safety_incidents group by project_id
  union all
  select project_id, 'change_order',
         max(coalesce(nullif(regexp_replace(number, '\D', '', 'g'), '')::int, 0))
  from public.change_orders group by project_id
  union all
  select project_id, 'modification',
         max(coalesce(nullif(regexp_replace(number, '\D', '', 'g'), '')::int, 0))
  from public.modifications group by project_id
  union all
  select project_id, 'weekly_report',
         max(coalesce(nullif(regexp_replace(number, '\D', '', 'g'), '')::int, 0))
  from public.weekly_reports group by project_id
) seed
on conflict (project_id, entity_type) do update
  set current_value = greatest(public.entity_number_sequences.current_value, excluded.current_value);

-- 2. Extend the trigger function with the six new tables (existing three unchanged).
create or replace function public.assign_entity_number()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  _prefix text;
  _type   text;
  _next   int;
begin
  case tg_table_name
    when 'submittals'        then _prefix := 'SUB'; _type := 'submittal';
    when 'rfis'              then _prefix := 'RFI'; _type := 'rfi';
    when 'punch_list_items'  then _prefix := 'PL';  _type := 'punch_list';
    when 'project_documents' then _prefix := 'DOC'; _type := 'document';
    when 'qcqa_reports'      then _prefix := 'QC';  _type := 'qcqa';
    when 'safety_incidents'  then _prefix := 'SAF'; _type := 'safety';
    when 'change_orders'     then _prefix := 'CO';  _type := 'change_order';
    when 'modifications'     then _prefix := 'MOD'; _type := 'modification';
    when 'weekly_reports'    then _prefix := 'WR';  _type := 'weekly_report';
    else raise exception 'assign_entity_number: unsupported table %', tg_table_name;
  end case;

  insert into public.entity_number_sequences (project_id, entity_type, current_value)
  values (new.project_id, _type, 1)
  on conflict (project_id, entity_type)
  do update set current_value = public.entity_number_sequences.current_value + 1
  returning current_value into _next;

  new.number := _prefix || '-' || lpad(_next::text, 3, '0');
  return new;
end;
$function$;

-- 3. Attach BEFORE INSERT triggers to the six new tables.
drop trigger if exists project_documents_assign_number on public.project_documents;
create trigger project_documents_assign_number
  before insert on public.project_documents
  for each row execute function public.assign_entity_number();

drop trigger if exists qcqa_reports_assign_number on public.qcqa_reports;
create trigger qcqa_reports_assign_number
  before insert on public.qcqa_reports
  for each row execute function public.assign_entity_number();

drop trigger if exists safety_incidents_assign_number on public.safety_incidents;
create trigger safety_incidents_assign_number
  before insert on public.safety_incidents
  for each row execute function public.assign_entity_number();

drop trigger if exists change_orders_assign_number on public.change_orders;
create trigger change_orders_assign_number
  before insert on public.change_orders
  for each row execute function public.assign_entity_number();

drop trigger if exists modifications_assign_number on public.modifications;
create trigger modifications_assign_number
  before insert on public.modifications
  for each row execute function public.assign_entity_number();

drop trigger if exists weekly_reports_assign_number on public.weekly_reports;
create trigger weekly_reports_assign_number
  before insert on public.weekly_reports
  for each row execute function public.assign_entity_number();

-- 4. Unique backstops (verified conflict-free before authoring).
create unique index if not exists project_documents_project_id_number_key
  on public.project_documents (project_id, number);
create unique index if not exists qcqa_reports_project_id_number_key
  on public.qcqa_reports (project_id, number);
create unique index if not exists safety_incidents_project_id_number_key
  on public.safety_incidents (project_id, number);
create unique index if not exists change_orders_project_id_number_key
  on public.change_orders (project_id, number);
create unique index if not exists modifications_project_id_number_key
  on public.modifications (project_id, number);
create unique index if not exists weekly_reports_project_id_number_key
  on public.weekly_reports (project_id, number);

commit;
