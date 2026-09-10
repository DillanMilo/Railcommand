-- READ-ONLY PREFLIGHT. Run only in RailCommand Mobile Staging
-- (project ref rxuvchdqbzvovqijvfhx) before either production-bridge candidate.
-- This transaction cannot write data or schema. It returns only catalog metadata.

begin read only;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('mobile_staging.fixture_manifest') is null then
    raise exception 'RC_STAGING_MARKER_MISSING: stop without applying bridge SQL'
      using errcode = '55000';
  end if;
  if not exists (
    select 1
    from mobile_staging.fixture_manifest
    where fixture_key = 'qa-project'
      and synthetic_name = 'Synthetic US Track Renewal'
  ) then
    raise exception 'RC_STAGING_MARKER_MISMATCH: stop without applying bridge SQL'
      using errcode = '55000';
  end if;
end;
$$;

with required_relations(schema_name, relation_name) as (
  values
    ('public', 'profiles'),
    ('public', 'organizations'),
    ('public', 'projects'),
    ('public', 'project_members'),
    ('public', 'project_invitations'),
    ('public', 'daily_logs'),
    ('public', 'daily_log_personnel'),
    ('public', 'daily_log_equipment'),
    ('public', 'daily_log_work_items'),
    ('public', 'attachments'),
    ('public', 'entity_number_sequences'),
    ('storage', 'objects')
)
select
  schema_name,
  relation_name,
  to_regclass(format('%I.%I', schema_name, relation_name)) is not null as present
from required_relations
order by schema_name, relation_name;

with required_columns(schema_name, relation_name, column_name) as (
  values
    ('public', 'project_members', 'can_edit'),
    ('public', 'daily_logs', 'idempotency_key'),
    ('public', 'attachments', 'idempotency_key'),
    ('storage', 'objects', 'owner_id'),
    ('storage', 'objects', 'metadata')
)
select
  expected.schema_name,
  expected.relation_name,
  expected.column_name,
  actual.column_name is not null as present
from required_columns expected
left join information_schema.columns actual
  on actual.table_schema = expected.schema_name
 and actual.table_name = expected.relation_name
 and actual.column_name = expected.column_name
order by expected.schema_name, expected.relation_name, expected.column_name;

with required_functions(signature) as (
  values
    ('public.sync_daily_log_create(uuid,uuid,text,jsonb)'),
    ('public.sync_daily_log_photo_attachment(uuid,uuid,uuid,text,text,text,text,text,bigint,text,double precision,double precision,timestamp with time zone)'),
    ('public.assign_entity_number()'),
    ('public.accept_mobile_project_invitation(text)'),
    ('public.request_account_deletion(uuid,text,integer,integer,integer)'),
    ('public.cancel_account_deletion(uuid)')
)
select
  signature,
  to_regprocedure(signature) is not null as present,
  case
    when to_regprocedure(signature) is null then null
    else md5(pg_get_functiondef(to_regprocedure(signature)))
  end as definition_fingerprint
from required_functions
order by signature;

select
  namespace.nspname as schema_name,
  relation.relname as relation_name,
  relation.relrowsecurity as rls_enabled,
  count(policy.policyname)::integer as policy_count
from pg_class relation
join pg_namespace namespace on namespace.oid = relation.relnamespace
left join pg_policies policy
  on policy.schemaname = namespace.nspname
 and policy.tablename = relation.relname
where (namespace.nspname, relation.relname) in (
  ('public', 'mobile_device_registrations'),
  ('public', 'account_deletion_requests'),
  ('public', 'account_deletion_audit'),
  ('public', 'project_invitations'),
  ('public', 'project_members'),
  ('storage', 'objects')
)
group by namespace.nspname, relation.relname, relation.relrowsecurity
order by namespace.nspname, relation.relname;

select
  'RailCommand Mobile Staging marker and bridge catalog inspected; no changes made' as result;

rollback;
