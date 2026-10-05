-- Isolated PostgreSQL fixture only. Never execute on a populated database.
\set ON_ERROR_STOP on
begin;
do $$ begin
 if to_regclass('public.daily_logs') is not null then raise exception 'Test requires an empty disposable database'; end if;
end $$;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
create table public.profiles(id uuid primary key, role text not null);
create table public.project_members(project_id uuid, profile_id uuid, can_edit boolean, project_role text);
create table public.daily_logs(id uuid primary key, project_id uuid not null, log_date date not null, created_by uuid not null references profiles(id), weather_temp numeric, weather_conditions text, weather_wind text, work_summary text, safety_notes text, geo_tag jsonb, idempotency_key text,
 constraint daily_logs_project_id_log_date_key unique(project_id,log_date));
create unique index daily_logs_created_by_idempotency_key_uidx on daily_logs(created_by,idempotency_key) where idempotency_key is not null;
create table daily_log_personnel(id uuid default gen_random_uuid() primary key,daily_log_id uuid references daily_logs(id),role text,headcount integer check(headcount>=0),company text);
create table daily_log_equipment(id uuid default gen_random_uuid() primary key,daily_log_id uuid references daily_logs(id),equipment_type text,count integer check(count>=0),notes text);
create table daily_log_work_items(id uuid default gen_random_uuid() primary key,daily_log_id uuid references daily_logs(id),description text,quantity numeric,unit text,location text);
alter table daily_logs enable row level security;
create policy test_project_read on daily_logs for select to authenticated using(exists(select 1 from project_members m where m.project_id=daily_logs.project_id and m.profile_id=auth.uid()));
create policy test_project_insert on daily_logs for insert to authenticated with check(created_by=auth.uid() and exists(select 1 from project_members m where m.project_id=daily_logs.project_id and m.profile_id=auth.uid() and m.can_edit));
grant select on profiles,project_members to authenticated;
grant select,insert on daily_logs,daily_log_personnel,daily_log_equipment,daily_log_work_items to authenticated;
insert into profiles values('10000000-0000-4000-8000-000000000001','member'),('10000000-0000-4000-8000-000000000002','member');
insert into project_members values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',true,'foreman');
commit;
