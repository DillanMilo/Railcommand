begin;

-- Project-scoped template metadata. Template binaries are deliberately not
-- accepted by the application in this phase; trusted/versioned workbook
-- installation is a separate capability.
create table if not exists public.up_report_template_variants (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  variant_key           text not null,
  name                  text not null,
  version               text not null,
  status                text not null default 'metadata_only'
                        check (status in ('metadata_only', 'trusted', 'retired')),
  artifact_capability   text not null default 'data_package'
                        check (artifact_capability in ('data_package', 'xlsx_template')),
  template_storage_path text,
  template_sha256       text,
  template_file_name    text,
  template_size_bytes   bigint,
  mapping_schema        jsonb not null default '{}'::jsonb,
  created_by            uuid not null references public.profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (project_id, variant_key, version),
  unique (id, project_id, organization_id),
  check (length(trim(variant_key)) between 1 and 80),
  check (length(trim(name)) between 1 and 160),
  check (length(trim(version)) between 1 and 40),
  check (
    (artifact_capability = 'data_package'
      and template_storage_path is null
      and template_sha256 is null
      and template_file_name is null
      and template_size_bytes is null)
    or
    (artifact_capability = 'xlsx_template'
      and status = 'trusted'
      and template_storage_path is not null
      and template_sha256 ~ '^[0-9a-f]{64}$'
      and template_file_name ~ '^[a-z0-9][a-z0-9._-]{0,100}\.xlsx$'
      and template_size_bytes between 1 and 8388608
      and template_storage_path =
        organization_id::text || '/' ||
        project_id::text || '/' ||
        id::text || '/' ||
        template_file_name)
  )
);

-- Exactly one active template assignment/configuration per project.
create table if not exists public.project_up_report_configs (
  project_id          uuid primary key references public.projects(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  template_variant_id uuid not null,
  project_mapping     jsonb not null default '{}'::jsonb,
  manual_defaults     jsonb not null default '{}'::jsonb,
  created_by          uuid not null references public.profiles(id),
  updated_by          uuid not null references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  foreign key (template_variant_id, project_id, organization_id)
    references public.up_report_template_variants(id, project_id, organization_id)
    on delete restrict,
  unique (project_id, organization_id, template_variant_id)
);

-- UP-specific reviewed content is an extension of the existing weekly report.
-- The selected project/template/version and source snapshot are frozen on the
-- report so later configuration changes cannot silently alter an old report.
create table if not exists public.up_weekly_report_details (
  report_id            uuid primary key references public.weekly_reports(id) on delete cascade,
  project_id           uuid not null references public.projects(id) on delete cascade,
  organization_id      uuid not null references public.organizations(id) on delete cascade,
  template_variant_id  uuid not null,
  template_version     text not null,
  source_snapshot      jsonb not null,
  report_inputs        jsonb not null,
  review_status        text not null default 'draft'
                       check (review_status in ('draft', 'reviewed')),
  created_by           uuid not null references public.profiles(id),
  reviewed_by          uuid references public.profiles(id),
  reviewed_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  foreign key (template_variant_id, project_id, organization_id)
    references public.up_report_template_variants(id, project_id, organization_id)
    on delete restrict,
  check (
    (review_status = 'draft' and reviewed_by is null and reviewed_at is null)
    or
    (review_status = 'reviewed' and reviewed_by is not null and reviewed_at is not null)
  )
);

create index if not exists up_report_template_variants_project_idx
  on public.up_report_template_variants(project_id, status);
create index if not exists up_weekly_report_details_project_idx
  on public.up_weekly_report_details(project_id, created_at desc);

-- Fail closed at the database boundary if an application bug attempts to mix
-- projects, organizations, reports, or template assignments.
create or replace function public.validate_up_reporting_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_project_org uuid;
  v_report_project uuid;
  v_template_version text;
  v_selected_template uuid;
begin
  select organization_id
    into v_project_org
    from public.projects
   where id = new.project_id;

  if v_project_org is null or v_project_org is distinct from new.organization_id then
    raise exception 'UP reporting project/account scope mismatch'
      using errcode = '42501';
  end if;

  if tg_table_name = 'up_report_template_variants' then
    if tg_op = 'UPDATE'
       and (
         new.project_id is distinct from old.project_id
         or new.organization_id is distinct from old.organization_id
         or new.created_by is distinct from old.created_by
         or new.created_at is distinct from old.created_at
       ) then
      raise exception 'UP report template project/account provenance cannot be changed'
        using errcode = '42501';
    end if;
    if tg_op = 'UPDATE'
       and old.status = 'trusted'
       and (
         new.variant_key is distinct from old.variant_key
         or new.name is distinct from old.name
         or new.version is distinct from old.version
         or new.artifact_capability is distinct from old.artifact_capability
         or new.template_storage_path is distinct from old.template_storage_path
         or new.template_sha256 is distinct from old.template_sha256
         or new.template_file_name is distinct from old.template_file_name
         or new.template_size_bytes is distinct from old.template_size_bytes
         or new.mapping_schema is distinct from old.mapping_schema
       ) then
      raise exception 'Trusted UP report template versions and mappings are immutable'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'project_up_report_configs' then
    if tg_op = 'UPDATE'
       and (
         new.project_id is distinct from old.project_id
         or new.organization_id is distinct from old.organization_id
         or new.created_by is distinct from old.created_by
         or new.created_at is distinct from old.created_at
       ) then
      raise exception 'UP report configuration project/account provenance cannot be changed'
        using errcode = '42501';
    end if;
    perform 1
      from public.up_report_template_variants
     where id = new.template_variant_id
       and project_id = new.project_id
       and organization_id = new.organization_id;
    if not found then
      raise exception 'UP report template is not scoped to this project/account'
        using errcode = '42501';
    end if;
  elsif tg_table_name = 'up_weekly_report_details' then
    select project_id
      into v_report_project
      from public.weekly_reports
     where id = new.report_id;
    if v_report_project is null or v_report_project is distinct from new.project_id then
      raise exception 'UP weekly report is not scoped to this project'
        using errcode = '42501';
    end if;

    select version
      into v_template_version
      from public.up_report_template_variants
     where id = new.template_variant_id
       and project_id = new.project_id
       and organization_id = new.organization_id;
    if v_template_version is null then
      raise exception 'UP report template is not scoped to this project/account'
        using errcode = '42501';
    end if;

    if tg_op = 'INSERT' then
      select template_variant_id
        into v_selected_template
        from public.project_up_report_configs
       where project_id = new.project_id
         and organization_id = new.organization_id;
      if v_selected_template is null
         or v_selected_template is distinct from new.template_variant_id then
        raise exception 'UP report template selection is missing or ambiguous'
          using errcode = '42501';
      end if;
      new.template_version := v_template_version;
    elsif new.template_variant_id is distinct from old.template_variant_id
       or new.template_version is distinct from old.template_version
       or new.project_id is distinct from old.project_id
       or new.organization_id is distinct from old.organization_id
       or new.report_id is distinct from old.report_id then
      raise exception 'Frozen UP report scope/template fields cannot be changed'
        using errcode = '42501';
    elsif new.created_by is distinct from old.created_by
       or new.source_snapshot is distinct from old.source_snapshot then
      raise exception 'Frozen UP report provenance fields cannot be changed'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists up_template_validate_scope on public.up_report_template_variants;
create trigger up_template_validate_scope
  before insert or update on public.up_report_template_variants
  for each row execute function public.validate_up_reporting_scope();

drop trigger if exists up_config_validate_scope on public.project_up_report_configs;
create trigger up_config_validate_scope
  before insert or update on public.project_up_report_configs
  for each row execute function public.validate_up_reporting_scope();

drop trigger if exists up_report_detail_validate_scope on public.up_weekly_report_details;
create trigger up_report_detail_validate_scope
  before insert or update on public.up_weekly_report_details
  for each row execute function public.validate_up_reporting_scope();

drop trigger if exists up_template_updated_at on public.up_report_template_variants;
create trigger up_template_updated_at
  before update on public.up_report_template_variants
  for each row execute function public.update_updated_at();

drop trigger if exists up_config_updated_at on public.project_up_report_configs;
create trigger up_config_updated_at
  before update on public.project_up_report_configs
  for each row execute function public.update_updated_at();

drop trigger if exists up_report_detail_updated_at on public.up_weekly_report_details;
create trigger up_report_detail_updated_at
  before update on public.up_weekly_report_details
  for each row execute function public.update_updated_at();

alter table public.up_report_template_variants enable row level security;
alter table public.project_up_report_configs enable row level security;
alter table public.up_weekly_report_details enable row level security;

create or replace function public.can_edit_up_reporting(
  p_project_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.project_members pm
      join public.profiles p on p.id = pm.profile_id
     where pm.project_id = p_project_id
       and pm.profile_id = auth.uid()
       and pm.can_edit = true
       and p.organization_id = p_organization_id
  );
$$;

create or replace function public.can_view_up_financial_reporting(
  p_project_id uuid,
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.project_members pm
      join public.profiles p on p.id = pm.profile_id
     where pm.project_id = p_project_id
       and pm.profile_id = auth.uid()
       and pm.project_role in ('manager', 'superintendent', 'engineer', 'owner')
       and p.organization_id = p_organization_id
  );
$$;

-- Template metadata never crosses projects, even within one account.
create policy "UP template metadata is project scoped"
  on public.up_report_template_variants for select to authenticated
  using (
    public.is_project_member(project_id, auth.uid())
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid()
         and p.organization_id = up_report_template_variants.organization_id
    )
  );

create policy "UP template metadata inserts are project scoped"
  on public.up_report_template_variants for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_edit_up_reporting(project_id, organization_id)
  );

create policy "UP template metadata updates are project scoped"
  on public.up_report_template_variants for update to authenticated
  using (public.can_edit_up_reporting(project_id, organization_id))
  with check (public.can_edit_up_reporting(project_id, organization_id));

create policy "UP template metadata deletes are project scoped"
  on public.up_report_template_variants for delete to authenticated
  using (public.can_edit_up_reporting(project_id, organization_id));

-- Config can contain commercial defaults, so reads are budget-role restricted.
create policy "UP report config is project and budget scoped"
  on public.project_up_report_configs for select to authenticated
  using (public.can_view_up_financial_reporting(project_id, organization_id));

create policy "UP report config inserts are project scoped"
  on public.project_up_report_configs for insert to authenticated
  with check (
    created_by = auth.uid()
    and updated_by = auth.uid()
    and public.can_edit_up_reporting(project_id, organization_id)
  );

create policy "UP report config updates are project scoped"
  on public.project_up_report_configs for update to authenticated
  using (public.can_edit_up_reporting(project_id, organization_id))
  with check (
    updated_by = auth.uid()
    and public.can_edit_up_reporting(project_id, organization_id)
  );

create policy "UP report config deletes are project scoped"
  on public.project_up_report_configs for delete to authenticated
  using (public.can_edit_up_reporting(project_id, organization_id));

create policy "UP report details are project and budget scoped"
  on public.up_weekly_report_details for select to authenticated
  using (public.can_view_up_financial_reporting(project_id, organization_id));

create policy "UP report detail inserts are project scoped"
  on public.up_weekly_report_details for insert to authenticated
  with check (
    created_by = auth.uid()
    and public.can_edit_up_reporting(project_id, organization_id)
  );

create policy "UP report detail updates are project scoped"
  on public.up_weekly_report_details for update to authenticated
  using (public.can_edit_up_reporting(project_id, organization_id))
  with check (
    public.can_edit_up_reporting(project_id, organization_id)
    and (review_status = 'draft' or reviewed_by = auth.uid())
  );

create policy "UP report detail deletes are project scoped"
  on public.up_weekly_report_details for delete to authenticated
  using (public.can_edit_up_reporting(project_id, organization_id));

revoke all on table public.up_report_template_variants from anon;
revoke all on table public.project_up_report_configs from anon;
revoke all on table public.up_weekly_report_details from anon;
grant select, insert, update, delete on table public.up_report_template_variants to authenticated;
grant select, insert, update, delete on table public.project_up_report_configs to authenticated;
grant select, insert, update, delete on table public.up_weekly_report_details to authenticated;
grant all on table public.up_report_template_variants to service_role;
grant all on table public.project_up_report_configs to service_role;
grant all on table public.up_weekly_report_details to service_role;
revoke all on function public.can_edit_up_reporting(uuid, uuid) from public;
revoke all on function public.can_view_up_financial_reporting(uuid, uuid) from public;
grant execute on function public.can_edit_up_reporting(uuid, uuid) to authenticated, service_role;
grant execute on function public.can_view_up_financial_reporting(uuid, uuid) to authenticated, service_role;

-- Trusted source workbooks are private. Paths contain account, project, and
-- immutable template-version ids so storage access can fail closed.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'up-report-templates',
  'up-report-templates',
  false,
  8388608,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "UP template objects are project scoped" on storage.objects;
create policy "UP template objects are project scoped"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'up-report-templates'
    and exists (
      select 1
        from public.up_report_template_variants template
       where template.template_storage_path = storage.objects.name
         and template.status in ('trusted', 'retired')
         and public.can_view_up_financial_reporting(
           template.project_id,
           template.organization_id
         )
    )
  );

drop policy if exists "UP template uploads are project scoped" on storage.objects;
create policy "UP template uploads are project scoped"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'up-report-templates'
    and name ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[a-z0-9][a-z0-9._-]{0,100}\.xlsx$'
    and exists (
      select 1
        from public.profiles profile
       where profile.id = auth.uid()
         and profile.organization_id::text = (storage.foldername(name))[1]
    )
    and public.can_edit_up_reporting(
      ((storage.foldername(name))[2])::uuid,
      ((storage.foldername(name))[1])::uuid
    )
  );

-- Authenticated users cannot remove a workbook that is still registered.
-- This policy permits cleanup only for an orphan created by a failed metadata write.
drop policy if exists "UP orphan template cleanup is project scoped" on storage.objects;
create policy "UP orphan template cleanup is project scoped"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'up-report-templates'
    and name ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[a-z0-9][a-z0-9._-]{0,100}\.xlsx$'
    and not exists (
      select 1
        from public.up_report_template_variants template
       where template.template_storage_path = storage.objects.name
    )
    and public.can_edit_up_reporting(
      ((storage.foldername(name))[2])::uuid,
      ((storage.foldername(name))[1])::uuid
    )
  );

notify pgrst, 'reload schema';

commit;
