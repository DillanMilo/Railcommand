export interface PatchNote {
  id: string;
  version: string;
  title: string;
  description: string;
  date: string; // ISO date
}

export const PATCH_NOTES: PatchNote[] = [
  {
    id: 'v1.12.0',
    version: '1.12.0',
    title: 'Project Documents',
    description: 'New Documents section in the sidebar. Track drawings, specifications, contracts, reports, and correspondence with revision numbers, categories, and an approval workflow (Draft → Issued → Under Review → Approved → Superseded).',
    date: '2026-04-14',
  },
  {
    id: 'v1.11.0',
    version: '1.11.0',
    title: 'QC/QA Reports',
    description: 'New QC/QA section in the sidebar. Create inspection reports, nonconformance reports (NCRs), tests, and audits. Track findings, corrective actions, and severity. Link QC/QA items directly to Punch List items for bidirectional traceability.',
    date: '2026-04-14',
  },
  {
    id: 'v1.10.0',
    version: '1.10.0',
    title: 'Modifications & Amendments',
    description: 'Track plan revisions, spec amendments, contract changes, design changes, and scope modifications in the Schedule module. Each modification tracks revision number, affected documents, and follows a Draft → Issued → Acknowledged → Implemented workflow.',
    date: '2026-04-13',
  },
  {
    id: 'v1.9.0',
    version: '1.9.0',
    title: 'Weekly Reports',
    description: 'New Reports section in the sidebar. Submit CM and Contractor weekly reports with structured sections: work summary, schedule, safety, weather, issues, and upcoming work. Includes workforce metrics, status workflow (Draft → Submitted → Approved), and filterable list view.',
    date: '2026-04-13',
  },
  {
    id: 'v1.8.0',
    version: '1.8.0',
    title: 'Change Orders',
    description: 'Track budget modifications with Change Orders in the Schedule module. Create, submit, approve/reject, and void COs with amount tracking. Approved COs automatically adjust the dashboard budget total and CPI/SPI calculations.',
    date: '2026-04-12',
  },
  {
    id: 'v1.7.0',
    version: '1.7.0',
    title: 'Safety Module',
    description: 'New Safety section in the sidebar. Report incidents with type (Near Miss, First Aid, Recordable, Lost Time, Observation, Hazard), severity, and location. Track through Open → In Progress → Resolved → Closed with investigation fields for root cause and corrective action.',
    date: '2026-04-10',
  },
  {
    id: 'v1.6.0',
    version: '1.6.0',
    title: 'CPI/SPI Metrics, Benchmark Dates & More',
    description: 'Dashboard now shows CPI and SPI earned value indicators (color-coded). Schedule benchmark dates (Turnover, Substantial Completion, Project Completion) editable in project settings. Daily logs calendar shows full 7-day week. Activity feed entries are now tappable.',
    date: '2026-04-09',
  },
  {
    id: 'v1.5.0',
    version: '1.5.0',
    title: 'Notification Categories & RailBot Updates',
    description: 'Notifications organized into collapsible Updates + Activity categories with read/dismiss. Ask RailBot "What\'s new?" for a summary.',
    date: '2026-04-09',
  },
  {
    id: 'v1.4.0',
    version: '1.4.0',
    title: 'Backend Security & Private Photo Storage',
    description: 'Project photos now use private signed URLs. Client bundle verified clean of server secrets.',
    date: '2026-04-09',
  },
  {
    id: 'v1.3.0',
    version: '1.3.0',
    title: 'Profile, Settings & Onboarding',
    description: 'Avatar upload, password reset, timezone selector, and a new 3-step welcome wizard for first-time users.',
    date: '2026-04-08',
  },
  {
    id: 'v1.2.0',
    version: '1.2.0',
    title: 'Dashboard & Navigation Upgrades',
    description: 'Dashboard stat cards are now clickable and pre-filter module pages. Sidebar spacing tightened. Notification bell wired to live activity feed.',
    date: '2026-04-08',
  },
  {
    id: 'v1.1.0',
    version: '1.1.0',
    title: 'Email Notifications',
    description: '8 notification types via Resend: assignments, status changes, overdue digests, daily log reminders, and team updates.',
    date: '2026-04-06',
  },
];
