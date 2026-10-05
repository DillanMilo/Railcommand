const DAILY_LOG_EDITOR_ROLES = new Set([
  'manager', 'superintendent', 'foreman', 'contractor',
]);

export function canCreateMobileDailyLog(input: {
  organizationRole: string | null;
  projectRole: string | null;
  canEdit: boolean;
}): boolean {
  if (input.organizationRole === 'admin') return true;
  return input.canEdit && Boolean(input.projectRole && DAILY_LOG_EDITOR_ROLES.has(input.projectRole));
}
