import type { ProjectMember } from './types';

export const ACTIONS = {
  SUBMITTAL_CREATE: 'submittal:create',
  SUBMITTAL_REVIEW: 'submittal:review',
  RFI_CREATE: 'rfi:create',
  RFI_RESPOND: 'rfi:respond',
  RFI_CLOSE: 'rfi:close',
  DAILY_LOG_CREATE: 'daily_log:create',
  DAILY_LOG_UPDATE: 'daily_log:update',
  PUNCH_LIST_CREATE: 'punch_list:create',
  PUNCH_LIST_RESOLVE: 'punch_list:resolve',
  PUNCH_LIST_VERIFY: 'punch_list:verify',
  TEAM_MANAGE: 'team:manage',
  PROJECT_MANAGE: 'project:manage',
  PROJECT_EDIT: 'project:edit',
  SCHEDULE_EDIT: 'schedule:edit',
  BUDGET_VIEW: 'budget:view',
  CHANGE_ORDER_MANAGE: 'change_order:manage',
  WEEKLY_REPORT_CREATE: 'weekly_report:create',
  QCQA_CREATE: 'qcqa:create',
  QCQA_CLOSE: 'qcqa:close',
  DOCUMENT_MANAGE: 'document:manage',
  EARTHCAM_VIEW: 'earthcam:view',
  EARTHCAM_ADMIN: 'earthcam:admin',
  EARTHCAM_MANAGE: 'earthcam:manage',
  EARTHCAM_EMBED_MANAGE: 'earthcam_embed:manage',
  EARTHCAM_CAPTURE: 'earthcam:capture',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

type ProjectRole = ProjectMember['project_role'];

const ALL_ACTIONS = Object.values(ACTIONS);
const CAN_EDIT_ACTIONS: readonly Action[] = [
  ACTIONS.EARTHCAM_EMBED_MANAGE,
];

export const PERMISSION_MATRIX: Record<ProjectRole, readonly Action[]> = {
  manager: ALL_ACTIONS,
  superintendent: [
    ACTIONS.SUBMITTAL_CREATE,
    ACTIONS.SUBMITTAL_REVIEW,
    ACTIONS.RFI_CREATE,
    ACTIONS.RFI_RESPOND,
    ACTIONS.RFI_CLOSE,
    ACTIONS.DAILY_LOG_CREATE,
    ACTIONS.DAILY_LOG_UPDATE,
    ACTIONS.PUNCH_LIST_CREATE,
    ACTIONS.PUNCH_LIST_RESOLVE,
    ACTIONS.PUNCH_LIST_VERIFY,
    ACTIONS.PROJECT_EDIT,
    ACTIONS.SCHEDULE_EDIT,
    ACTIONS.BUDGET_VIEW,
    ACTIONS.CHANGE_ORDER_MANAGE,
    ACTIONS.WEEKLY_REPORT_CREATE,
    ACTIONS.QCQA_CREATE,
    ACTIONS.QCQA_CLOSE,
    ACTIONS.DOCUMENT_MANAGE,
    ACTIONS.EARTHCAM_VIEW,
    ACTIONS.EARTHCAM_MANAGE,
    ACTIONS.EARTHCAM_EMBED_MANAGE,
    ACTIONS.EARTHCAM_CAPTURE,
  ],
  foreman: [
    ACTIONS.DAILY_LOG_CREATE,
    ACTIONS.DAILY_LOG_UPDATE,
    ACTIONS.PUNCH_LIST_CREATE,
    ACTIONS.PUNCH_LIST_RESOLVE,
    ACTIONS.RFI_CREATE,
    ACTIONS.EARTHCAM_VIEW,
    ACTIONS.EARTHCAM_CAPTURE,
  ],
  engineer: [
    ACTIONS.SUBMITTAL_CREATE,
    ACTIONS.SUBMITTAL_REVIEW,
    ACTIONS.RFI_CREATE,
    ACTIONS.RFI_RESPOND,
    ACTIONS.PUNCH_LIST_VERIFY,
    ACTIONS.PROJECT_EDIT,
    ACTIONS.SCHEDULE_EDIT,
    ACTIONS.BUDGET_VIEW,
    ACTIONS.CHANGE_ORDER_MANAGE,
    ACTIONS.WEEKLY_REPORT_CREATE,
    ACTIONS.QCQA_CREATE,
    ACTIONS.QCQA_CLOSE,
    ACTIONS.DOCUMENT_MANAGE,
    ACTIONS.EARTHCAM_VIEW,
    ACTIONS.EARTHCAM_MANAGE,
    ACTIONS.EARTHCAM_EMBED_MANAGE,
    ACTIONS.EARTHCAM_CAPTURE,
  ],
  contractor: [
    ACTIONS.SUBMITTAL_CREATE,
    ACTIONS.RFI_CREATE,
    ACTIONS.DAILY_LOG_CREATE,
    ACTIONS.DAILY_LOG_UPDATE,
    ACTIONS.PUNCH_LIST_CREATE,
    ACTIONS.WEEKLY_REPORT_CREATE,
    ACTIONS.EARTHCAM_VIEW,
    ACTIONS.EARTHCAM_CAPTURE,
  ],
  inspector: [
    ACTIONS.PUNCH_LIST_CREATE,
    ACTIONS.PUNCH_LIST_VERIFY,
    ACTIONS.RFI_CREATE,
    ACTIONS.QCQA_CREATE,
    ACTIONS.QCQA_CLOSE,
    ACTIONS.EARTHCAM_VIEW,
    ACTIONS.EARTHCAM_CAPTURE,
  ],
  owner: [
    ACTIONS.BUDGET_VIEW,
    ACTIONS.RFI_CREATE,
    ACTIONS.EARTHCAM_VIEW,
  ],
};

export function canPerform(projectRole: ProjectRole | null, action: Action): boolean {
  if (!projectRole) return false;
  const allowed = PERMISSION_MATRIX[projectRole];
  return allowed ? allowed.includes(action) : false;
}

export function canPerformWithProjectEdit(
  projectRole: ProjectRole | null,
  canEdit: boolean,
  action: Action
): boolean {
  return canPerform(projectRole, action) || (canEdit && CAN_EDIT_ACTIONS.includes(action));
}

export function getAllowedActions(projectRole: ProjectRole | null): Action[] {
  if (!projectRole) return [];
  return [...(PERMISSION_MATRIX[projectRole] ?? [])];
}

export function getAllowedActionsWithProjectEdit(
  projectRole: ProjectRole | null,
  canEdit: boolean
): Action[] {
  const allowed = new Set(getAllowedActions(projectRole));
  if (canEdit) {
    CAN_EDIT_ACTIONS.forEach((action) => allowed.add(action));
  }
  return [...allowed];
}
