-- Local synthetic-only fixture. Never run against a hosted database.
begin;
create schema railcommand_guard;
CREATE OR REPLACE FUNCTION railcommand_guard.check_daily_log_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  if old.id is distinct from new.id or old.project_id is distinct from new.project_id
    or old.created_by is distinct from new.created_by or old.idempotency_key is distinct from new.idempotency_key then
    raise exception 'Daily-log identity cannot be reassigned' using errcode='22023';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION railcommand_guard.project_from_path(p_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO ''
AS $function$
begin
  if p_name is null or p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z][a-z_]{0,63}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]+$'
    or split_part(p_name,'/',4) in ('.','..') then return null; end if;
  return split_part(p_name,'/',1)::uuid;
end;
$function$;

create table public.guard_identity_fixture (id uuid, project_id uuid, created_by uuid, idempotency_key text, notes text);
create trigger identity_guard before update on public.guard_identity_fixture for each row execute function railcommand_guard.check_daily_log_identity();
insert into public.guard_identity_fixture values ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','synthetic-key','before');
do $test$
declare v_field text;
begin
 if railcommand_guard.project_from_path('20000000-0000-4000-8000-000000000001/daily_log/10000000-0000-4000-8000-000000000001/photo.png') is distinct from '20000000-0000-4000-8000-000000000001'::uuid then raise exception 'valid path rejected'; end if;
 if railcommand_guard.project_from_path('../private') is not null or railcommand_guard.project_from_path('20000000-0000-4000-8000-000000000001/daily_log/10000000-0000-4000-8000-000000000001/..') is not null or railcommand_guard.project_from_path(null) is not null then raise exception 'invalid path accepted'; end if;
 foreach v_field in array array['id','project_id','created_by'] loop
  begin
   execute format('update public.guard_identity_fixture set %I = %L::uuid',v_field,'40000000-0000-4000-8000-000000000001');
   raise exception 'identity reassignment allowed: %',v_field;
  exception when invalid_parameter_value then null;
  end;
 end loop;
 begin
  update public.guard_identity_fixture set idempotency_key='changed';
  raise exception 'idempotency reassignment allowed';
 exception when invalid_parameter_value then null;
 end;
 update public.guard_identity_fixture set notes='after';
 if not exists(select 1 from public.guard_identity_fixture where notes='after' and idempotency_key='synthetic-key') then raise exception 'allowed update lost'; end if;
 raise notice 'PASS path validation and immutable daily-log identity';
end;
$test$;
rollback;
