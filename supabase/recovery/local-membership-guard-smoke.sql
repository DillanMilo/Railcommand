-- Local synthetic-only helper semantics; not a hosted migration or full RLS test.
begin;
create schema auth;
create schema railcommand_guard;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
create table public.project_members(project_id uuid,profile_id uuid,can_edit boolean,project_role text);
create table public.profiles(id uuid,role text);
CREATE OR REPLACE FUNCTION railcommand_guard.can_write_daily_log(p_project uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null and exists(select 1 from public.project_members pm
    where pm.project_id=p_project and pm.profile_id=(select auth.uid()) and pm.can_edit
      and pm.project_role in ('manager','superintendent','foreman','contractor'));
$function$;
CREATE OR REPLACE FUNCTION railcommand_guard.is_project_member(p_project uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select (select auth.uid()) is not null and exists(select 1 from public.project_members pm
    where pm.project_id=p_project and pm.profile_id=(select auth.uid()));
$function$;
select set_config('test.user_id','10000000-0000-4000-8000-000000000001',true);
insert into public.project_members values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true,'manager');
do $test$
declare p uuid:='20000000-0000-4000-8000-000000000001'; admin_rpc_allowed boolean;
begin
 if not railcommand_guard.can_write_daily_log(p) or not railcommand_guard.is_project_member(p) then raise exception 'allowed member denied'; end if;
 if railcommand_guard.can_write_daily_log('30000000-0000-4000-8000-000000000001') then raise exception 'foreign project allowed'; end if;
 update public.project_members set can_edit=false;
 if railcommand_guard.can_write_daily_log(p) then raise exception 'revoked edit allowed'; end if;
 if not railcommand_guard.is_project_member(p) then raise exception 'read membership lost'; end if;
 update public.project_members set can_edit=true, project_role='viewer';
 if railcommand_guard.can_write_daily_log(p) then raise exception 'viewer write allowed'; end if;
 delete from public.project_members;
 insert into public.profiles values(auth.uid(),'admin');
 select exists(select 1 from public.profiles where id=auth.uid() and role='admin') into admin_rpc_allowed;
 if not admin_rpc_allowed or railcommand_guard.can_write_daily_log(p) then raise exception 'expected admin mismatch not reproduced'; end if;
 raise notice 'PASS helper membership, revoked edit and foreign-project checks; CONFIRMED admin RPC/guard mismatch';
end;
$test$;
rollback;
