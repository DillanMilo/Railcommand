-- Disposable local database only. Entire fixture rolls back.
\set ON_ERROR_STOP on
begin;
create schema auth;
create schema railcommand_guard;
create role rc_test_authenticated nologin;
create function auth.uid() returns uuid language sql stable as $$
 select nullif(current_setting('test.user_id',true),'')::uuid
$$;
create table public.profiles(id uuid primary key,role text);
create table public.project_members(project_id uuid,profile_id uuid,can_edit boolean,project_role text);
alter table public.profiles enable row level security;
alter table public.project_members enable row level security;
create policy own_profile on public.profiles for select to rc_test_authenticated using(id=auth.uid());
create policy own_membership on public.project_members for select to rc_test_authenticated using(profile_id=auth.uid());
grant usage on schema auth,railcommand_guard to rc_test_authenticated;
grant select on public.profiles,public.project_members to rc_test_authenticated;
\ir admin-daily-log-candidate.sql
insert into public.profiles values
 ('10000000-0000-4000-8000-000000000001','admin'),
 ('10000000-0000-4000-8000-000000000002','user');
insert into public.project_members values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',true,'manager'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002',false,'manager'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',true,'viewer');
set local role rc_test_authenticated;
do $$
begin
 perform set_config('test.user_id','10000000-0000-4000-8000-000000000001',true);
 if not railcommand_guard.can_write_daily_log('20000000-0000-4000-8000-000000000001') then raise exception 'administrator denied'; end if;
 if railcommand_guard.can_write_daily_log(null) then raise exception 'null project allowed'; end if;
 perform set_config('test.user_id','10000000-0000-4000-8000-000000000002',true);
 if not railcommand_guard.can_write_daily_log('20000000-0000-4000-8000-000000000001') then raise exception 'editor denied'; end if;
 if railcommand_guard.can_write_daily_log('20000000-0000-4000-8000-000000000002') then raise exception 'revoked editor allowed'; end if;
 if railcommand_guard.can_write_daily_log('20000000-0000-4000-8000-000000000003') then raise exception 'viewer allowed'; end if;
 if railcommand_guard.can_write_daily_log('20000000-0000-4000-8000-000000000004') then raise exception 'foreign project allowed'; end if;
 perform set_config('test.user_id','',true);
 if railcommand_guard.can_write_daily_log('20000000-0000-4000-8000-000000000001') then raise exception 'signed-out allowed'; end if;
end $$;
reset role;
-- Current database role, not a stale client claim, controls the admin exception.
update public.profiles set role='user' where id='10000000-0000-4000-8000-000000000001';
set local role rc_test_authenticated;
do $$ begin
 perform set_config('test.user_id','10000000-0000-4000-8000-000000000001',true);
 if railcommand_guard.can_write_daily_log('20000000-0000-4000-8000-000000000001') then raise exception 'demoted administrator allowed'; end if;
 raise notice 'PASS eight admin/editor/revocation/isolation checks under non-owner role with fixture RLS';
end $$;
reset role;
rollback;
