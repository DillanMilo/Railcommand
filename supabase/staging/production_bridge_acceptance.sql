-- STAGING-ONLY ACCEPTANCE. Run only after both production-bridge candidates have
-- succeeded in RailCommand Mobile Staging (rxuvchdqbzvovqijvfhx).
-- Every row change is limited to the named synthetic fixture and rolled back.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
begin
  if to_regclass('mobile_staging.fixture_manifest') is null
     or not exists (
       select 1
       from mobile_staging.fixture_manifest
       where fixture_key = 'qa-project'
         and synthetic_name = 'Synthetic US Track Renewal'
     ) then
    raise exception 'RC_STAGING_MARKER_MISMATCH: acceptance refused'
      using errcode = '55000';
  end if;
  if not exists (
    select 1
    from public.projects project
    where project.id = '20000000-0000-4000-8000-000000000001'
      and project.name = 'Synthetic US Track Renewal'
  ) then
    raise exception 'RC_STAGING_SYNTHETIC_PROJECT_MISSING: acceptance refused'
      using errcode = '55000';
  end if;
  if not exists (
    select 1
    from public.profiles profile
    join public.project_members member on member.profile_id = profile.id
    where profile.id = '50e36773-3682-4487-80c1-b6131a422553'
      and profile.email = 'railcommand-mobile-owner@creativecurrents.test'
      and profile.role = 'manager'
      and member.project_id = '20000000-0000-4000-8000-000000000001'
      and member.can_edit
  ) then
    raise exception 'RC_STAGING_SYNTHETIC_OWNER_MISSING: acceptance refused'
      using errcode = '55000';
  end if;
  if exists (
    select 1
    from public.account_deletion_requests request
    where request.profile_id = '50e36773-3682-4487-80c1-b6131a422553'
      and request.status in ('pending', 'reviewing', 'processing', 'failed')
  ) then
    raise exception 'RC_STAGING_SYNTHETIC_OWNER_NOT_CLEAN: inspect without deleting'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.daily_logs where id in (
      '63000000-0000-4000-8000-000000000001',
      '63000000-0000-4000-8000-000000000002'
    )
  ) or exists (
    select 1 from public.attachments where id in (
      '64000000-0000-4000-8000-000000000001',
      '64000000-0000-4000-8000-000000000002'
    )
  ) or exists (
    select 1 from public.rfis where id = '66000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1 from public.project_invitations
    where token = 'abcdef0123456789abcdef0123456789abcdef0123456789'
       or (project_id = '20000000-0000-4000-8000-000000000001'
           and lower(email) = 'railcommand-mobile-owner@creativecurrents.test'
           and status = 'pending')
  ) then
    raise exception 'RC_STAGING_ACCEPTANCE_ID_COLLISION: inspect without overwriting'
      using errcode = '55000';
  end if;
  if exists (
    select 1 from public.rfis
    where project_id = '20000000-0000-4000-8000-000000000001'
      and number = 'RFI-1000'
  ) then
    raise exception 'RC_STAGING_NUMBER_COLLISION: inspect without overwriting'
      using errcode = '55000';
  end if;
end;
$$;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', '50e36773-3682-4487-80c1-b6131a422553',
    'role', 'authenticated',
    'email', 'railcommand-mobile-owner@creativecurrents.test',
    'amr', jsonb_build_array(jsonb_build_object(
      'method', 'password',
      'timestamp', extract(epoch from now())::bigint
    ))
  )::text,
  true
);
select set_config(
  'request.jwt.claim.sub',
  '50e36773-3682-4487-80c1-b6131a422553',
  true
);

-- Permission is rechecked on every delivery attempt.
update public.project_members
set can_edit = false
where project_id = '20000000-0000-4000-8000-000000000001'
  and profile_id = '50e36773-3682-4487-80c1-b6131a422553';

set local role authenticated;
do $$
begin
  perform public.sync_daily_log_create(
    '20000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000002',
    'staging-permission-denial-0001',
    '{"log_date":"2099-12-30"}'::jsonb
  );
  raise exception 'acceptance failure: can_edit=false daily log succeeded';
exception
  when insufficient_privilege then null;
end;
$$;
reset role;

update public.project_members
set can_edit = true
where project_id = '20000000-0000-4000-8000-000000000001'
  and profile_id = '50e36773-3682-4487-80c1-b6131a422553';

-- Daily-log replay returns the original row and creates exactly one record.
set local role authenticated;
do $$
declare
  first_receipt jsonb;
  replay_receipt jsonb;
begin
  first_receipt := public.sync_daily_log_create(
    '20000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000001',
    'staging-daily-log-idempotency-0001',
    '{"log_date":"2099-12-31","weather_conditions":"Synthetic staging","personnel":[],"equipment":[],"work_items":[]}'::jsonb
  );
  replay_receipt := public.sync_daily_log_create(
    '20000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000001',
    'staging-daily-log-idempotency-0001',
    '{"log_date":"2099-12-31","weather_conditions":"Synthetic staging","personnel":[],"equipment":[],"work_items":[]}'::jsonb
  );
  if (first_receipt->>'duplicate')::boolean
     or not (replay_receipt->>'duplicate')::boolean
     or (select count(*) from public.daily_logs
         where id = '63000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'acceptance failure: daily-log idempotency';
  end if;
end;
$$;
reset role;

-- Simulate the metadata produced by the separately authorized signed upload.
insert into storage.objects(bucket_id, name, owner_id, metadata)
values (
  'project-photos',
  '20000000-0000-4000-8000-000000000001/daily_log/63000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000001-photo.png',
  '50e36773-3682-4487-80c1-b6131a422553',
  '{"size":70,"mimetype":"image/png"}'::jsonb
);

set local role authenticated;
do $$
declare
  first_receipt jsonb;
  replay_receipt jsonb;
begin
  first_receipt := public.sync_daily_log_photo_attachment(
    '64000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000001',
    'staging-photo-idempotency-0001',
    'project-photos',
    '20000000-0000-4000-8000-000000000001/daily_log/63000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000001-photo.png',
    'photo.png', 'image/png', 70, 'standard'
  );
  replay_receipt := public.sync_daily_log_photo_attachment(
    '64000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000001',
    'staging-photo-idempotency-0001',
    'project-photos',
    '20000000-0000-4000-8000-000000000001/daily_log/63000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000001-photo.png',
    'photo.png', 'image/png', 70, 'standard'
  );
  if (first_receipt->>'duplicate')::boolean
     or not (replay_receipt->>'duplicate')::boolean
     or (select count(*) from public.attachments
         where id = '64000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'acceptance failure: photo idempotency';
  end if;
end;
$$;

do $$
begin
  perform public.sync_daily_log_photo_attachment(
    '64000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '63000000-0000-4000-8000-000000000001',
    'staging-photo-metadata-denial-0002',
    'project-photos',
    '20000000-0000-4000-8000-000000000001/daily_log/63000000-0000-4000-8000-000000000001/64000000-0000-4000-8000-000000000001-photo.png',
    'photo.png', 'image/png', 71, 'standard'
  );
  raise exception 'acceptance failure: mismatched photo size succeeded';
exception
  when invalid_parameter_value then null;
end;
$$;
reset role;

-- Invitation acceptance uses the existing synthetic account and project only.
insert into public.project_invitations(
  project_id, email, project_role, invited_by, status, token, expires_at
)
values (
  '20000000-0000-4000-8000-000000000001',
  'railcommand-mobile-owner@creativecurrents.test',
  'manager',
  '50e36773-3682-4487-80c1-b6131a422553',
  'pending',
  'abcdef0123456789abcdef0123456789abcdef0123456789',
  now() + interval '1 day'
);

set local role authenticated;
do $$
declare
  accepted_project uuid;
begin
  accepted_project := public.accept_mobile_project_invitation(
    'abcdef0123456789abcdef0123456789abcdef0123456789'
  );
  if accepted_project <> '20000000-0000-4000-8000-000000000001'
     or not exists (
       select 1 from public.project_invitations
       where token = 'abcdef0123456789abcdef0123456789abcdef0123456789'
         and status = 'accepted'
     ) then
    raise exception 'acceptance failure: invitation acceptance';
  end if;
end;
$$;

-- Deletion requests require recent password authentication, zero local work,
-- create once, replay once, and remain cancelable during the recovery window.
do $$
declare
  first_id uuid;
  second_id uuid;
  was_duplicate boolean;
begin
  select result.id, result.duplicate into first_id, was_duplicate
  from public.request_account_deletion(
    '65000000-0000-4000-8000-000000000001', 'mobile', 0, 0, 0
  ) result;
  if was_duplicate then
    raise exception 'acceptance failure: first deletion request was duplicate';
  end if;
  select result.id, result.duplicate into second_id, was_duplicate
  from public.request_account_deletion(
    '65000000-0000-4000-8000-000000000001', 'mobile', 0, 0, 0
  ) result;
  if not was_duplicate or second_id <> first_id then
    raise exception 'acceptance failure: deletion-request idempotency';
  end if;
  perform public.cancel_account_deletion(first_id);
  if not exists (
    select 1 from public.account_deletion_requests
    where id = first_id and status = 'canceled'
  ) then
    raise exception 'acceptance failure: deletion-request cancellation';
  end if;
end;
$$;

do $$
begin
  perform public.request_account_deletion(
    '65000000-0000-4000-8000-000000000002', 'mobile', 0, 1, 0
  );
  raise exception 'acceptance failure: deletion with queued work succeeded';
exception
  when raise_exception then
    if sqlerrm <> 'RC409_UNSYNCHRONIZED_WORK' then raise; end if;
end;
$$;
reset role;

-- Numbering must grow beyond three digits without rewriting existing numbers.
insert into public.entity_number_sequences(project_id, entity_type, current_value)
values ('20000000-0000-4000-8000-000000000001', 'rfi', 999)
on conflict (project_id, entity_type) do update set current_value = 999;

set local role authenticated;
insert into public.rfis(
  id, project_id, subject, question, submitted_by, assigned_to, due_date, status
)
values (
  '66000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Rollback-only numbering acceptance',
  'Synthetic staging check',
  '50e36773-3682-4487-80c1-b6131a422553',
  '50e36773-3682-4487-80c1-b6131a422553',
  date '2099-12-31',
  'open'
);
do $$
begin
  if (select number from public.rfis
      where id = '66000000-0000-4000-8000-000000000001') <> 'RFI-1000' then
    raise exception 'acceptance failure: entity number was truncated';
  end if;
end;
$$;
reset role;

rollback;

select 'PASS staging production-bridge acceptance; all fixture changes rolled back' as result;
