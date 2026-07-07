import { createHmac, timingSafeEqual } from 'crypto';
import type { ComponentType, ReactNode } from 'react';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Activity,
  Building2,
  Clock3,
  FlaskConical,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

function roleBadgeClass(role: string | null | undefined): string {
  if (role === 'admin' || role === 'owner' || role === 'manager') {
    return 'border-rc-orange/30 bg-rc-orange/10 text-rc-orange';
  }
  if (role === 'superintendent' || role === 'foreman' || role === 'engineer') {
    return 'border-rc-emerald/30 bg-rc-emerald/10 text-rc-emerald';
  }
  return 'border-muted-foreground/20 bg-muted text-muted-foreground';
}

function emailStatusClass(status: EmailEventRow['status']): string {
  if (status === 'sent') return 'border-rc-emerald/30 bg-rc-emerald/10 text-rc-emerald';
  if (status === 'failed') return 'border-destructive/30 bg-destructive/10 text-destructive';
  return 'border-muted-foreground/20 bg-muted text-muted-foreground';
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
    <Card className="border-border/80 shadow-sm">
      <CardContent className="flex min-h-[132px] items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted-foreground">{title}</p>
          <p className="mt-2 font-heading text-3xl font-bold text-foreground">{value}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p>
        </div>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-rc-orange/10 text-rc-orange">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm text-foreground">{children}</div>
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
    <main className="flex min-h-screen items-center justify-center bg-rc-bg px-4 py-10">
      <Card className="w-full max-w-md border-border/80 shadow-xl">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-rc-orange/10 text-rc-orange">
            <Lock className="size-5" />
          </div>
          <CardTitle>Client dashboard locked</CardTitle>
          <CardDescription>
            Enter the internal dashboard password to view RailCommand operations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!passwordConfigured ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              ADMIN_DASHBOARD_PASSWORD is not configured.
            </div>
          ) : (
            <form action={unlockClientDashboard} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="client-dashboard-password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="client-dashboard-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter dashboard password"
                  required
                />
              </div>
              {error === 'invalid' && (
                <p className="text-sm text-destructive">Incorrect dashboard password.</p>
              )}
              {error === 'rate' && (
                <p className="text-sm text-destructive">Too many attempts. Try again later.</p>
              )}
              {error === 'config' && (
                <p className="text-sm text-destructive">Dashboard password is not configured.</p>
              )}
              <Button type="submit" className="w-full bg-rc-orange text-white hover:bg-rc-orange-dark">
                Unlock dashboard
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function DashboardError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-rc-bg px-4 py-10">
      <Card className="w-full max-w-lg border-border/80 shadow-xl">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle>Dashboard data unavailable</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={lockClientDashboard}>
            <Button variant="outline" type="submit">
              Lock dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default async function ClientDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  if (!(await isUnlocked())) {
    return <PasswordGate error={params?.error} />;
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
    ...data.organizations.filter((org) => org.is_demo).map((org) => org.id),
  ]);
  const demoProjectIds = new Set(data.demoAccounts.map((demo) => demo.project_id).filter(Boolean));

  const realOrganizations = data.organizations.filter((org) => !demoOrgIds.has(org.id));
  const realProjects = data.projects.filter((project) => !demoProjectIds.has(project.id));
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

  const projectsByOrg = new Map<string, ProjectRow[]>();
  for (const project of data.projects) {
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
    <main className="min-h-screen bg-rc-bg px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-border/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex size-10 items-center justify-center rounded-lg bg-rc-orange text-sm font-bold text-white">
                RC
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-rc-orange">
                  RailCommand
                </p>
                <h1 className="font-heading text-2xl font-bold text-foreground sm:text-3xl">
                  Client Dashboard
                </h1>
              </div>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Operational view for signups, email delivery, client accounts, and product activity.
            </p>
          </div>
          <form action={lockClientDashboard}>
            <Button variant="outline" type="submit" className="gap-2">
              <LogOut className="size-4" />
              Lock
            </Button>
          </form>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="rounded-lg border border-amber-300/50 bg-amber-50 p-4 text-sm text-amber-900">
            Email send logging is not available yet: {data.emailMetrics.reason ?? 'email_events is unavailable'}.
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Latest Activity</CardTitle>
              <CardDescription>Most recent project events across RailCommand.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-3 p-4 md:hidden">
                {activityRows.map((entry) => (
                  <div key={entry.id} className="rounded-lg border bg-background p-4">
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
              <div className="hidden overflow-x-auto md:block">
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

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Email Activity</CardTitle>
              <CardDescription>Recent application email attempts logged by RailCommand.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
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

        <section className="grid gap-6 xl:grid-cols-2">
          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Who Signed Up</CardTitle>
              <CardDescription>Latest non-demo Supabase auth users.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
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

          <Card className="border-border/80 shadow-sm">
            <CardHeader>
              <CardTitle>Clients</CardTitle>
              <CardDescription>Organizations, user counts, project counts, and latest sign-in.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
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
    </main>
  );
}
