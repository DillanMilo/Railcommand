\set ON_ERROR_STOP on
set search_path=public;
grant update on daily_logs to authenticated;
grant update,delete on daily_log_personnel,daily_log_equipment,daily_log_work_items to authenticated;
create policy test_edit on daily_logs for update to authenticated using(created_by=auth.uid()) with check(created_by=auth.uid());
update project_members set can_edit=true;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $$
declare
 p uuid := '20000000-0000-4000-8000-000000000001';
 a uuid := '30000000-0000-4000-8000-000000000001';
 original jsonb; edited jsonb; snapshot jsonb;
 payload jsonb := '{"log_date":"2026-09-16","weather_temp":75,"weather_conditions":"Clear","weather_wind":"NW","work_summary":"Atomic edit","safety_notes":"Briefing","geo_tag":null,"personnel":[{"role":"Crew","headcount":4,"company":"Synthetic"}],"equipment":[{"equipment_type":"Crane","count":1,"notes":""}],"work_items":[]}';
begin
 select to_jsonb(l) || jsonb_build_object('personnel',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from daily_log_personnel r where daily_log_id=a),'equipment','[]'::jsonb,'work_items','[]'::jsonb) into original from daily_logs l where id=a;
 perform update_daily_log_checked(p,a,original,payload);
 if (select work_summary from daily_logs where id=a)<>'Atomic edit' or (select headcount from daily_log_personnel where daily_log_id=a)<>4 then raise exception 'Edit not committed together'; end if;
 begin
  perform update_daily_log_checked(p,a,original,payload || '{"work_summary":"Stale must not win"}');
  raise exception 'Stale edit accepted';
 exception when serialization_failure then null; end;
 if (select work_summary from daily_logs where id=a)<>'Atomic edit' then raise exception 'Stale edit overwrote'; end if;
 select to_jsonb(l) || jsonb_build_object('personnel',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from daily_log_personnel r where daily_log_id=a),'equipment',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from daily_log_equipment r where daily_log_id=a),'work_items','[]'::jsonb) into edited from daily_logs l where id=a;
 begin
  perform update_daily_log_checked(p,a,edited,payload || '{"work_summary":"Partial must not win","personnel":[{"role":"Crew","headcount":"invalid"}]}');
  raise exception 'Invalid child accepted';
 exception when invalid_text_representation then null; end;
 select to_jsonb(l) || jsonb_build_object('personnel',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from daily_log_personnel r where daily_log_id=a),'equipment',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from daily_log_equipment r where daily_log_id=a),'work_items','[]'::jsonb) into snapshot from daily_logs l where id=a;
 if edited is distinct from snapshot then raise exception 'Partial write or child loss after invalid edit'; end if;
 -- Detect changes in child records even when the parent itself did not change.
 update daily_log_personnel set headcount=7 where daily_log_id=a;
 begin
  perform update_daily_log_checked(p,a,edited,payload);
  raise exception 'Concurrent child change overwritten';
 exception when serialization_failure then null; end;
 if (select headcount from daily_log_personnel where daily_log_id=a)<>7 then raise exception 'Child change overwritten'; end if;
end $$;
reset role;
update project_members set can_edit=false;
set role authenticated;
do $$ begin
 begin
  perform update_daily_log_checked('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','{}','{}');
  raise exception 'Revoked edit permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS atomic edit, stale parent/child conflict, full rollback, revoked permission' as result;
