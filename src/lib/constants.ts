export const PROJECT_NAME = "RailCommand";

/**
 * Status colors for submittals
 * Maps status string -> Tailwind color class
 */
export const SUBMITTAL_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  conditional: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
};

/**
 * Status colors for RFIs
 */
export const RFI_STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  answered: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-200 text-gray-700",
  overdue: "bg-red-100 text-red-700",
};

/**
 * Status colors for punch list items
 */
export const PUNCH_LIST_STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-blue-100 text-blue-700",
  verified: "bg-emerald-100 text-emerald-700",
};

/**
 * Status colors for milestones
 */
export const MILESTONE_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-700",
  on_track: "bg-emerald-100 text-emerald-700",
  at_risk: "bg-amber-100 text-amber-700",
  behind: "bg-red-100 text-red-700",
  complete: "bg-emerald-200 text-emerald-800",
};

/**
 * Status colors for safety incidents
 */
export const SAFETY_STATUS_COLORS: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_progress: "bg-amber-100 text-amber-700",
  resolved: "bg-blue-100 text-blue-700",
  closed: "bg-emerald-100 text-emerald-700",
};

/**
 * Severity colors for safety incidents
 */
export const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-blue-100 text-blue-700",
};

/**
 * Incident type labels for safety incidents
 */
export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  near_miss: "Near Miss",
  first_aid: "First Aid",
  recordable: "Recordable",
  lost_time: "Lost Time",
  observation: "Observation",
  hazard: "Hazard",
};

/**
 * Status colors for change orders
 */
export const CHANGE_ORDER_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  void: "bg-gray-200 text-gray-500",
};

/**
 * Change order status labels
 */
export const CHANGE_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  void: "Void",
};

/**
 * Status colors for QC/QA reports
 */
export const QCQA_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  open: "bg-red-100 text-red-700",
  in_review: "bg-amber-100 text-amber-700",
  closed: "bg-emerald-100 text-emerald-700",
};

export const QCQA_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  open: "Open",
  in_review: "In Review",
  closed: "Closed",
};

export const QCQA_TYPE_LABELS: Record<string, string> = {
  inspection: "Inspection",
  nonconformance: "Nonconformance",
  test: "Test",
  audit: "Audit",
};

export const QCQA_SEVERITY_LABELS: Record<string, string> = {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
};

/**
 * Status colors for project documents
 */
export const DOCUMENT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-700",
  under_review: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  superseded: "bg-gray-200 text-gray-500",
};

export const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  under_review: "Under Review",
  approved: "Approved",
  superseded: "Superseded",
};

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  drawing: "Drawing",
  specification: "Specification",
  submittal: "Submittal",
  report: "Report",
  contract: "Contract",
  correspondence: "Correspondence",
  photo_log: "Photo Log",
  other: "Other",
};

/**
 * Status colors for modifications
 */
export const MODIFICATION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  issued: "bg-blue-100 text-blue-700",
  acknowledged: "bg-amber-100 text-amber-700",
  implemented: "bg-emerald-100 text-emerald-700",
  void: "bg-gray-200 text-gray-500",
};

/**
 * Modification status labels
 */
export const MODIFICATION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  acknowledged: "Acknowledged",
  implemented: "Implemented",
  void: "Void",
};

/**
 * Modification type labels
 */
export const MODIFICATION_TYPE_LABELS: Record<string, string> = {
  plan_revision: "Plan Revision",
  spec_amendment: "Spec Amendment",
  contract_amendment: "Contract Amendment",
  design_change: "Design Change",
  scope_change: "Scope Change",
};

/**
 * Status colors for weekly reports
 */
export const WEEKLY_REPORT_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

/**
 * Weekly report status labels
 */
export const WEEKLY_REPORT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
};

/**
 * Weekly report type labels
 */
export const WEEKLY_REPORT_TYPE_LABELS: Record<string, string> = {
  cm: "CM Report",
  contractor: "Contractor Report",
};

/**
 * All status color maps grouped for convenience
 */
export const STATUS_COLORS = {
  submittal: SUBMITTAL_STATUS_COLORS,
  rfi: RFI_STATUS_COLORS,
  punchList: PUNCH_LIST_STATUS_COLORS,
  milestone: MILESTONE_STATUS_COLORS,
  safety: SAFETY_STATUS_COLORS,
  changeOrder: CHANGE_ORDER_STATUS_COLORS,
  weeklyReport: WEEKLY_REPORT_STATUS_COLORS,
  modification: MODIFICATION_STATUS_COLORS,
  qcqa: QCQA_STATUS_COLORS,
  document: DOCUMENT_STATUS_COLORS,
} as const;

/**
 * Priority level colors
 */
export const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-300",
  high: "bg-orange-100 text-orange-700 border-orange-300",
  medium: "bg-amber-100 text-amber-700 border-amber-300",
  low: "bg-blue-100 text-blue-700 border-blue-300",
  none: "bg-gray-100 text-gray-600 border-gray-300",
};

/**
 * Available project roles
 */
export const PROJECT_ROLES = [
  "Project Manager",
  "Superintendent",
  "Foreman",
  "Engineer",
  "Architect",
  "Inspector",
  "Subcontractor",
  "Owner / Client",
  "Safety Manager",
  "Estimator",
  "Scheduler",
  "Admin",
] as const;

export type ProjectRole = (typeof PROJECT_ROLES)[number];

/**
 * Main navigation items (dynamic per project)
 */
export interface NavItem {
  label: string;
  href: string;
  icon: string;
  requiresProject?: boolean;
}

export function getNavItems(projectId: string): NavItem[] {
  return [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "Submittals", href: projectId ? `/projects/${projectId}/submittals` : "#", icon: "FileCheck", requiresProject: true },
    { label: "RFIs", href: projectId ? `/projects/${projectId}/rfis` : "#", icon: "MessageSquareMore", requiresProject: true },
    { label: "Daily Logs", href: projectId ? `/projects/${projectId}/daily-logs` : "#", icon: "ClipboardList", requiresProject: true },
    { label: "Punch List", href: projectId ? `/projects/${projectId}/punch-list` : "#", icon: "ListChecks", requiresProject: true },
    { label: "Safety", href: projectId ? `/projects/${projectId}/safety` : "#", icon: "ShieldAlert", requiresProject: true },
    { label: "QC/QA", href: projectId ? `/projects/${projectId}/qcqa` : "#", icon: "ClipboardCheck2", requiresProject: true },
    { label: "Documents", href: projectId ? `/projects/${projectId}/documents` : "#", icon: "FolderOpen", requiresProject: true },
    { label: "Photos", href: projectId ? `/projects/${projectId}/photos` : "#", icon: "Camera", requiresProject: true },
    { label: "Reports", href: projectId ? `/projects/${projectId}/weekly-reports` : "#", icon: "FileBarChart", requiresProject: true },
    { label: "Schedule", href: projectId ? `/projects/${projectId}/schedule` : "#", icon: "CalendarRange", requiresProject: true },
    { label: "Team", href: projectId ? `/projects/${projectId}/team` : "#", icon: "Users", requiresProject: true },
  ];
}
