import { createHmac, timingSafeEqual } from 'crypto';
import type { ComponentType, ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  Building2,
  ChevronRight,
  Clock3,
  FlaskConical,
  FolderKanban,
  LockKeyhole,
  LogOut,
  Mail,
  MailCheck,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import styles from './client.module.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Client Dashboard',
  robots: {
    index: false,
    follow: false,
  },
};

const CLIENT_DASHBOARD_COOKIE = 'rc-client-dashboard-unlocked';
const GATE_PURPOSE = 'client-dashboard';
const UNLOCK_WINDOW_MS = 15 * 60 * 1000;
const UNLOCK_ATTEMPT_LIMIT = 12;

const unlockAttempts = new Map<string, { count: number; resetAt: number }>();

type OrganizationRow = {
  id: string;
  name: string;
  type: string | null;
  tier: string | null;
  is_demo?: boolean | null;
  created_at: string;
};

type ProjectRow = {
  id: string;
  name: string;
  client: string | null;
  organization_id: string | null;
  budget_total: number | null;
  status: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  organization_id: string | null;
  created_at: string;
};

type ProjectMemberRow = {
  id: string;
  profile_id: string;
  project_id: string;
  project_role: string;
  can_edit: boolean | null;
  added_at: string;
};

type InvitationRow = {
  id: string;
  email: string;
  project_id: string;
  project_role: string;
  status: string;
  expires_at: string;
  created_at: string;
};

type DemoAccountRow = {
  id: string;
  slug: string;
  company_name: string;
  organization_id: string | null;
  project_id: string | null;
  is_active: boolean;
  is_team_demo: boolean;
  access_count: number | null;
  last_accessed_at: string | null;
  created_at: string;
};

type DemoLoginRow = {
  profile_id: string;
  display_name: string;
  project_role: string;
};

type AuthUserSummary = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string;
};

type ActivityRow = {
  id: string;
  project_id: string;
  entity_type: string;
  action: string;
  description: string;
  performed_by: string | null;
  created_at: string;
};

type EmailEventRow = {
  id: string;
  type: string;
  recipient_email: string | null;
  recipient_count: number;
  subject: string | null;
  status: 'sent' | 'failed' | 'suppressed' | 'skipped';
  error_message: string | null;
  created_at: string;
};

type EmailMetrics = {
  available: boolean;
  totalSent: number;
  failed: number;
  sentLast7Days: number;
  recent: EmailEventRow[];
  reason?: string;
};

type DashboardData = {
  authUsers: AuthUserSummary[];
  organizations: OrganizationRow[];
  projects: ProjectRow[];
  profiles: ProfileRow[];
  projectMembers: ProjectMemberRow[];
  invitations: InvitationRow[];
  demoAccounts: DemoAccountRow[];
  demoLogins: DemoLoginRow[];
  activity: ActivityRow[];
  emailMetrics: EmailMetrics;
};

function getDashboardPassword(): string | null {
  const password = process.env.ADMIN_DASHBOARD_PASSWORD?.trim();
  return password && password.length >= 8 ? password : null;
}

function getGateSignature(): string | null {
  const password = getDashboardPassword();
  if (!password) return null;
  return createHmac('sha256', password).update(GATE_PURPOSE).digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function checkUnlockRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = unlockAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    unlockAttempts.set(key, { count: 1, resetAt: now + UNLOCK_WINDOW_MS });
    return true;
  }

  if (entry.count >= UNLOCK_ATTEMPT_LIMIT) return false;
  entry.count += 1;
  return true;
}

async function getRequestKey(): Promise<string> {
  const headerStore = await headers();
  return (
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

async function isUnlocked(): Promise<boolean> {
  const signature = getGateSignature();
  if (!signature) return false;

  const stored = (await cookies()).get(CLIENT_DASHBOARD_COOKIE)?.value;
  if (!stored || stored.length !== signature.length) return false;

  return safeCompare(stored, signature);
}

export async function unlockClientDashboard(formData: FormData) {
  'use server';

  const password = getDashboardPassword();
  if (!password) redirect('/client?error=config');

  if (!checkUnlockRateLimit(await getRequestKey())) {
    redirect('/client?error=rate');
  }

  const entered = String(formData.get('password') ?? '');
  if (!safeCompare(entered, password)) {
    redirect('/client?error=invalid');
  }

  const signature = getGateSignature();
  if (!signature) redirect('/client?error=config');

  (await cookies()).set(CLIENT_DASHBOARD_COOKIE, signature, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/client',
    maxAge: 60 * 60 * 8,
  });

  redirect('/client');
}

export async function lockClientDashboard() {
  'use server';

  (await cookies()).set(CLIENT_DASHBOARD_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/client',
    maxAge: 0,
  });

  redirect('/client');
}

async function getAuthUsers(): Promise<AuthUserSummary[]> {
  const admin = createAdminClient();
  const users: AuthUserSummary[] = [];
  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    users.push(...(data.users as AuthUserSummary[]));
    if (data.users.length < 1000) break;
    page += 1;
  }

  return users;
}

async function getEmailMetrics(): Promise<EmailMetrics> {
  const admin = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalSent, failed, sentLast7Days, recent] = await Promise.all([
    admin.from('email_events').select('id', { count: 'exact', head: true }).eq('status', 'sent'),
    admin.from('email_events').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    admin
      .from('email_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('created_at', sevenDaysAgo),
    admin
      .from('email_events')
      .select('id, type, recipient_email, recipient_count, subject, status, error_message, created_at')
      .order('created_at', { ascending: false })
      .limit(12),
  ]);

  const firstError = totalSent.error ?? failed.error ?? sentLast7Days.error ?? recent.error;
  if (firstError) {
    return {
      available: false,
      totalSent: 0,
      failed: 0,
      sentLast7Days: 0,
      recent: [],
      reason: firstError.message,
    };
  }

  return {
    available: true,
    totalSent: totalSent.count ?? 0,
    failed: failed.count ?? 0,
    sentLast7Days: sentLast7Days.count ?? 0,
    recent: (recent.data ?? []) as EmailEventRow[],
  };
}

async function getDashboardData(): Promise<DashboardData> {
  const admin = createAdminClient();
  const [
    authUsers,
    organizations,
    projects,
    profiles,
    projectMembers,
    invitations,
    demoAccounts,
    demoLogins,
    activity,
    emailMetrics,
  ] = await Promise.all([
    getAuthUsers(),
    admin.from('organizations').select('id, name, type, tier, is_demo, created_at').order('created_at', { ascending: false }),
    admin.from('projects').select('id, name, client, organization_id, budget_total, status, created_at').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, email, full_name, role, organization_id, created_at').order('created_at', { ascending: false }),
    admin.from('project_members').select('id, profile_id, project_id, project_role, can_edit, added_at').order('added_at', { ascending: false }),
    admin.from('project_invitations').select('id, email, project_id, project_role, status, expires_at, created_at').order('created_at', { ascending: false }),
    admin.from('demo_accounts').select('id, slug, company_name, organization_id, project_id, is_active, is_team_demo, access_count, last_accessed_at, created_at').order('created_at', { ascending: false }),
    admin.from('demo_team_logins').select('profile_id, display_name, project_role').order('created_at', { ascending: false }),
    admin
      .from('activity_log')
      .select('id, project_id, entity_type, action, description, performed_by, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
    getEmailMetrics(),
  ]);

  const errors = [
    organizations.error,
    projects.error,
    profiles.error,
    projectMembers.error,
    invitations.error,
    demoAccounts.error,
    demoLogins.error,
    activity.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(errors.map((error) => error?.message).join('; '));
  }

  return {
    authUsers,
    organizations: (organizations.data ?? []) as OrganizationRow[],
    projects: (projects.data ?? []) as ProjectRow[],
    profiles: (profiles.data ?? []) as ProfileRow[],
    projectMembers: (projectMembers.data ?? []) as ProjectMemberRow[],
    invitations: (invitations.data ?? []) as InvitationRow[],
    demoAccounts: (demoAccounts.data ?? []) as DemoAccountRow[],
    demoLogins: (demoLogins.data ?? []) as DemoLoginRow[],
    activity: (activity.data ?? []) as ActivityRow[],
    emailMetrics,
  };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatMoney(value: number | null | undefined): string {
  if (!value) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return '-';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isWithinDays(value: string | null | undefined, days: number): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
}

function isDemoEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.endsWith('@demo.railcommand.io') ||
    normalized.endsWith('@demo.railcommand.app') ||
    normalized.endsWith('@railcommand.app')
  );
}

function isDemoOrganization(organization: OrganizationRow): boolean {
  return Boolean(organization.is_demo) || /\bdemo\b/i.test(organization.name);
}

function projectSearchText(values: Array<string | null | undefined>): string {
  return values
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/\bglobal ii\b/g, 'global ii global 2 g2');
}

function roleBadgeClass(role: string | null | undefined): string {
  if (role === 'admin' || role === 'owner' || role === 'manager') {
    return 'rounded-none border-rc-orange/30 bg-orange-50 text-orange-700';
  }
  if (role === 'superintendent' || role === 'foreman' || role === 'engineer') {
    return 'rounded-none border-emerald-300 bg-emerald-50 text-emerald-700';
  }
  return 'rounded-none border-[#d5d8d0] bg-[#efefe9] text-[#63695f]';
}

function emailStatusClass(status: EmailEventRow['status']): string {
  if (status === 'sent') return 'rounded-none border-emerald-300 bg-emerald-50 text-emerald-700';
  if (status === 'failed') return 'rounded-none border-red-300 bg-red-50 text-red-700';
  return 'rounded-none border-[#d5d8d0] bg-[#efefe9] text-[#63695f]';
}

function projectStatusClass(status: string | null | undefined): string {
  if (status === 'active') return 'rounded-none border-emerald-300 bg-emerald-50 text-emerald-700';
  if (status === 'completed') return 'rounded-none border-blue-300 bg-blue-50 text-blue-700';
  if (status === 'on_hold') return 'rounded-none border-amber-300 bg-amber-50 text-amber-800';
  return 'rounded-none border-[#d5d8d0] bg-[#efefe9] text-[#63695f]';
}

function singleSearchParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <article className={styles.metricCard}>
      <div>
        <span>{title}</span>
        <Icon className="size-[18px]" />
      </div>
      <strong>{typeof value === 'number' ? String(value).padStart(2, '0') : value}</strong>
      <p>{description}</p>
    </article>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#7c8277]">{label}</p>
      <div className="mt-1 break-words text-sm text-[#10130f]">{children}</div>
    </div>
  );
}

function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
        {message}
      </TableCell>
    </TableRow>
  );
}

function PasswordGate({ error }: { error?: string }) {
  const passwordConfigured = Boolean(getDashboardPassword());

  return (
    <main className={styles.loginShell}>
      <section className={styles.loginStory}>
        <div className={styles.storyBrand}>
          <span className={styles.brandMark}>RC</span>
          RAILCOMMAND
        </div>
        <div className={styles.storyCopy}>
          <p className={styles.eyebrow}>OWNER INTELLIGENCE / PRIVATE</p>
          <h1>
            Your entire rail operation,
            <br />
            <em>under one command.</em>
          </h1>
          <p>
            Accounts, projects, communications, and field activity—one private command view
            built for the RailCommand owner.
          </p>
        </div>
        <div className={styles.storySignal}>
          <span className={styles.liveDot} />
          LIVE SUPABASE DATA
          <small>Encrypted server connection</small>
        </div>
      </section>

      <section className={styles.loginPanel}>
        <div className={styles.loginCard}>
          <div className={styles.loginMark}>
            <LockKeyhole size={25} strokeWidth={2.4} />
          </div>
          <p className={styles.eyebrow}>AUTHORIZED ACCESS ONLY</p>
          <h2>Owner console</h2>
          <p className={styles.loginIntro}>
            Enter your private RailCommand password to continue.
          </p>
          {!passwordConfigured ? (
            <div className={styles.configError}>
              ADMIN_DASHBOARD_PASSWORD is not configured.
            </div>
          ) : (
            <form action={unlockClientDashboard}>
              <label htmlFor="client-dashboard-password" className={styles.passwordLabel}>
                <span>PRIVATE PASSWORD</span>
                <div className={styles.passwordField}>
                  <input
                  id="client-dashboard-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  />
                  <LockKeyhole size={19} />
                </div>
              </label>
              {error === 'invalid' && (
                <p className={styles.loginError}>Incorrect dashboard password.</p>
              )}
              {error === 'rate' && (
                <p className={styles.loginError}>Too many attempts. Try again later.</p>
              )}
              {error === 'config' && (
                <p className={styles.loginError}>Dashboard password is not configured.</p>
              )}
              <button type="submit" className={styles.unlockButton}>
                Unlock console
                <ArrowRight size={17} />
              </button>
              <div className={styles.securityNote}>
                <ShieldCheck size={15} />
                Protected by a signed, secure 8-hour session.
              </div>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <main className={styles.consoleError}>
      <div>
        <p className={styles.eyebrow}>OWNER CONSOLE / ERROR</p>
        <h1>Dashboard data unavailable</h1>
        <p>{message}</p>
        <form action={lockClientDashboard}>
          <button type="submit" className={styles.lockButton}>
            <LogOut size={16} />
            Lock console
          </button>
        </form>
      </div>
    </main>
  );
}

export default async function ClientDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    error?: string | string[];
    project?: string | string[];
    project_query?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const error = singleSearchParam(params?.error);

  if (!(await isUnlocked())) {
    return <PasswordGate error={error} />;
  }

  let data: DashboardData;
  try {
    data = await getDashboardData();
  } catch (err) {
    return (
      <DashboardError
        message={err instanceof Error ? err.message : 'RailCommand could not load dashboard data.'}
      />
    );
  }

  const orgById = new Map(data.organizations.map((org) => [org.id, org]));
  const projectById = new Map(data.projects.map((project) => [project.id, project]));
  const profileById = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const authById = new Map(data.authUsers.map((user) => [user.id, user]));
  const demoProfileIds = new Set(data.demoLogins.map((login) => login.profile_id).filter(Boolean));
  const demoOrgIds = new Set([
    ...data.demoAccounts.map((demo) => demo.organization_id).filter(Boolean),
    ...data.organizations.filter(isDemoOrganization).map((org) => org.id),
  ]);
  const demoProjectIds = new Set(data.demoAccounts.map((demo) => demo.project_id).filter(Boolean));

  const realOrganizations = data.organizations.filter((org) => !demoOrgIds.has(org.id));
  const realProjects = data.projects.filter(
    (project) =>
      !demoProjectIds.has(project.id) &&
      (!project.organization_id || !demoOrgIds.has(project.organization_id)),
  );
  const realProfiles = data.profiles.filter(
    (profile) => !demoProfileIds.has(profile.id) && !isDemoEmail(profile.email),
  );
  const realAuthUsers = data.authUsers.filter((user) => {
    const profile = profileById.get(user.id);
    const email = user.email ?? profile?.email;
    return !demoProfileIds.has(user.id) && !isDemoEmail(email);
  });
  const pendingInvites = data.invitations.filter((invite) => invite.status === 'pending');
  const recentlyActiveUsers = realAuthUsers.filter((user) => isWithinDays(user.last_sign_in_at, 30));
  const activitiesToday = data.activity.filter((entry) => isWithinDays(entry.created_at, 1));

  const memberCountByProject = new Map<string, number>();
  for (const member of data.projectMembers) {
    memberCountByProject.set(
      member.project_id,
      (memberCountByProject.get(member.project_id) ?? 0) + 1,
    );
  }

  const pendingInviteCountByProject = new Map<string, number>();
  for (const invitation of pendingInvites) {
    pendingInviteCountByProject.set(
      invitation.project_id,
      (pendingInviteCountByProject.get(invitation.project_id) ?? 0) + 1,
    );
  }

  const recentActivityByProject = new Map<string, ActivityRow>();
  for (const entry of data.activity) {
    if (!recentActivityByProject.has(entry.project_id)) {
      recentActivityByProject.set(entry.project_id, entry);
    }
  }

  const projectQuery = singleSearchParam(params?.project_query).trim();
  const normalizedProjectQuery = projectQuery.toLowerCase();
  const projectRows = realProjects
    .map((project) => ({
      project,
      organizationName: project.organization_id
        ? orgById.get(project.organization_id)?.name ?? 'Unknown organization'
        : 'Unassigned',
      memberCount: memberCountByProject.get(project.id) ?? 0,
      pendingInviteCount: pendingInviteCountByProject.get(project.id) ?? 0,
      recentActivity: recentActivityByProject.get(project.id),
    }))
    .filter((row) => {
      if (!normalizedProjectQuery) return true;
      return projectSearchText([
        row.project.name,
        row.project.client,
        row.organizationName,
        row.project.status,
      ]).includes(normalizedProjectQuery);
    });

  const selectedProjectId = singleSearchParam(params?.project);
  const selectedProject = projectRows.find((row) => row.project.id === selectedProjectId);

  const projectsByOrg = new Map<string, ProjectRow[]>();
  for (const project of realProjects) {
    if (!project.organization_id) continue;
    projectsByOrg.set(project.organization_id, [
      ...(projectsByOrg.get(project.organization_id) ?? []),
      project,
    ]);
  }

  const profilesByOrg = new Map<string, ProfileRow[]>();
  for (const profile of realProfiles) {
    if (!profile.organization_id) continue;
    profilesByOrg.set(profile.organization_id, [
      ...(profilesByOrg.get(profile.organization_id) ?? []),
      profile,
    ]);
  }

  const clientRows = realOrganizations.slice(0, 12).map((org) => {
    const orgProjects = projectsByOrg.get(org.id) ?? [];
    const orgProfiles = profilesByOrg.get(org.id) ?? [];
    const latestSignIn = orgProfiles
      .map((profile) => authById.get(profile.id)?.last_sign_in_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];

    return {
      org,
      projectCount: orgProjects.length,
      userCount: orgProfiles.length,
      adminCount: orgProfiles.filter((profile) => profile.role === 'admin' || profile.role === 'manager').length,
      budgetTotal: orgProjects.reduce((sum, project) => sum + (project.budget_total ?? 0), 0),
      latestSignIn,
    };
  });

  const signupRows = realAuthUsers
    .slice()
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, 15)
    .map((authUser) => {
      const profile = profileById.get(authUser.id);
      const organization = profile?.organization_id ? orgById.get(profile.organization_id) : null;
      return {
        id: authUser.id,
        email: authUser.email ?? profile?.email ?? 'Unknown email',
        name: profile?.full_name || 'Unnamed user',
        role: profile?.role,
        organizationName: organization?.name ?? 'Unassigned',
        createdAt: authUser.created_at ?? profile?.created_at,
        lastSignInAt: authUser.last_sign_in_at,
      };
    });

  const activityRows = data.activity.slice(0, 15).map((entry) => {
    const project = projectById.get(entry.project_id);
    const profile = entry.performed_by ? profileById.get(entry.performed_by) : null;
    return {
      ...entry,
      projectName: project?.name ?? 'Unknown project',
      actorName: profile?.full_name || profile?.email || 'System',
      isDemo: demoProjectIds.has(entry.project_id),
    };
  });

  return (
    <main className={styles.consoleShell}>
      <aside className={styles.consoleRail}>
        <div className={styles.consoleBrand}>
          <span className={styles.brandMark}>RC</span>
          <strong>RAIL</strong>
          <em>COMMAND</em>
        </div>
        <div className={styles.railLabel}>OWNER CONSOLE</div>
        <nav aria-label="Owner console sections">
          <Link href="/client#overview" className={styles.activeNav}>
            <ShieldCheck size={17} />
            Overview
          </Link>
          <Link href="/client#projects">
            <FolderKanban size={17} />
            Projects
            <small>{realProjects.length}</small>
          </Link>
          <Link href="/client#activity">
            <Activity size={17} />
            Activity
          </Link>
          <Link href="/client#accounts">
            <Users size={17} />
            Accounts
            <small>{realAuthUsers.length}</small>
          </Link>
        </nav>
        <div className={styles.railSecure}>
          <ShieldCheck size={17} />
          <span>
            <strong>PRIVATE VIEW</strong>
            <small>Server-protected</small>
          </span>
        </div>
      </aside>

      <div className={styles.consoleMain}>
        <header className={styles.consoleTopbar}>
          <div className={styles.mobileConsoleBrand}>
            <span className={styles.brandMark}>RC</span>
            RAILCOMMAND
          </div>
          <div className={styles.topbarStatus}>
            <span className={styles.liveDot} />
            LIVE DATA
            <small>Supabase connected</small>
          </div>
          <form action={lockClientDashboard}>
            <button type="submit" className={styles.lockButton}>
              <LogOut size={16} />
              Lock console
            </button>
          </form>
          <nav className={styles.mobileSectionNav} aria-label="Dashboard sections">
            <Link href="/client#overview">Overview</Link>
            <Link href="/client#projects">Projects</Link>
            <Link href="/client#activity">Activity</Link>
            <Link href="/client#accounts">Accounts</Link>
          </nav>
        </header>

        <div className={styles.consoleContent}>
          <section id="overview" className={styles.consoleHero}>
            <div>
              <p className={styles.eyebrow}>BUSINESS CONTROL / REAL-TIME</p>
              <h1>
                RailCommand
                <br />
                <em>owner intelligence.</em>
              </h1>
              <p>
                A focused view of who is joining, what they are building, and how actively
                RailCommand is being used across every client organization.
              </p>
            </div>
            <div className={styles.healthCard}>
              <div>
                <span className={styles.liveDot} />
                PLATFORM SIGNAL
              </div>
              <strong>ONLINE</strong>
              <p>Supabase connected · operational data current</p>
            </div>
          </section>

          <section className={styles.metricGrid} aria-label="RailCommand owner metrics">
          <StatCard
            title="Emails sent"
            value={data.emailMetrics.available ? data.emailMetrics.totalSent : 'Pending'}
            description={
              data.emailMetrics.available
                ? `${data.emailMetrics.sentLast7Days} sent in the last 7 days`
                : 'Run the email_events migration to start tracking'
            }
            icon={MailCheck}
          />
          <StatCard
            title="Signed up"
            value={realAuthUsers.length}
            description={`${recentlyActiveUsers.length} active in the last 30 days`}
            icon={UserPlus}
          />
          <StatCard
            title="Client orgs"
            value={realOrganizations.length}
            description={`${realProjects.length} non-demo projects`}
            icon={Building2}
          />
          <StatCard
            title="Latest activity"
            value={activitiesToday.length}
            description="Events in the last 24 hours"
            icon={Activity}
          />
          <StatCard
            title="Pending invites"
            value={pendingInvites.length}
            description="Open project invitations"
            icon={Mail}
          />
          <StatCard
            title="Users"
            value={realProfiles.length}
            description="Non-demo profile records"
            icon={Users}
          />
          <StatCard
            title="Active demos"
            value={data.demoAccounts.filter((demo) => demo.is_active).length}
            description={`${data.demoAccounts.reduce((sum, demo) => sum + (demo.access_count ?? 0), 0)} total demo opens`}
            icon={FlaskConical}
          />
          <StatCard
            title="Projects"
            value={realProjects.length}
            description={`${realProjects.filter((project) => project.status === 'active').length} active projects`}
            icon={Clock3}
          />
          </section>

          {!data.emailMetrics.available && (
            <div className="border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900">
              Email send logging is not available yet: {data.emailMetrics.reason ?? 'email_events is unavailable'}.
            </div>
          )}

        <section id="projects" className="scroll-mt-32 lg:scroll-mt-20">
          <Card className={styles.dataPanel}>
            <CardHeader className={styles.panelHead}>
              <div className={styles.panelTitleGroup}>
                <p className={styles.eyebrow}>PORTFOLIO PULSE</p>
                <h2>Project intelligence</h2>
                <p>Search and inspect non-demo projects across client organizations.</p>
              </div>
              <form
                action="/client#projects"
                method="get"
                className={styles.consoleSearch}
              >
                <div className={styles.searchField}>
                  <Search size={16} />
                  <Input
                    name="project_query"
                    defaultValue={projectQuery}
                    placeholder="Search project, client, or organization"
                    aria-label="Search projects"
                  />
                </div>
                <Button type="submit" className={styles.searchButton}>
                  Search
                </Button>
                {projectQuery && (
                  <Button asChild className={styles.clearButton}>
                    <Link href="/client#projects">Clear</Link>
                  </Button>
                )}
              </form>
            </CardHeader>

            {selectedProject && (
              <CardContent className={styles.detailSummary}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading text-lg font-bold leading-snug text-foreground sm:text-xl">
                        {selectedProject.project.name}
                      </h3>
                      <Badge
                        variant="outline"
                        className={projectStatusClass(selectedProject.project.status)}
                      >
                        {formatLabel(selectedProject.project.status)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Read-only operational summary. Project content remains inside the client workspace.
                    </p>
                  </div>
                  <Button asChild className={`${styles.closeButton} w-full shrink-0 sm:w-auto`}>
                    <Link
                      href={
                        projectQuery
                          ? `/client?project_query=${encodeURIComponent(projectQuery)}#projects`
                          : '/client#projects'
                      }
                    >
                      Close details
                    </Link>
                  </Button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
                  {[
                    { label: 'Organization', value: selectedProject.organizationName },
                    { label: 'Client', value: selectedProject.project.client || 'Not specified' },
                    { label: 'Created', value: formatDate(selectedProject.project.created_at) },
                    { label: 'Assigned users', value: selectedProject.memberCount },
                    { label: 'Pending invitations', value: selectedProject.pendingInviteCount },
                    {
                      label: 'Latest activity',
                      value: selectedProject.recentActivity
                        ? formatDateTime(selectedProject.recentActivity.created_at)
                        : 'No recent event',
                    },
                  ].map((field) => (
                    <div key={field.label} className={`${styles.detailField} p-3`}>
                      <MobileField label={field.label}>{field.value}</MobileField>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}

            <CardContent className="border-t border-border/80 p-0">
              <div className="flex items-center justify-between gap-4 px-4 py-3 text-xs text-muted-foreground sm:text-sm">
                <span>
                  {projectRows.length} {projectRows.length === 1 ? 'project' : 'projects'}
                  {projectQuery ? ` matching “${projectQuery}”` : ''}
                </span>
                <span className="hidden lg:inline">Select a project for details</span>
              </div>
              <div className="grid gap-3 border-t p-3 sm:p-4 md:grid-cols-2 lg:hidden">
                {projectRows.map((row) => (
                  <Link
                    key={row.project.id}
                    href={`/client?${new URLSearchParams({
                      ...(projectQuery ? { project_query: projectQuery } : {}),
                      project: row.project.id,
                    }).toString()}#projects`}
                    className={`${styles.mobileDataCard} block p-3.5 transition-colors hover:border-rc-orange/40 hover:bg-orange-50 sm:p-4 ${
                      selectedProjectId === row.project.id ? 'border-rc-orange/50 bg-rc-orange/5' : 'bg-background'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium text-foreground">{row.project.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{row.organizationName}</p>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
                      <MobileField label="Client">{row.project.client || 'Not specified'}</MobileField>
                      <MobileField label="Status">
                        <Badge variant="outline" className={projectStatusClass(row.project.status)}>
                          {formatLabel(row.project.status)}
                        </Badge>
                      </MobileField>
                      <MobileField label="Users">{row.memberCount}</MobileField>
                      <MobileField label="Created">{formatDate(row.project.created_at)}</MobileField>
                    </div>
                  </Link>
                ))}
                {projectRows.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No projects match this search.
                  </div>
                )}
              </div>
              <div className="hidden overflow-x-auto border-t lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-rc-card">
                      <TableHead>Project</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-12">
                        <span className="sr-only">View details</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectRows.map((row) => {
                      const projectHref = `/client?${new URLSearchParams({
                        ...(projectQuery ? { project_query: projectQuery } : {}),
                        project: row.project.id,
                      }).toString()}#projects`;

                      return (
                        <TableRow
                          key={row.project.id}
                          className={selectedProjectId === row.project.id ? 'bg-rc-orange/5' : undefined}
                        >
                          <TableCell>
                            <Link
                              href={projectHref}
                              className="font-medium text-foreground hover:text-rc-orange hover:underline"
                            >
                              {row.project.name}
                            </Link>
                          </TableCell>
                          <TableCell>{row.organizationName}</TableCell>
                          <TableCell>{row.project.client || 'Not specified'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={projectStatusClass(row.project.status)}>
                              {formatLabel(row.project.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>{row.memberCount}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(row.project.created_at)}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon-sm" asChild>
                              <Link href={projectHref} aria-label={`View ${row.project.name}`}>
                                <ChevronRight className="size-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {projectRows.length === 0 && (
                      <EmptyRow colSpan={7} message="No projects match this search." />
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>

        <section
          id="activity"
          className="grid scroll-mt-32 gap-4 lg:scroll-mt-20 2xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
        >
          <Card className={styles.dataPanel}>
            <CardHeader className={styles.panelHead}>
              <div className={styles.panelTitleGroup}>
                <p className={styles.eyebrow}>LATEST SIGNALS</p>
                <h2>Recent activity</h2>
                <p>Most recent project events across RailCommand.</p>
              </div>
              <Activity size={19} />
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 lg:hidden">
                {activityRows.map((entry) => (
                  <div key={entry.id} className={`${styles.mobileDataCard} p-3.5 sm:p-4`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{entry.description || formatLabel(entry.action)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{entry.projectName}</p>
                      </div>
                      <Badge variant="outline" className={roleBadgeClass(entry.action)}>
                        {formatLabel(entry.entity_type)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
                      <MobileField label="Actor">{entry.actorName}</MobileField>
                      <MobileField label="When">{formatDateTime(entry.created_at)}</MobileField>
                    </div>
                  </div>
                ))}
                {activityRows.length === 0 && (
                  <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No activity found.
                  </div>
                )}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-rc-card">
                      <TableHead>Event</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityRows.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="max-w-[520px] font-medium">{entry.description || formatLabel(entry.action)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatLabel(entry.action)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{entry.projectName}</span>
                            {entry.isDemo && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{entry.actorName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{formatLabel(entry.entity_type)}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(entry.created_at)}</TableCell>
                      </TableRow>
                    ))}
                    {activityRows.length === 0 && <EmptyRow colSpan={5} message="No activity found." />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className={styles.dataPanel}>
            <CardHeader className={styles.panelHead}>
              <div className={styles.panelTitleGroup}>
                <p className={styles.eyebrow}>COMMUNICATION SIGNAL</p>
                <h2>Email activity</h2>
                <p>Recent application email attempts logged by RailCommand.</p>
              </div>
              <MailCheck size={19} />
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 lg:hidden">
                {data.emailMetrics.recent.map((event) => (
                  <div key={event.id} className={`${styles.mobileDataCard} p-3.5 sm:p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{formatLabel(event.type)}</p>
                        {event.subject && (
                          <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                            {event.subject}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={emailStatusClass(event.status)}>
                        {formatLabel(event.status)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
                      <MobileField label="Recipient">
                        <span className="break-all">
                          {event.recipient_email ?? `${event.recipient_count} recipients`}
                        </span>
                      </MobileField>
                      <MobileField label="When">{formatDateTime(event.created_at)}</MobileField>
                    </div>
                  </div>
                ))}
                {data.emailMetrics.recent.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground md:col-span-2">
                    {data.emailMetrics.available
                      ? 'No email events logged yet.'
                      : 'Email logging is not available yet.'}
                  </div>
                )}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-rc-card">
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.emailMetrics.recent.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div className="font-medium">{formatLabel(event.type)}</div>
                          {event.subject && (
                            <div className="mt-1 max-w-[320px] truncate text-xs text-muted-foreground">
                              {event.subject}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={emailStatusClass(event.status)}>
                            {formatLabel(event.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-muted-foreground">
                          {event.recipient_email ?? `${event.recipient_count} recipients`}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(event.created_at)}</TableCell>
                      </TableRow>
                    ))}
                    {data.emailMetrics.recent.length === 0 && (
                      <EmptyRow
                        colSpan={4}
                        message={data.emailMetrics.available ? 'No email events logged yet.' : 'Email logging is not available yet.'}
                      />
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>

        <section
          id="accounts"
          className="grid scroll-mt-32 gap-4 lg:scroll-mt-20 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
        >
          <Card className={styles.dataPanel}>
            <CardHeader className={styles.panelHead}>
              <div className={styles.panelTitleGroup}>
                <p className={styles.eyebrow}>CUSTOMER ADOPTION</p>
                <h2>Account intelligence</h2>
                <p>Latest non-demo Supabase auth users.</p>
              </div>
              <UserPlus size={19} />
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 lg:hidden">
                {signupRows.map((row) => (
                  <div key={row.id} className={`${styles.mobileDataCard} p-3.5 sm:p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{row.name}</p>
                        <p className="mt-1 break-all text-xs text-muted-foreground">{row.email}</p>
                      </div>
                      <Badge variant="outline" className={roleBadgeClass(row.role)}>
                        {formatLabel(row.role)}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
                      <MobileField label="Organization">{row.organizationName}</MobileField>
                      <MobileField label="Signed up">{formatDate(row.createdAt)}</MobileField>
                      <MobileField label="Last sign-in">{formatDateTime(row.lastSignInAt)}</MobileField>
                    </div>
                  </div>
                ))}
                {signupRows.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground md:col-span-2">
                    No signups found.
                  </div>
                )}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-rc-card">
                      <TableHead>User</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Signed Up</TableHead>
                      <TableHead>Last Sign-In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signupRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.name}</div>
                          <div className="mt-1 max-w-[260px] truncate text-xs text-muted-foreground">{row.email}</div>
                        </TableCell>
                        <TableCell>{row.organizationName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={roleBadgeClass(row.role)}>
                            {formatLabel(row.role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(row.createdAt)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(row.lastSignInAt)}</TableCell>
                      </TableRow>
                    ))}
                    {signupRows.length === 0 && <EmptyRow colSpan={5} message="No signups found." />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className={styles.dataPanel}>
            <CardHeader className={styles.panelHead}>
              <div className={styles.panelTitleGroup}>
                <p className={styles.eyebrow}>ORGANIZATION HEALTH</p>
                <h2>Client portfolio</h2>
                <p>Organizations, user counts, project counts, and latest sign-in.</p>
              </div>
              <Building2 size={19} />
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid gap-3 p-3 sm:p-4 md:grid-cols-2 lg:hidden">
                {clientRows.map((row) => (
                  <div key={row.org.id} className={`${styles.mobileDataCard} p-3.5 sm:p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{row.org.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatLabel(row.org.type)}</p>
                      </div>
                      <Badge variant="secondary" className="capitalize">
                        {row.org.tier ?? 'free'}
                      </Badge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-3">
                      <MobileField label="Projects">{row.projectCount}</MobileField>
                      <MobileField label="Users">
                        {row.userCount}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({row.adminCount} admins)
                        </span>
                      </MobileField>
                      <MobileField label="Value">{formatMoney(row.budgetTotal)}</MobileField>
                      <MobileField label="Last sign-in">{formatDateTime(row.latestSignIn)}</MobileField>
                    </div>
                  </div>
                ))}
                {clientRows.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground md:col-span-2">
                    No client organizations found.
                  </div>
                )}
              </div>
              <div className="hidden overflow-x-auto lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-rc-card">
                      <TableHead>Organization</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Projects</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Last Sign-In</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientRows.map((row) => (
                      <TableRow key={row.org.id}>
                        <TableCell>
                          <div className="font-medium">{row.org.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{formatLabel(row.org.type)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">
                            {row.org.tier ?? 'free'}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.projectCount}</TableCell>
                        <TableCell>
                          {row.userCount}
                          <span className="ml-1 text-xs text-muted-foreground">({row.adminCount} admins)</span>
                        </TableCell>
                        <TableCell>{formatMoney(row.budgetTotal)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(row.latestSignIn)}</TableCell>
                      </TableRow>
                    ))}
                    {clientRows.length === 0 && <EmptyRow colSpan={6} message="No client organizations found." />}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
        </div>
      </div>
    </main>
  );
}
