-- STAGING-ONLY COMPATIBILITY BASELINE.
--
-- RailCommand Mobile Staging uses mobile_staging.phase5_assign_entity_number()
-- for its synthetic RFI/submittal triggers, while the production bridge
-- hardening candidate deliberately requires the existing public production
-- trigger function. This creates that missing baseline function only so the
-- unchanged candidate can be rehearsed exactly. It attaches no triggers and
-- writes no customer or synthetic records.

begin;

do $$
begin
  if to_regclass('mobile_staging.fixture_manifest') is null
     or not exists (
       select 1
       from mobile_staging.fixture_manifest
       where fixture_key = 'qa-project'
         and synthetic_name = 'Synthetic US Track Renewal'
     ) then
    raise exception 'RC_STAGING_MARKER_MISMATCH: stop without creating compatibility baseline'
      using errcode = '55000';
  end if;

  if to_regclass('public.entity_number_sequences') is null then
    raise exception 'RC_STAGING_BASELINE_MISMATCH: entity number sequence table is unavailable'
      using errcode = '55000';
  end if;

  if to_regprocedure('public.assign_entity_number()') is not null then
    raise exception 'RC_STAGING_BASELINE_ALREADY_PRESENT: stop instead of replacing an existing function'
      using errcode = '55000';
  end if;
end;
$$;

create function public.assign_entity_number()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  _prefix text;
  _type text;
  _next int;
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

notify pgrst, 'reload schema';

commit;
