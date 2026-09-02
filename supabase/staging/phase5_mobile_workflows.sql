-- PROPOSAL ONLY: not applied by the authoring task.
-- STAGING ONLY: rxuvchdqbzvovqijvfhx. NEVER put this in production migrations.
-- This fills the reduced staging fixture, not a permanent separate app backend.
-- Columns/defaults/checks/FK names follow supabase/schema_snapshot.sql. Deliberate
-- fixture differences: SELECT + limited record INSERT; existing EarthCam API
-- server-only CRUD; no general administration, record review/update/delete,
-- search/activity/notification triggers, or new upload path. public.log_activity
-- is absent in staging: EarthCam changes do not prove activity-audit parity.
-- Offline: cached reads and device drafts remain local; record creation/download
-- authorization is online-only. Daily-log sync helpers/policies are untouched.
-- One-time, atomic extension: an unexpected existing table aborts, not overwrites.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $$
declare v_table text;
begin
  if to_regclass('mobile_staging.fixture_manifest') is null then
    raise exception 'Refusing Phase 5: private mobile staging marker is absent';
  end if;
  if not exists (select 1 from mobile_staging.fixture_manifest
    where fixture_key = 'qa-project' and synthetic_name = 'Synthetic US Track Renewal') then
    raise exception 'Refusing Phase 5: mobile staging marker does not match';
  end if;
  if to_regprocedure('mobile_staging.can_access_project(uuid)') is null
    or to_regprocedure('mobile_staging.can_edit_project(uuid)') is null then
    raise exception 'Refusing Phase 5: original staging access helpers are missing';
  end if;
  foreach v_table in array array['rfis', 'submittals', 'rfi_responses', 'milestones',
    'punch_list_items', 'earthcam_embeds', 'entity_number_sequences'] loop
    if to_regclass('public.' || v_table) is not null then
      raise exception 'Refusing Phase 5: public.% already exists; inspect instead of reapplying', v_table;
    end if;
  end loop;
end $$;

alter table public.projects
  add column budget_total numeric(12,2) not null default 0,
  add column budget_spent numeric(12,2) not null default 0;

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null constraint milestones_project_id_fkey references public.projects(id) on delete cascade,
  name text not null, description text not null default '', target_date date not null, actual_date date,
  status text not null default 'not_started' constraint milestones_status_check
    check (status in ('on_track', 'at_risk', 'behind', 'complete', 'not_started')),
  percent_complete numeric(5,2) not null default 0 constraint milestones_percent_complete_check check (percent_complete between 0 and 100),
  budget_planned numeric(14,2) not null default 0, budget_actual numeric(14,2) not null default 0,
  sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.rfis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null constraint rfis_project_id_fkey references public.projects(id) on delete cascade,
  number text not null, subject text not null, question text not null, answer text,
  status text not null default 'open' constraint rfis_status_check check (status in ('open', 'answered', 'closed', 'overdue')),
  priority text not null default 'medium' constraint rfis_priority_check check (priority in ('critical', 'high', 'medium', 'low')),
  submitted_by uuid constraint rfis_submitted_by_fkey references public.profiles(id) on delete set null,
  assigned_to uuid not null constraint rfis_assigned_to_fkey references public.profiles(id),
  submit_date date not null default current_date, due_date date not null, response_date date,
  milestone_id uuid constraint rfis_milestone_id_fkey references public.milestones(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint rfis_project_id_number_key unique (project_id, number)
);
create table public.submittals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null constraint submittals_project_id_fkey references public.projects(id) on delete cascade,
  number text not null, title text not null, description text not null default '', spec_section text not null default '',
  status text not null default 'draft' constraint submittals_status_check
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'conditional', 'rejected')),
  submitted_by uuid constraint submittals_submitted_by_fkey references public.profiles(id) on delete set null,
  reviewed_by uuid constraint submittals_reviewed_by_fkey references public.profiles(id) on delete set null,
  submit_date date not null default current_date, due_date date not null, review_date date, review_notes text,
  milestone_id uuid constraint submittals_milestone_id_fkey references public.milestones(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint submittals_project_id_number_key unique (project_id, number)
);
create table public.rfi_responses (
  id uuid primary key default gen_random_uuid(),
  rfi_id uuid not null constraint rfi_responses_rfi_id_fkey references public.rfis(id) on delete cascade,
  author_id uuid constraint rfi_responses_author_id_fkey references public.profiles(id) on delete set null,
  content text not null, is_official_response boolean not null default false, created_at timestamptz not null default now()
);
create table public.punch_list_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null constraint punch_list_items_project_id_fkey references public.projects(id) on delete cascade,
  number text not null, title text not null, description text not null default '', location text not null default '', geo_tag jsonb,
  status text not null default 'open' constraint punch_list_items_status_check check (status in ('open', 'in_progress', 'resolved', 'verified')),
  priority text not null default 'medium' constraint punch_list_items_priority_check check (priority in ('critical', 'high', 'medium', 'low')),
  assigned_to uuid not null constraint punch_list_items_assigned_to_fkey references public.profiles(id),
  created_by uuid constraint punch_list_items_created_by_fkey references public.profiles(id) on delete set null,
  due_date date not null, resolved_date date, verified_date date, resolution_notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint punch_list_items_project_id_number_key unique (project_id, number)
);
create table public.earthcam_embeds (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null constraint earthcam_embeds_project_id_fkey references public.projects(id) on delete cascade,
  label text not null default 'EarthCam Feed', url text not null,
  created_at timestamptz not null default now(),
  constraint earthcam_embeds_share_url_check check (url ~ '^https://share\.earthcam\.net(/|$)')
);
create table public.entity_number_sequences (
  project_id uuid not null constraint entity_number_sequences_project_id_fkey references public.projects(id) on delete cascade,
  entity_type text not null constraint entity_number_sequences_entity_type_check check (entity_type in ('submittal', 'rfi', 'punch_list')),
  current_value integer not null default 0,
  primary key (project_id, entity_type)
);

create index mobile_phase5_members_profile_project_idx on public.project_members(profile_id, project_id);
create index mobile_phase5_personnel_parent_idx on public.daily_log_personnel(daily_log_id);
create index mobile_phase5_equipment_parent_idx on public.daily_log_equipment(daily_log_id);
create index mobile_phase5_work_items_parent_idx on public.daily_log_work_items(daily_log_id);
create index milestones_project_name_idx on public.milestones(project_id, name);
create index rfis_project_created_idx on public.rfis(project_id, created_at desc);
create index rfis_assigned_to_idx on public.rfis(assigned_to);
create index rfis_submitted_by_idx on public.rfis(submitted_by);
create index rfis_milestone_idx on public.rfis(milestone_id);
create index submittals_project_created_idx on public.submittals(project_id, created_at desc);
create index submittals_submitted_by_idx on public.submittals(submitted_by);
create index submittals_reviewed_by_idx on public.submittals(reviewed_by);
create index submittals_milestone_idx on public.submittals(milestone_id);
create index rfi_responses_parent_created_idx on public.rfi_responses(rfi_id, created_at, id);
create index rfi_responses_author_idx on public.rfi_responses(author_id);
create index punch_list_items_project_status_idx on public.punch_list_items(project_id, status, priority);
create index punch_list_items_assigned_to_idx on public.punch_list_items(assigned_to);
create index punch_list_items_created_by_idx on public.punch_list_items(created_by);
create index earthcam_embeds_project_label_idx on public.earthcam_embeds(project_id, label);

-- Private, self-scoped lookups avoid RLS recursion. They expose no auth records.
create function mobile_staging.can_view_shared_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (
    p_profile_id = (select auth.uid())
    or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or exists (select 1 from public.project_members mine
      join public.project_members teammate on teammate.project_id = mine.project_id
      where mine.profile_id = (select auth.uid()) and teammate.profile_id = p_profile_id)
  );
$$;
create function mobile_staging.can_create_workflow(p_project_id uuid, p_entity_type text)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and p_entity_type in ('rfi', 'submittal') and (
    exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
    or exists (select 1 from public.project_members pm
      where pm.project_id = p_project_id and pm.profile_id = (select auth.uid()) and pm.can_edit
        and ((p_entity_type = 'rfi' and pm.project_role in ('manager', 'superintendent', 'foreman', 'engineer', 'contractor', 'inspector', 'owner'))
          or (p_entity_type = 'submittal' and pm.project_role in ('manager', 'superintendent', 'engineer', 'contractor'))))
  );
$$;
revoke all on function mobile_staging.can_view_shared_profile(uuid), mobile_staging.can_create_workflow(uuid, text)
  from public, anon, authenticated;
grant execute on function mobile_staging.can_view_shared_profile(uuid), mobile_staging.can_create_workflow(uuid, text) to authenticated;

create policy mobile_phase5_profiles_select_shared on public.profiles for select to authenticated
  using (mobile_staging.can_view_shared_profile(id));
create policy mobile_phase5_memberships_select_team on public.project_members for select to authenticated
  using (mobile_staging.can_access_project(project_id));
create policy mobile_phase5_personnel_select_parent on public.daily_log_personnel for select to authenticated
  using (exists (select 1 from public.daily_logs dl where dl.id = daily_log_id and mobile_staging.can_access_project(dl.project_id)));
create policy mobile_phase5_equipment_select_parent on public.daily_log_equipment for select to authenticated
  using (exists (select 1 from public.daily_logs dl where dl.id = daily_log_id and mobile_staging.can_access_project(dl.project_id)));
create policy mobile_phase5_work_items_select_parent on public.daily_log_work_items for select to authenticated
  using (exists (select 1 from public.daily_logs dl where dl.id = daily_log_id and mobile_staging.can_access_project(dl.project_id)));
grant select on public.daily_log_personnel, public.daily_log_equipment, public.daily_log_work_items to authenticated;

alter table public.milestones enable row level security;
alter table public.rfis enable row level security;
alter table public.submittals enable row level security;
alter table public.rfi_responses enable row level security;
alter table public.punch_list_items enable row level security;
alter table public.earthcam_embeds enable row level security;
alter table public.entity_number_sequences enable row level security;
revoke all on public.milestones, public.rfis, public.submittals, public.rfi_responses,
  public.punch_list_items, public.earthcam_embeds, public.entity_number_sequences from public, anon, authenticated, service_role;
grant select on public.milestones, public.rfis, public.submittals, public.rfi_responses,
  public.punch_list_items, public.earthcam_embeds to authenticated;
-- Existing EarthCam endpoints recheck canManageMobileEarthCam before using their
-- server client. No authenticated/anonymous direct mutation privileges are added.
grant select, delete on public.earthcam_embeds to service_role;
grant insert (project_id, label, url) on public.earthcam_embeds to service_role;
grant update (label, url) on public.earthcam_embeds to service_role;
grant insert (id, project_id, subject, question, priority, submitted_by, assigned_to, due_date, milestone_id, status) on public.rfis to authenticated;
grant insert (id, project_id, title, description, spec_section, submitted_by, due_date, milestone_id, status) on public.submittals to authenticated;

create policy mobile_phase5_milestones_select on public.milestones for select to authenticated using (mobile_staging.can_access_project(project_id));
create policy mobile_phase5_rfis_select on public.rfis for select to authenticated using (mobile_staging.can_access_project(project_id));
create policy mobile_phase5_submittals_select on public.submittals for select to authenticated using (mobile_staging.can_access_project(project_id));
create policy mobile_phase5_punch_select on public.punch_list_items for select to authenticated using (mobile_staging.can_access_project(project_id));
create policy mobile_phase5_embeds_select on public.earthcam_embeds for select to authenticated using (mobile_staging.can_access_project(project_id));
create policy mobile_phase5_responses_select on public.rfi_responses for select to authenticated
  using (exists (select 1 from public.rfis r where r.id = rfi_id and mobile_staging.can_access_project(r.project_id)));
-- Keep the snapshot's named profile/milestone FKs for PostgREST joins. These
-- WITH CHECK predicates additionally require current, same-project references;
-- historical records are not deleted when a team member later leaves.
create policy mobile_phase5_rfis_insert on public.rfis for insert to authenticated with check (
  submitted_by = (select auth.uid()) and status = 'open'
  and mobile_staging.can_create_workflow(project_id, 'rfi')
  and exists (select 1 from public.project_members pm where pm.project_id = rfis.project_id and pm.profile_id = rfis.assigned_to)
  and (milestone_id is null or exists (select 1 from public.milestones m where m.id = rfis.milestone_id and m.project_id = rfis.project_id))
);
create policy mobile_phase5_submittals_insert on public.submittals for insert to authenticated with check (
  submitted_by = (select auth.uid()) and status = 'submitted'
  and mobile_staging.can_create_workflow(project_id, 'submittal')
  and (milestone_id is null or exists (select 1 from public.milestones m where m.id = submittals.milestone_id and m.project_id = submittals.project_id))
);

-- Counter writes are private rather than granting clients mutable sequence rows.
-- UUID PK + UNIQUE(project,number) preserve the endpoint's read/replay/23505 path;
-- no UPSERT of the actual record and no new ID after an ambiguous result.
create function mobile_staging.phase5_assign_entity_number()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_type text; v_prefix text; v_next integer;
begin
  if tg_table_schema <> 'public' or tg_op <> 'INSERT' then raise exception 'Unsupported numbering invocation'; end if;
  case tg_table_name
    when 'rfis' then v_type := 'rfi'; v_prefix := 'RFI';
    when 'submittals' then v_type := 'submittal'; v_prefix := 'SUB';
    else raise exception 'Unsupported numbering table';
  end case;
  if auth.uid() is null or new.submitted_by is distinct from auth.uid()
    or not mobile_staging.can_create_workflow(new.project_id, v_type) then
    raise exception 'Record creation is not authorized' using errcode = '42501';
  end if;
  insert into public.entity_number_sequences(project_id, entity_type, current_value)
    values (new.project_id, v_type, 1)
    on conflict (project_id, entity_type) do update
      set current_value = public.entity_number_sequences.current_value + 1
    returning current_value into v_next;
  -- Same prefix/minimum width as web; do not truncate 1000 to 100.
  new.number := v_prefix || '-' || lpad(v_next::text, greatest(3, length(v_next::text)), '0');
  return new;
end $$;
revoke all on function mobile_staging.phase5_assign_entity_number() from public, anon, authenticated, service_role;
create trigger rfis_assign_number before insert on public.rfis for each row execute function mobile_staging.phase5_assign_entity_number();
create trigger submittals_assign_number before insert on public.submittals for each row execute function mobile_staging.phase5_assign_entity_number();

-- Empty private bucket only. Existing bucket visibility/configuration is never changed.
insert into storage.buckets(id, name, public) values ('project-documents', 'project-documents', false) on conflict (id) do nothing;
do $$ begin
  if (select count(*) from storage.buckets where id in ('project-photos', 'thermal-photos', 'project-documents')) <> 3
    or exists (select 1 from storage.buckets where id in ('project-photos', 'thermal-photos', 'project-documents') and public) then
    raise exception 'Refusing Phase 5: all attachment buckets must exist and remain private';
  end if;
end $$;

create function mobile_staging.can_read_workflow_object(p_bucket text, p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_project uuid; v_record uuid; v_type text; v_category text;
begin
  if auth.uid() is null or p_bucket is null or p_name is null
    or p_bucket not in ('project-photos', 'thermal-photos', 'project-documents')
    or p_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/(rfi|submittal)/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[a-z0-9][a-z0-9._-]*$' then return false; end if;
  v_project := split_part(p_name, '/', 1)::uuid;
  v_type := split_part(p_name, '/', 2);
  v_record := split_part(p_name, '/', 3)::uuid;
  if not mobile_staging.can_access_project(v_project) then return false; end if;
  if v_type = 'rfi' then
    if not exists (select 1 from public.rfis where id = v_record and project_id = v_project) then return false; end if;
  elsif v_type = 'submittal' then
    if not exists (select 1 from public.submittals where id = v_record and project_id = v_project) then return false; end if;
  else return false;
  end if;
  v_category := case p_bucket when 'project-photos' then 'standard' when 'thermal-photos' then 'thermal' else 'document' end;
  return exists (select 1 from public.attachments a
    where a.project_id = v_project and a.entity_type = v_type and a.entity_id = v_record
      and a.photo_category = v_category
      and a.file_url = 'https://rxuvchdqbzvovqijvfhx.supabase.co/storage/v1/object/public/' || p_bucket || '/' || p_name);
end $$;
revoke all on function mobile_staging.can_read_workflow_object(text, text) from public, anon, authenticated;
grant execute on function mobile_staging.can_read_workflow_object(text, text) to authenticated;
create policy mobile_phase5_record_attachment_read on storage.objects for select to authenticated
  using (mobile_staging.can_read_workflow_object(bucket_id, name));
-- No RFI/Submittal Storage INSERT/UPDATE/DELETE policy or attachment INSERT grant.

notify pgrst, 'reload schema';
commit;
