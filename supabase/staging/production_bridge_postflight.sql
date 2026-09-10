-- READ-ONLY POSTFLIGHT. Run only in RailCommand Mobile Staging
-- (project ref rxuvchdqbzvovqijvfhx) after the bridge migrations and
-- rollback-only acceptance. It inspects catalog metadata and exact synthetic
-- acceptance identifiers only; it cannot write data or schema.

begin read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('mobile_staging.fixture_manifest') is null
     or not exists (
       select 1 from mobile_staging.fixture_manifest
       where fixture_key = 'qa-project'
         and synthetic_name = 'Synthetic US Track Renewal'
     ) then
    raise exception 'RC_STAGING_MARKER_MISMATCH: postflight refused'
      using errcode = '55000';
  end if;

  if to_regclass('public.mobile_device_registrations') is null then
    v_missing := array_append(v_missing, 'public.mobile_device_registrations');
  end if;
  if to_regclass('public.account_deletion_requests') is null then
    v_missing := array_append(v_missing, 'public.account_deletion_requests');
  end if;
  if to_regclass('public.account_deletion_audit') is null then
    v_missing := array_append(v_missing, 'public.account_deletion_audit');
  end if;
  if to_regprocedure('public.accept_mobile_project_invitation(text)') is null then
    v_missing := array_append(v_missing, 'public.accept_mobile_project_invitation');
  end if;
  if to_regprocedure('public.request_account_deletion(uuid,text,integer,integer,integer)') is null then
    v_missing := array_append(v_missing, 'public.request_account_deletion');
  end if;
  if to_regprocedure('public.cancel_account_deletion(uuid)') is null then
    v_missing := array_append(v_missing, 'public.cancel_account_deletion');
  end if;
  if cardinality(v_missing) > 0 then
    raise exception 'RC_STAGING_POSTFLIGHT_MISSING: %', array_to_string(v_missing, ', ')
      using errcode = '55000';
  end if;

  if not exists (
    select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'mobile_device_registrations'
      and relation.relrowsecurity
  ) or not exists (
    select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'account_deletion_requests'
      and relation.relrowsecurity
  ) or not exists (
    select 1 from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'account_deletion_audit'
      and relation.relrowsecurity
  ) then
    raise exception 'RC_STAGING_POSTFLIGHT_RLS_DISABLED'
      using errcode = '55000';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'mobile_daily_log_photos_insert_hardened'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'mobile_daily_log_photos_select_hardened'
  ) then
    raise exception 'RC_STAGING_POSTFLIGHT_STORAGE_POLICIES_MISSING'
      using errcode = '55000';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.sync_daily_log_create(uuid,uuid,text,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.sync_daily_log_create(uuid,uuid,text,jsonb)',
    'EXECUTE'
  ) or not has_function_privilege(
    'authenticated',
    'public.sync_daily_log_photo_attachment(uuid,uuid,uuid,text,text,text,text,text,bigint,text,double precision,double precision,timestamp with time zone)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.sync_daily_log_photo_attachment(uuid,uuid,uuid,text,text,text,text,text,bigint,text,double precision,double precision,timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'RC_STAGING_POSTFLIGHT_RPC_GRANTS_MISMATCH'
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
    select 1 from public.rfis
    where id = '66000000-0000-4000-8000-000000000001'
  ) or exists (
    select 1 from public.project_invitations
    where token = 'abcdef0123456789abcdef0123456789abcdef0123456789'
  ) or exists (
    select 1 from public.account_deletion_requests
    where client_request_id in (
      '65000000-0000-4000-8000-000000000001',
      '65000000-0000-4000-8000-000000000002'
    )
  ) then
    raise exception 'RC_STAGING_POSTFLIGHT_ACCEPTANCE_RESIDUE'
      using errcode = '55000';
  end if;
end;
$$;

select
  procedure.proname as function_name,
  case when procedure.prosecdef then 'definer' else 'invoker' end as security_mode,
  has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', procedure.oid, 'EXECUTE') as anonymous_execute
from pg_proc procedure
join pg_namespace namespace on namespace.oid = procedure.pronamespace
where namespace.nspname = 'public'
  and procedure.proname in (
    'accept_mobile_project_invitation',
    'request_account_deletion',
    'cancel_account_deletion',
    'sync_daily_log_create',
    'sync_daily_log_photo_attachment'
  )
order by procedure.proname;

select
  'PASS staging bridge postflight; contracts present and acceptance residue absent' as result;

rollback;
