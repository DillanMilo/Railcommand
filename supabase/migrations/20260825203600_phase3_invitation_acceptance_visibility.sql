-- Allow an authenticated invitee to finish an RLS-checked pending -> accepted
-- transition. PostgreSQL UPDATE also evaluates row visibility for the new row;
-- the earlier pending-only SELECT policy intentionally hides that row too soon.

begin;

create policy "Mobile invitees can read their accepted invitation during handoff"
  on public.project_invitations for select to authenticated
  using (
    status = 'accepted'
    and lower(email) = lower((
      select profile.email
      from public.profiles profile
      where profile.id = (select auth.uid())
    ))
  );

commit;
