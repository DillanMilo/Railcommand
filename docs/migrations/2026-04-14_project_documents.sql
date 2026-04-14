-- ============================================================
-- Project Documents table
-- Run in Supabase SQL Editor
-- ============================================================

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

-- Indexes
create index if not exists idx_project_documents_project_id on public.project_documents(project_id);
create index if not exists idx_project_documents_status     on public.project_documents(status);
create index if not exists idx_project_documents_category   on public.project_documents(category);
create index if not exists idx_project_documents_uploaded_by on public.project_documents(uploaded_by);

-- Enable RLS
alter table public.project_documents enable row level security;

-- Policy: members can read documents
create policy "Members can view project documents"
  on public.project_documents for select
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_documents.project_id
        and pm.profile_id = auth.uid()
    )
  );

-- Policy: members can insert documents
create policy "Members can create project documents"
  on public.project_documents for insert
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_documents.project_id
        and pm.profile_id = auth.uid()
    )
  );

-- Policy: members can update documents
create policy "Members can update project documents"
  on public.project_documents for update
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_documents.project_id
        and pm.profile_id = auth.uid()
    )
  );

-- Policy: members can delete documents
create policy "Members can delete project documents"
  on public.project_documents for delete
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_documents.project_id
        and pm.profile_id = auth.uid()
    )
  );

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
