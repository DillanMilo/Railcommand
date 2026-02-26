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
  approved_as_noted: "bg-lime-100 text-lime-700",
  rejected: "bg-red-100 text-red-700",
  revise_resubmit: "bg-orange-100 text-orange-700",
  closed: "bg-gray-200 text-gray-500",
};

/**
 * Status colors for RFIs
 */
export const RFI_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  open: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  answered: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-200 text-gray-500",
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
  ready_for_review: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-200 text-gray-500",
};

/**
 * Status colors for milestones
 */
export const MILESTONE_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  on_track: "bg-emerald-100 text-emerald-700",
  at_risk: "bg-amber-100 text-amber-700",
  delayed: "bg-red-100 text-red-700",
  behind: "bg-red-100 text-red-700",
  completed: "bg-emerald-200 text-emerald-800",
  complete: "bg-emerald-200 text-emerald-800",
};

/**
 * All status color maps grouped for convenience
 */
export const STATUS_COLORS = {
  submittal: SUBMITTAL_STATUS_COLORS,
  rfi: RFI_STATUS_COLORS,
  punchList: PUNCH_LIST_STATUS_COLORS,
  milestone: MILESTONE_STATUS_COLORS,
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
 * Main navigation items
 */
export const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Submittals", href: "/projects/proj-001/submittals", icon: "FileCheck" },
  { label: "RFIs", href: "/projects/proj-001/rfis", icon: "MessageSquareMore" },
  { label: "Daily Logs", href: "/projects/proj-001/daily-logs", icon: "ClipboardList" },
  { label: "Punch List", href: "/projects/proj-001/punch-list", icon: "ListChecks" },
  { label: "Schedule", href: "/projects/proj-001/schedule", icon: "CalendarRange" },
  { label: "Team", href: "/projects/proj-001/team", icon: "Users" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
