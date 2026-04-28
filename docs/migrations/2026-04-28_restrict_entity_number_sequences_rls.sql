-- Migration: Restrict entity number sequence management to project members
-- Date: 2026-04-28
--
-- The entity_number_sequences table only stores per-project counters for
-- generated record numbers. It should not be directly manageable by anonymous
-- clients. This policy keeps existing data intact and limits trigger-side
-- counter reads/writes to authenticated users who belong to the project.

drop policy if exists "Allow sequence management"
  on public.entity_number_sequences;

drop policy if exists "Project members can manage entity number sequences"
  on public.entity_number_sequences;

create policy "Project members can manage entity number sequences"
  on public.entity_number_sequences
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = entity_number_sequences.project_id
        and pm.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.project_members pm
      where pm.project_id = entity_number_sequences.project_id
        and pm.profile_id = auth.uid()
    )
  );

notify pgrst, 'reload schema';
