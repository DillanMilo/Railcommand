-- Allow invitation records to carry the current app project roles, including
-- owner for enterprise demo projects. Application server actions still decide
-- when owner can be assigned.

alter table public.project_invitations
  drop constraint if exists project_invitations_project_role_check;

alter table public.project_invitations
  add constraint project_invitations_project_role_check
  check (project_role in (
    'manager',
    'superintendent',
    'foreman',
    'engineer',
    'contractor',
    'inspector',
    'owner',
    'viewer'
  ));

notify pgrst, 'reload schema';
