begin;
set local statement_timeout='30s';
do $$ begin
 if exists(select 1 from auth.users where id in ('17091700-0000-4000-8000-000000000001','17091700-0000-4000-8000-000000000002')) or exists(select 1 from public.projects where id='27091700-0000-4000-8000-000000000001') then raise exception 'Synthetic fixture identity already exists; abort'; end if;
end $$;
insert into auth.users(id,email,raw_user_meta_data) values
 ('17091700-0000-4000-8000-000000000001','same-day-1-20260917@railcommand.test','{}'),
 ('17091700-0000-4000-8000-000000000002','same-day-2-20260917@railcommand.test','{}');
insert into public.profiles(id,email,role) values
 ('17091700-0000-4000-8000-000000000001','same-day-1-20260917@railcommand.test','member'),
 ('17091700-0000-4000-8000-000000000002','same-day-2-20260917@railcommand.test','member') on conflict(id) do nothing;
insert into public.projects(id,name,start_date,target_end_date,created_by) values
 ('27091700-0000-4000-8000-000000000001','SYNTHETIC SAME DAY ROLLBACK TEST','2026-09-01','2026-09-30','17091700-0000-4000-8000-000000000001');
insert into public.project_members(project_id,profile_id,can_edit,project_role) values
 ('27091700-0000-4000-8000-000000000001','17091700-0000-4000-8000-000000000001',true,'foreman');
set role authenticated;
select set_config('request.jwt.claim.sub','17091700-0000-4000-8000-000000000001',false);
do $$
declare
 p uuid := '27091700-0000-4000-8000-000000000001';
 a uuid := '37091700-0000-4000-8000-000000000001';
 b uuid := '37091700-0000-4000-8000-000000000002';
 c uuid := '37091700-0000-4000-8000-000000000003';
 payload jsonb := '{"log_date":"2026-09-16","work_summary":"Original field record","personnel":[{"role":"Foreman","headcount":2}],"equipment":[],"work_items":[]}';
 receipt jsonb;
begin
 receipt := public.sync_daily_log_create(p,a,'daily-log-create:'||a,payload);
 if (receipt->>'duplicate')::boolean then raise exception 'first insert marked duplicate'; end if;
 -- Old clients and existing pending queues require explicit review.
 begin
   perform public.sync_daily_log_create(p,b,'daily-log-create:'||b,payload);
   raise exception 'unconfirmed second log accepted';
 exception when unique_violation then
   if SQLERRM not like 'RC_DAILY_LOG_SAME_DAY_CONFIRMATION%' then raise; end if;
 end;
 -- JSON string true must not substitute for explicit boolean consent.
 begin
   perform public.sync_daily_log_create(p,b,'daily-log-create:'||b,payload || '{"allow_same_day":"true"}');
   raise exception 'string consent accepted';
 exception when unique_violation then null;
 end;
 receipt := public.sync_daily_log_create(p,b,'daily-log-create:'||b,payload || '{"allow_same_day":true,"work_summary":"Separate crew work"}');
 if (receipt->>'duplicate')::boolean or receipt->>'id'<>b::text then raise exception 'second independent log missing'; end if;
 -- Lost response followed by retries must not duplicate or overwrite fields.
 for i in 1..3 loop
   receipt := public.sync_daily_log_create(p,b,'daily-log-create:'||b,payload || '{"work_summary":"Must never overwrite"}');
   if not (receipt->>'duplicate')::boolean then raise exception 'retry inserted again'; end if;
 end loop;
 if (select count(*) from daily_logs where project_id=p)<>2 then raise exception 'wrong record count'; end if;
 if (select work_summary from daily_logs where id=a)<>'Original field record' then raise exception 'original changed'; end if;
 if (select work_summary from daily_logs where id=b)<>'Separate crew work' then raise exception 'retry overwrote'; end if;
 if (select count(*) from daily_log_personnel where daily_log_id=b)<>1 then raise exception 'children duplicated'; end if;
 -- Reject reusing an idempotency key with a different client identity.
 begin
   perform public.sync_daily_log_create(p,c,'daily-log-create:'||b,payload || '{"allow_same_day":true}');
   raise exception 'identity collision accepted';
 exception when unique_violation then null;
 end;
 -- Child failure rolls the parent insert back atomically.
 begin
   perform public.sync_daily_log_create(p,c,'daily-log-create:'||c,payload || '{"allow_same_day":true,"personnel":[{"role":"Crew","headcount":"invalid"}]}');
   raise exception 'invalid child accepted';
 exception when invalid_text_representation then null;
 end;
 if exists(select 1 from daily_logs where id=c) then raise exception 'partial parent persisted'; end if;
end $$;
do $$
declare
 p uuid := '27091700-0000-4000-8000-000000000001';
 a uuid := '37091700-0000-4000-8000-000000000001';
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
update project_members set can_edit=false where project_id='27091700-0000-4000-8000-000000000001';
set role authenticated;
do $$ begin
 begin
  perform public.sync_daily_log_create('27091700-0000-4000-8000-000000000001','37091700-0000-4000-8000-000000000002','daily-log-create:37091700-0000-4000-8000-000000000002','{"log_date":"2026-09-16","allow_same_day":true}');
  raise exception 'revoked permission still returned receipt';
 exception when insufficient_privilege then null;
 end;
end $$;
select set_config('request.jwt.claim.sub','17091700-0000-4000-8000-000000000002',false);
do $$ begin
 if (select count(*) from daily_logs)<>0 then raise exception 'RLS exposed another project'; end if;
 begin
  perform public.sync_daily_log_create('27091700-0000-4000-8000-000000000001','37091700-0000-4000-8000-000000000003','daily-log-create:37091700-0000-4000-8000-000000000003','{"log_date":"2026-09-16","allow_same_day":true}');
  raise exception 'nonmember write accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select 'PASS separate records, old queue consent, exact retries, immutable originals, child atomicity, identity conflict, revoked permission and RLS' as result;

rollback;
