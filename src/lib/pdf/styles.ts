import { StyleSheet } from '@react-pdf/renderer';

// ---------- Color tokens ----------
export const colors = {
  primary: '#1e293b',       // slate-800
  secondary: '#64748b',     // slate-500
  border: '#e2e8f0',        // slate-200
  headerBg: '#0f172a',      // slate-900
  headerText: '#ffffff',
  rowAlt: '#f8fafc',        // slate-50
  white: '#ffffff',

  // Status colors
  statusApproved: '#059669',    // emerald-600
  statusOnTrack: '#059669',
  statusComplete: '#059669',
  statusVerified: '#059669',

  statusRejected: '#dc2626',    // red-600
  statusCritical: '#dc2626',
  statusBehind: '#dc2626',
  statusOverdue: '#dc2626',

  statusConditional: '#d97706', // amber-600
  statusAtRisk: '#d97706',
  statusInProgress: '#d97706',

  statusOpen: '#2563eb',        // blue-600
  statusSubmitted: '#2563eb',
  statusUnderReview: '#2563eb',
  statusAnswered: '#2563eb',

  statusDraft: '#6b7280',       // gray-500
  statusNotStarted: '#6b7280',
  statusResolved: '#6b7280',
  statusClosed: '#6b7280',

  // Priority colors
  priorityCritical: '#dc2626',
  priorityHigh: '#ea580c',     // orange-600
  priorityMedium: '#d97706',   // amber-600
  priorityLow: '#2563eb',      // blue-600
} as const;

export const statusColorMap: Record<string, string> = {
  approved: colors.statusApproved,
  on_track: colors.statusOnTrack,
  complete: colors.statusComplete,
  verified: colors.statusVerified,

  rejected: colors.statusRejected,
  critical: colors.statusCritical,
  behind: colors.statusBehind,
  overdue: colors.statusOverdue,

  conditional: colors.statusConditional,
  at_risk: colors.statusAtRisk,
  in_progress: colors.statusInProgress,

  open: colors.statusOpen,
  submitted: colors.statusSubmitted,
  under_review: colors.statusUnderReview,
  answered: colors.statusAnswered,

  draft: colors.statusDraft,
  not_started: colors.statusNotStarted,
  resolved: colors.statusResolved,
  closed: colors.statusClosed,
};

export const priorityColorMap: Record<string, string> = {
  critical: colors.priorityCritical,
  high: colors.priorityHigh,
  medium: colors.priorityMedium,
  low: colors.priorityLow,
};

// ---------- Shared stylesheet ----------
const styles = StyleSheet.create({
  // Page
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 40,
    color: colors.primary,
  },

  // Header
  header: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: colors.headerBg,
  },
  brandSubtitle: {
    fontSize: 8,
    color: colors.secondary,
    marginTop: 1,
  },
  reportTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.headerBg,
    marginTop: 6,
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 8,
    color: colors.secondary,
    marginBottom: 1,
  },
  headerDivider: {
    borderBottomWidth: 2,
    borderBottomColor: colors.headerBg,
    marginTop: 8,
    marginBottom: 12,
  },

  // Summary / KPI section
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    padding: 8,
    backgroundColor: colors.rowAlt,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: colors.headerBg,
  },
  summaryLabel: {
    fontSize: 7,
    color: colors.secondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // Section
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.headerBg,
    marginTop: 10,
    marginBottom: 6,
  },
  sectionBody: {
    fontSize: 9,
    color: colors.primary,
    lineHeight: 1.5,
    marginBottom: 10,
  },

  // Table
  table: {
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.headerBg,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: colors.headerText,
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.rowAlt,
  },
  tableCell: {
    fontSize: 8,
    color: colors.primary,
  },

  // Text styles
  heading: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.headerBg,
    marginBottom: 6,
  },
  subheading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginBottom: 4,
  },
  body: {
    fontSize: 9,
    color: colors.primary,
    lineHeight: 1.5,
  },
  label: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.secondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontSize: 9,
    color: colors.primary,
    marginBottom: 6,
  },

  // Status badge
  badge: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 3,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  footerText: {
    fontSize: 7,
    color: colors.secondary,
  },
});

export default styles;
