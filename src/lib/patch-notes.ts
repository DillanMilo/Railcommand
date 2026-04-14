export interface PatchNote {
  id: string;
  version: string;
  title: string;
  description: string;
  date: string; // ISO date
}

export const PATCH_NOTES: PatchNote[] = [
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
