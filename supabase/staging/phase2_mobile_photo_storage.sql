-- Isolated Mobile Staging intentionally starts from a reduced Phase 1 schema.
-- Provision the attachment table that production already has before applying
-- migrations/20260814121049_offline_daily_log_photo_sync.sql.

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'submittal', 'rfi', 'daily_log', 'punch_list', 'safety_incident',
    'project_photo', 'project_document'
  )),
  entity_id uuid not null,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  file_size bigint not null,
  photo_category text not null default 'standard'
    check (photo_category in ('standard', 'thermal', 'document')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  geo_lat double precision,
  geo_lng double precision,
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  project_id uuid references public.projects(id) on delete cascade
);

create index if not exists attachments_project_id_idx
  on public.attachments (project_id);
create index if not exists idx_attachments_entity
  on public.attachments (entity_type, entity_id);

alter table public.attachments enable row level security;

drop policy if exists "mobile_staging_attachments_insert" on public.attachments;
create policy "mobile_staging_attachments_insert"
  on public.attachments for insert
  to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and entity_type = 'daily_log'
    and exists (
      select 1 from public.daily_logs dl
      where dl.id = attachments.entity_id
        and dl.project_id = attachments.project_id
        and dl.created_by = (select auth.uid())
    )
    and (
      exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid()) and p.role = 'admin'
      )
      or exists (
        select 1 from public.project_members pm
        where pm.project_id = attachments.project_id
          and pm.profile_id = (select auth.uid())
          and pm.can_edit
          and pm.project_role in ('manager', 'superintendent', 'foreman', 'contractor')
      )
    )
  );

drop policy if exists "mobile_staging_attachments_select" on public.attachments;
create policy "mobile_staging_attachments_select"
  on public.attachments for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'admin'
    )
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = attachments.project_id
        and pm.profile_id = (select auth.uid())
    )
  );

grant select, insert on table public.attachments to authenticated;

notify pgrst, 'reload schema';
