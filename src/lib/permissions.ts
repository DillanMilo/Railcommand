import type { ProjectMember } from './types';

export const ACTIONS = {
  SUBMITTAL_CREATE: 'submittal:create',
  SUBMITTAL_REVIEW: 'submittal:review',
  RFI_CREATE: 'rfi:create',
  RFI_RESPOND: 'rfi:respond',
  RFI_CLOSE: 'rfi:close',
  DAILY_LOG_CREATE: 'daily_log:create',
  PUNCH_LIST_CREATE: 'punch_list:create',
  PUNCH_LIST_RESOLVE: 'punch_list:resolve',
  PUNCH_LIST_VERIFY: 'punch_list:verify',
  TEAM_MANAGE: 'team:manage',
  PROJECT_MANAGE: 'project:manage',
  BUDGET_VIEW: 'budget:view',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

type ProjectRole = ProjectMember['project_role'];

const ALL_ACTIONS = Object.values(ACTIONS);

const PERMISSION_MATRIX: Record<ProjectRole, readonly Action[]> = {
  manager: ALL_ACTIONS,
  superintendent: [
    ACTIONS.SUBMITTAL_CREATE,
    ACTIONS.SUBMITTAL_REVIEW,
    ACTIONS.RFI_CREATE,
    ACTIONS.RFI_RESPOND,
    ACTIONS.RFI_CLOSE,
    ACTIONS.DAILY_LOG_CREATE,
    ACTIONS.PUNCH_LIST_CREATE,
    ACTIONS.PUNCH_LIST_RESOLVE,
    ACTIONS.PUNCH_LIST_VERIFY,
    ACTIONS.BUDGET_VIEW,
  ],
  foreman: [
    ACTIONS.DAILY_LOG_CREATE,
    ACTIONS.PUNCH_LIST_CREATE,
    ACTIONS.PUNCH_LIST_RESOLVE,
    ACTIONS.RFI_CREATE,
  ],
  engineer: [
    ACTIONS.SUBMITTAL_CREATE,
    ACTIONS.SUBMITTAL_REVIEW,
    ACTIONS.RFI_CREATE,
    ACTIONS.RFI_RESPOND,
    ACTIONS.PUNCH_LIST_VERIFY,
    ACTIONS.BUDGET_VIEW,
  ],
  contractor: [
    ACTIONS.SUBMITTAL_CREATE,
    ACTIONS.RFI_CREATE,
    ACTIONS.DAILY_LOG_CREATE,
    ACTIONS.PUNCH_LIST_CREATE,
  ],
  inspector: [
    ACTIONS.PUNCH_LIST_CREATE,
    ACTIONS.PUNCH_LIST_VERIFY,
    ACTIONS.RFI_CREATE,
  ],
  owner: [
    ACTIONS.BUDGET_VIEW,
    ACTIONS.RFI_CREATE,
  ],
};

export function canPerform(projectRole: ProjectRole | null, action: Action): boolean {
  if (!projectRole) return false;
  const allowed = PERMISSION_MATRIX[projectRole];
  return allowed ? allowed.includes(action) : false;
}

export function getAllowedActions(projectRole: ProjectRole | null): Action[] {
  if (!projectRole) return [];
  return [...(PERMISSION_MATRIX[projectRole] ?? [])];
}
