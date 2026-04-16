-- =============================================================================
-- RAILCOMMAND — FULL MIGRATION BUNDLE
-- =============================================================================
-- Run this ONCE in Supabase Dashboard → SQL Editor → New query → Run
--
-- This combines ALL 13 migrations in chronological order.
-- Safe to re-run — uses IF NOT EXISTS, DROP POLICY IF EXISTS, ON CONFLICT.
--
-- NOTE: This assumes the base tables already exist:
--   organizations, profiles, projects, project_members,
--   submittals, rfis, rfi_responses, daily_logs, daily_log_personnel,
--   daily_log_equipment, daily_log_work_items, punch_list_items,
--   milestones, attachments, activity_log
--
-- If those base tables do NOT exist, you need to create them first.
-- =============================================================================


-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. PROJECT INVITATIONS (2026-04-06)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.project_invitations (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  email         text not null,
  project_role  text not null check (project_role in (
                  'manager','superintendent','foreman','engineer','inspector','viewer'
                )),
  invited_by    uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'pending'
                  check (status in ('pending','accepted','declined','expired')),
  token         text not null unique default encode(gen_random_bytes(32), 'hex'),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days')
);

create index if not exists project_invitations_project_id_idx
  on public.project_invitations(project_id);
create index if not exists project_invitations_email_idx
  on public.project_invitations(email);
create index if not exists project_invitations_status_idx
  on public.project_invitations(status);
create index if not exists project_invitations_token_idx
  on public.project_invitations(token);

create unique index if not exists project_invitations_unique_pending
  on public.project_invitations(project_id, email)
  where status = 'pending';

alter table public.project_invitations enable row level security;

drop policy if exists "members can read project invitations" on public.project_invitations;
create policy "members can read project invitations"
  on public.project_invitations for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = project_invitations.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "invitees can read their own invitations" on public.project_invitations;
create policy "invitees can read their own invitations"
  on public.project_invitations for select
  using (
    email = (select email from public.profiles where id = auth.uid())
  );

drop policy if exists "managers can create invitations" on public.project_invitations;
create policy "managers can create invitations"
  on public.project_invitations for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = project_invitations.project_id
        and project_members.profile_id = auth.uid()
        and project_members.can_edit = true
    )
  );

drop policy if exists "managers can update invitations" on public.project_invitations;
create policy "managers can update invitations"
  on public.project_invitations for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = project_invitations.project_id
        and project_members.profile_id = auth.uid()
        and project_members.can_edit = true
    )
  );

drop policy if exists "invitees can update their own invitations" on public.project_invitations;
create policy "invitees can update their own invitations"
  on public.project_invitations for update
  using (
    email = (select email from public.profiles where id = auth.uid())
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. AVATARS STORAGE BUCKET (2026-04-08)
-- ═══════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatars are readable by authenticated users" on storage.objects;
create policy "Avatars are readable by authenticated users"
on storage.objects for select to authenticated
using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete their own avatar" on storage.objects;
create policy "Users can delete their own avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. PROFILES TIMEZONE COLUMN (2026-04-08)
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.profiles
  add column if not exists time_zone text;

comment on column public.profiles.time_zone is
  'IANA timezone identifier (e.g., America/New_York).';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. LOG ACTIVITY RPC (2026-04-09)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.log_activity(
  p_project_id   UUID,
  p_entity_type  TEXT,
  p_entity_id    UUID,
  p_action       TEXT,
  p_description  TEXT,
  p_performed_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.activity_log (
    project_id, entity_type, entity_id, action, description, performed_by
  ) VALUES (
    p_project_id, p_entity_type, p_entity_id, p_action, p_description, p_performed_by
  );
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON public.activity_log FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.activity_log FROM authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, TEXT, UUID, TEXT, TEXT, UUID) TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. PRIVATE PHOTO BUCKETS (2026-04-09)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create buckets if they don't exist
insert into storage.buckets (id, name, public)
values ('project-photos', 'project-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('thermal-photos', 'thermal-photos', false)
on conflict (id) do nothing;

-- Flip to private
update storage.buckets set public = false
where id in ('project-photos', 'thermal-photos');

-- project-photos policies
drop policy if exists "Project members can read project photos" on storage.objects;
create policy "Project members can read project photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

drop policy if exists "Project members can upload project photos" on storage.objects;
create policy "Project members can upload project photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

drop policy if exists "Project members can update project photos" on storage.objects;
create policy "Project members can update project photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
)
with check (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

drop policy if exists "Project members can delete project photos" on storage.objects;
create policy "Project members can delete project photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

-- thermal-photos policies
drop policy if exists "Project members can read thermal photos" on storage.objects;
create policy "Project members can read thermal photos"
on storage.objects for select to authenticated
using (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

drop policy if exists "Project members can upload thermal photos" on storage.objects;
create policy "Project members can upload thermal photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

drop policy if exists "Project members can update thermal photos" on storage.objects;
create policy "Project members can update thermal photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
)
with check (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);

drop policy if exists "Project members can delete thermal photos" on storage.objects;
create policy "Project members can delete thermal photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'thermal-photos'
  and exists (
    select 1 from public.project_members
    where project_members.project_id = (storage.foldername(name))[1]::uuid
      and project_members.profile_id = auth.uid()
  )
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. PROJECT BENCHMARK DATES (2026-04-09)
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.projects add column if not exists turnover_date date;
alter table public.projects add column if not exists substantial_completion_date date;
alter table public.projects add column if not exists project_completion_date date;

comment on column public.projects.turnover_date is 'Date when the project is turned over to the owner/operator';
comment on column public.projects.substantial_completion_date is 'Date when work is substantially complete';
comment on column public.projects.project_completion_date is 'Final completion date including all punch list close-outs';


-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. SAFETY INCIDENTS (2026-04-10)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.safety_incidents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  number          text not null,
  reported_by     uuid not null references public.profiles(id),
  incident_date   date not null default current_date,
  title           text not null,
  description     text not null default '',
  incident_type   text not null check (incident_type in (
                    'near_miss','first_aid','recordable','lost_time','observation','hazard'
                  )),
  severity        text not null check (severity in ('low','medium','high','critical')),
  status          text not null default 'open' check (status in ('open','in_progress','resolved','closed')),
  location        text not null default '',
  personnel_involved text not null default '',
  root_cause      text not null default '',
  corrective_action text not null default '',
  daily_log_id    uuid references public.daily_logs(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists safety_incidents_project_id_idx on public.safety_incidents(project_id);
create index if not exists safety_incidents_status_idx on public.safety_incidents(status);
create index if not exists safety_incidents_type_idx on public.safety_incidents(incident_type);
create index if not exists safety_incidents_severity_idx on public.safety_incidents(severity);
create index if not exists safety_incidents_date_idx on public.safety_incidents(incident_date);

alter table public.safety_incidents enable row level security;

drop policy if exists "members can read safety incidents" on public.safety_incidents;
create policy "members can read safety incidents"
  on public.safety_incidents for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = safety_incidents.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "editors can create safety incidents" on public.safety_incidents;
create policy "editors can create safety incidents"
  on public.safety_incidents for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = safety_incidents.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "editors can update safety incidents" on public.safety_incidents;
create policy "editors can update safety incidents"
  on public.safety_incidents for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = safety_incidents.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "reporters can delete safety incidents" on public.safety_incidents;
create policy "reporters can delete safety incidents"
  on public.safety_incidents for delete
  using (
    reported_by = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = safety_incidents.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 8. CHANGE ORDERS (2026-04-12)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.change_orders (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  number              text not null,
  title               text not null,
  description         text not null default '',
  reason              text not null default '',
  amount              numeric not null default 0,
  status              text not null default 'draft' check (status in (
                        'draft','submitted','approved','rejected','void'
                      )),
  submitted_by        uuid not null references public.profiles(id),
  approved_by         uuid references public.profiles(id),
  linked_milestone_id uuid references public.milestones(id) on delete set null,
  submit_date         date not null default current_date,
  approval_date       date,
  created_at          timestamptz not null default now()
);

create index if not exists change_orders_project_id_idx on public.change_orders(project_id);
create index if not exists change_orders_status_idx on public.change_orders(status);
create index if not exists change_orders_submitted_by_idx on public.change_orders(submitted_by);

alter table public.change_orders enable row level security;

drop policy if exists "members can read change orders" on public.change_orders;
create policy "members can read change orders"
  on public.change_orders for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = change_orders.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "editors can create change orders" on public.change_orders;
create policy "editors can create change orders"
  on public.change_orders for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = change_orders.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "editors can update change orders" on public.change_orders;
create policy "editors can update change orders"
  on public.change_orders for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = change_orders.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "reporters can delete change orders" on public.change_orders;
create policy "reporters can delete change orders"
  on public.change_orders for delete
  using (
    submitted_by = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = change_orders.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 9. MODIFICATIONS (2026-04-13)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.modifications (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  number              text not null,
  title               text not null,
  description         text not null default '',
  modification_type   text not null default 'plan_revision' check (modification_type in (
                        'plan_revision','spec_amendment','contract_amendment','design_change','scope_change'
                      )),
  status              text not null default 'draft' check (status in (
                        'draft','issued','acknowledged','implemented','void'
                      )),
  revision_number     text not null default '',
  affected_documents  text not null default '',
  issued_by           uuid not null references public.profiles(id),
  issued_date         date not null default current_date,
  effective_date      date,
  acknowledged_by     uuid references public.profiles(id),
  acknowledged_date   date,
  linked_milestone_id uuid references public.milestones(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists modifications_project_id_idx on public.modifications(project_id);
create index if not exists modifications_status_idx on public.modifications(status);
create index if not exists modifications_modification_type_idx on public.modifications(modification_type);

alter table public.modifications enable row level security;

drop policy if exists "members can read modifications" on public.modifications;
create policy "members can read modifications"
  on public.modifications for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = modifications.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "members can create modifications" on public.modifications;
create policy "members can create modifications"
  on public.modifications for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = modifications.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "members can update modifications" on public.modifications;
create policy "members can update modifications"
  on public.modifications for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = modifications.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "issuer or managers can delete modifications" on public.modifications;
create policy "issuer or managers can delete modifications"
  on public.modifications for delete
  using (
    issued_by = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = modifications.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 10. WEEKLY REPORTS (2026-04-13)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.weekly_reports (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  number              text not null,
  report_type         text not null default 'cm' check (report_type in ('cm', 'contractor')),
  week_start_date     date not null,
  week_end_date       date not null,
  title               text not null,
  status              text not null default 'draft' check (status in (
                        'draft','submitted','approved','rejected'
                      )),
  work_summary        text not null default '',
  safety_summary      text not null default '',
  schedule_summary    text not null default '',
  issues_concerns     text not null default '',
  upcoming_work       text not null default '',
  weather_summary     text not null default '',
  manpower_total      numeric not null default 0,
  equipment_hours     numeric not null default 0,
  submitted_by        uuid not null references public.profiles(id),
  approved_by         uuid references public.profiles(id),
  submit_date         date not null default current_date,
  approval_date       date,
  created_at          timestamptz not null default now()
);

create index if not exists weekly_reports_project_id_idx on public.weekly_reports(project_id);
create index if not exists weekly_reports_status_idx on public.weekly_reports(status);
create index if not exists weekly_reports_report_type_idx on public.weekly_reports(report_type);
create index if not exists weekly_reports_week_start_date_idx on public.weekly_reports(week_start_date);

alter table public.weekly_reports enable row level security;

drop policy if exists "members can read weekly reports" on public.weekly_reports;
create policy "members can read weekly reports"
  on public.weekly_reports for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = weekly_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "members can create weekly reports" on public.weekly_reports;
create policy "members can create weekly reports"
  on public.weekly_reports for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = weekly_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "members can update weekly reports" on public.weekly_reports;
create policy "members can update weekly reports"
  on public.weekly_reports for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = weekly_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "submitter or managers can delete weekly reports" on public.weekly_reports;
create policy "submitter or managers can delete weekly reports"
  on public.weekly_reports for delete
  using (
    submitted_by = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = weekly_reports.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 11. PROJECT DOCUMENTS (2026-04-14)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.project_documents (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  number        text not null,
  title         text not null,
  description   text not null default '',
  category      text not null check (category in ('drawing','specification','submittal','report','contract','correspondence','photo_log','other')),
  status        text not null default 'draft' check (status in ('draft','issued','under_review','approved','superseded')),
  revision      text not null default 'Rev 0',
  revision_date date not null default current_date,
  file_name     text not null default '',
  file_url      text not null default '',
  file_size     bigint not null default 0,
  uploaded_by   uuid not null references public.profiles(id),
  reviewed_by   uuid references public.profiles(id),
  review_date   date,
  linked_milestone_id uuid references public.milestones(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_project_documents_project_id on public.project_documents(project_id);
create index if not exists idx_project_documents_status on public.project_documents(status);
create index if not exists idx_project_documents_category on public.project_documents(category);
create index if not exists idx_project_documents_uploaded_by on public.project_documents(uploaded_by);

alter table public.project_documents enable row level security;

drop policy if exists "Members can view project documents" on public.project_documents;
create policy "Members can view project documents"
  on public.project_documents for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_documents.project_id
        and pm.profile_id = auth.uid()
    )
  );

drop policy if exists "Members can create project documents" on public.project_documents;
create policy "Members can create project documents"
  on public.project_documents for insert
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_documents.project_id
        and pm.profile_id = auth.uid()
    )
  );

drop policy if exists "Members can update project documents" on public.project_documents;
create policy "Members can update project documents"
  on public.project_documents for update
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_documents.project_id
        and pm.profile_id = auth.uid()
    )
  );

drop policy if exists "Members can delete project documents" on public.project_documents;
create policy "Members can delete project documents"
  on public.project_documents for delete
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_documents.project_id
        and pm.profile_id = auth.uid()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 12. QC/QA REPORTS (2026-04-14)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.qcqa_reports (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.projects(id) on delete cascade,
  number                text not null,
  report_type           text not null default 'inspection' check (report_type in (
                          'inspection','nonconformance','test','audit'
                        )),
  title                 text not null,
  description           text not null default '',
  spec_reference        text not null default '',
  location              text not null default '',
  status                text not null default 'draft' check (status in (
                          'draft','open','in_review','closed'
                        )),
  findings              text not null default '',
  corrective_action     text not null default '',
  is_nonconformance     boolean not null default false,
  severity              text not null default 'minor' check (severity in (
                          'minor','major','critical'
                        )),
  inspector             uuid not null references public.profiles(id),
  linked_punch_list_ids text[] not null default '{}',
  closed_by             uuid references public.profiles(id),
  closed_date           timestamptz,
  created_at            timestamptz not null default now()
);

create index if not exists qcqa_reports_project_id_idx on public.qcqa_reports(project_id);
create index if not exists qcqa_reports_status_idx on public.qcqa_reports(status);
create index if not exists qcqa_reports_report_type_idx on public.qcqa_reports(report_type);
create index if not exists qcqa_reports_is_nonconformance_idx on public.qcqa_reports(is_nonconformance);

alter table public.qcqa_reports enable row level security;

drop policy if exists "members can read qcqa reports" on public.qcqa_reports;
create policy "members can read qcqa reports"
  on public.qcqa_reports for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = qcqa_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "members can create qcqa reports" on public.qcqa_reports;
create policy "members can create qcqa reports"
  on public.qcqa_reports for insert
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = qcqa_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "members can update qcqa reports" on public.qcqa_reports;
create policy "members can update qcqa reports"
  on public.qcqa_reports for update
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = qcqa_reports.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "inspector or managers can delete qcqa reports" on public.qcqa_reports;
create policy "inspector or managers can delete qcqa reports"
  on public.qcqa_reports for delete
  using (
    inspector = auth.uid()
    or exists (
      select 1 from public.project_members
      where project_members.project_id = qcqa_reports.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager')
    )
  );


-- ═══════════════════════════════════════════════════════════════════════════════
-- 13. DEMO ACCOUNTS (2026-04-15)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.demo_accounts (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  company_name    text not null,
  description     text not null default '',
  organization_id uuid references public.organizations(id) on delete cascade,
  project_id      uuid references public.projects(id) on delete cascade,
  demo_user_id    uuid references public.profiles(id),
  is_active       boolean not null default true,
  is_team_demo    boolean not null default false,
  demo_password   text not null,
  created_at      timestamptz not null default now(),
  expires_at      timestamptz,
  last_accessed_at timestamptz,
  access_count    integer not null default 0
);

create table if not exists public.demo_team_logins (
  id              uuid primary key default gen_random_uuid(),
  demo_account_id uuid not null references public.demo_accounts(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  email           text not null,
  display_name    text not null,
  project_role    text not null,
  demo_password   text not null,
  created_at      timestamptz not null default now()
);

create index if not exists demo_accounts_slug_idx on public.demo_accounts(slug);
create index if not exists demo_accounts_active_idx on public.demo_accounts(is_active);
create index if not exists demo_team_logins_account_idx on public.demo_team_logins(demo_account_id);
create index if not exists demo_team_logins_email_idx on public.demo_team_logins(email);

alter table public.demo_accounts enable row level security;
alter table public.demo_team_logins enable row level security;

drop policy if exists "demo_accounts_select" on public.demo_accounts;
create policy "demo_accounts_select"
  on public.demo_accounts for select
  using (true);

drop policy if exists "demo_team_logins_select" on public.demo_team_logins;
create policy "demo_team_logins_select"
  on public.demo_team_logins for select
  using (true);


-- ═══════════════════════════════════════════════════════════════════════════════
-- FINAL: Reload PostgREST schema cache
-- ═══════════════════════════════════════════════════════════════════════════════

notify pgrst, 'reload schema';
