import type { ProjectMember } from './types';

export const STANDARD_ASSIGNABLE_PROJECT_ROLES: readonly ProjectMember['project_role'][] = [
  'manager',
  'engineer',
  'contractor',
  'inspector',
  'foreman',
  'superintendent',
];

export const DEMO_ASSIGNABLE_PROJECT_ROLES: readonly ProjectMember['project_role'][] = [
  ...STANDARD_ASSIGNABLE_PROJECT_ROLES,
  'owner',
];

const ALL_PROJECT_ROLES: readonly ProjectMember['project_role'][] = [
  'engineer',
  'contractor',
  'owner',
  'inspector',
  'manager',
  'superintendent',
  'foreman',
];

const CAN_EDIT_PROJECT_ROLES: readonly ProjectMember['project_role'][] = [
  'manager',
  'superintendent',
  'foreman',
  'engineer',
];

export function getAssignableProjectRoles(
  isDemoProject: boolean
): readonly ProjectMember['project_role'][] {
  return isDemoProject ? DEMO_ASSIGNABLE_PROJECT_ROLES : STANDARD_ASSIGNABLE_PROJECT_ROLES;
}

export function isProjectRole(role: string): role is ProjectMember['project_role'] {
  return (ALL_PROJECT_ROLES as readonly string[]).includes(role);
}

export function canAssignProjectRole(role: string, isDemoProject: boolean): boolean {
  return (getAssignableProjectRoles(isDemoProject) as readonly string[]).includes(role);
}

export function projectRoleCanEdit(role: string): boolean {
  return isProjectRole(role) && CAN_EDIT_PROJECT_ROLES.includes(role);
}
