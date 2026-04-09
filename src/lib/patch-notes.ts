export interface PatchNote {
  id: string;
  version: string;
  title: string;
  description: string;
  date: string; // ISO date
}

export const PATCH_NOTES: PatchNote[] = [
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
