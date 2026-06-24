-- =============================================================================
-- Migration: EarthCam lightweight embeds
-- Date:      2026-06-23
--
-- PURPOSE: Store project-level EarthCam Broadway Media Player share/embed URLs.
--          No EarthCam credentials, video, snapshots, or image media are stored.
-- =============================================================================

create table if not exists public.earthcam_embeds (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label      text not null default 'EarthCam Feed',
  url        text not null,
  created_at timestamptz not null default now(),
  constraint earthcam_embeds_share_url_check
    check (url ~ '^https://share\.earthcam\.net(/|$)')
);

create index if not exists earthcam_embeds_project_idx on public.earthcam_embeds(project_id);
create index if not exists earthcam_embeds_created_idx on public.earthcam_embeds(created_at desc);

alter table public.earthcam_embeds enable row level security;

drop policy if exists "project members can read earthcam embeds" on public.earthcam_embeds;
create policy "project members can read earthcam embeds"
  on public.earthcam_embeds for select
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = earthcam_embeds.project_id
        and project_members.profile_id = auth.uid()
    )
  );

drop policy if exists "project managers can write earthcam embeds" on public.earthcam_embeds;
create policy "project managers can write earthcam embeds"
  on public.earthcam_embeds for all
  using (
    exists (
      select 1 from public.project_members
      where project_members.project_id = earthcam_embeds.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager','superintendent','engineer')
    )
  )
  with check (
    exists (
      select 1 from public.project_members
      where project_members.project_id = earthcam_embeds.project_id
        and project_members.profile_id = auth.uid()
        and project_members.project_role in ('manager','superintendent','engineer')
    )
  );

notify pgrst, 'reload schema';
