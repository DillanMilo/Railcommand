import { createHmac, timingSafeEqual } from 'crypto';
import type { ComponentType, ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  Activity,
  Building2,
  FlaskConical,
  FolderKanban,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
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
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const DASHBOARD_COOKIE = 'rc-admin-clients-unlocked';
const GATE_PURPOSE = 'admin-clients-dashboard';

type AdminProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  type: string | null;
  tier: string | null;
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

type DashboardData = {
  authUsers: AuthUserSummary[];
  organizations: OrganizationRow[];
  projects: ProjectRow[];
  profiles: ProfileRow[];
  projectMembers: ProjectMemberRow[];
  invitations: InvitationRow[];
  demoAccounts: DemoAccountRow[];
  demoLogins: DemoLoginRow[];
};

function getDashboardPassword(): string | null {
  const password = process.env.ADMIN_DASHBOARD_PASSWORD?.trim();
  return password && password.length >= 8 ? password : null;
}

function signGate(userId: string): string | null {
  const password = getDashboardPassword();
  if (!password) return null;
  return createHmac('sha256', password)
    .update(`${GATE_PURPOSE}:${userId}`)
    .digest('hex');
}

async function isUnlocked(userId: string): Promise<boolean> {
  const signature = signGate(userId);
  if (!signature) return false;

  const stored = (await cookies()).get(DASHBOARD_COOKIE)?.value;
  if (!stored || stored.length !== signature.length) return false;

  try {
    return timingSafeEqual(Buffer.from(stored), Buffer.from(signature));
  } catch {
    return false;
  }
}

async function getAdminProfile(): Promise<AdminProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.role !== 'admin') {
    return null;
  }

  return profile as AdminProfile;
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
  ] = await Promise.all([
    getAuthUsers(),
    admin.from('organizations').select('id, name, type, tier, created_at').order('created_at', { ascending: false }),
    admin.from('projects').select('id, name, client, organization_id, budget_total, status, created_at').order('created_at', { ascending: false }),
    admin.from('profiles').select('id, email, full_name, role, organization_id, created_at').order('created_at', { ascending: false }),
    admin.from('project_members').select('id, profile_id, project_id, project_role, can_edit, added_at').order('added_at', { ascending: false }),
    admin.from('project_invitations').select('id, email, project_id, project_role, status, expires_at, created_at').order('created_at', { ascending: false }),
    admin.from('demo_accounts').select('id, slug, company_name, organization_id, project_id, is_active, is_team_demo, access_count, last_accessed_at, created_at').order('created_at', { ascending: false }),
    admin.from('demo_team_logins').select('profile_id, display_name, project_role').order('created_at', { ascending: false }),
  ]);

  const errors = [
    organizations.error,
    projects.error,
    profiles.error,
    projectMembers.error,
    invitations.error,
    demoAccounts.error,
    demoLogins.error,
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
  };
}

export async function unlockAdminDashboard(formData: FormData) {
  'use server';

  const entered = String(formData.get('password') ?? '');
  const password = getDashboardPassword();
  if (!password || entered !== password) {
    redirect('/admin/clients?error=invalid');
  }

  const profile = await getAdminProfile();
  if (!profile) redirect('/dashboard');

  const signature = signGate(profile.id);
  if (!signature) redirect('/admin/clients?error=config');

  (await cookies()).set(DASHBOARD_COOKIE, signature, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin/clients',
    maxAge: 60 * 60 * 8,
  });

  redirect('/admin/clients');
}

export async function lockAdminDashboard() {
  'use server';

  (await cookies()).delete(DASHBOARD_COOKIE);
  redirect('/admin/clients');
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
  if (!value) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRole(role: string | null | undefined): string {
  if (!role) return '—';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isWithinDays(value: string | null | undefined, days: number): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Date.now() - timestamp <= days * 24 * 60 * 60 * 1000;
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
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-1 font-heading text-2xl font-bold text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex size-11 items-center justify-center rounded-lg bg-rc-orange/10 text-rc-orange">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 break-words text-sm text-foreground">{children}</div>
    </div>
  );
}

function MobileEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function PasswordGate({ error }: { error?: string }) {
  const passwordConfigured = Boolean(getDashboardPassword());

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-rc-orange/10 text-rc-orange">
            <Lock className="size-5" />
          </div>
          <CardTitle>Admin dashboard locked</CardTitle>
          <CardDescription>
            Enter the internal dashboard password to view client and usage metrics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!passwordConfigured ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              ADMIN_DASHBOARD_PASSWORD is not configured.
            </div>
          ) : (
            <form action={unlockAdminDashboard} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="admin-password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="admin-password"
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
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle>Admin access required</CardTitle>
          <CardDescription>
            This dashboard is restricted to RailCommand admin accounts.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const profile = await getAdminProfile();
  if (!profile) return <AccessDenied />;

  if (!(await isUnlocked(profile.id))) {
    return <PasswordGate error={params?.error} />;
  }

  const data = await getDashboardData();

  const orgById = new Map(data.organizations.map((org) => [org.id, org]));
  const projectById = new Map(data.projects.map((project) => [project.id, project]));
  const authById = new Map(data.authUsers.map((user) => [user.id, user]));
  const demoProfileIds = new Set(data.demoLogins.map((login) => login.profile_id).filter(Boolean));
  const demoOrgIds = new Set(data.demoAccounts.map((demo) => demo.organization_id).filter(Boolean));
  const demoProjectIds = new Set(data.demoAccounts.map((demo) => demo.project_id).filter(Boolean));

  const realOrganizations = data.organizations.filter((org) => !demoOrgIds.has(org.id));
  const realProjects = data.projects.filter((project) => !project.id || !demoProjectIds.has(project.id));
  const realProfiles = data.profiles.filter((user) => !demoProfileIds.has(user.id));
  const pendingInvites = data.invitations.filter((invite) => invite.status === 'pending');
  const recentlyActiveUsers = realProfiles.filter((user) =>
    isWithinDays(authById.get(user.id)?.last_sign_in_at, 30),
  );

  const projectsByOrg = new Map<string, ProjectRow[]>();
  for (const project of data.projects) {
    if (!project.organization_id) continue;
    projectsByOrg.set(project.organization_id, [
      ...(projectsByOrg.get(project.organization_id) ?? []),
      project,
    ]);
  }

  const profilesByOrg = new Map<string, ProfileRow[]>();
  for (const user of data.profiles) {
    if (!user.organization_id) continue;
    profilesByOrg.set(user.organization_id, [
      ...(profilesByOrg.get(user.organization_id) ?? []),
      user,
    ]);
  }

  const membershipsByProfile = new Map<string, ProjectMemberRow[]>();
  for (const membership of data.projectMembers) {
    membershipsByProfile.set(membership.profile_id, [
      ...(membershipsByProfile.get(membership.profile_id) ?? []),
      membership,
    ]);
  }

  const clientRows = data.organizations.slice(0, 12).map((org) => {
    const orgProjects = projectsByOrg.get(org.id) ?? [];
    const orgProfiles = profilesByOrg.get(org.id) ?? [];
    const latestSignIn = orgProfiles
      .map((user) => authById.get(user.id)?.last_sign_in_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];

    return {
      org,
      isDemo: demoOrgIds.has(org.id),
      projectCount: orgProjects.length,
      userCount: orgProfiles.length,
      adminCount: orgProfiles.filter((user) => user.role === 'admin' || user.role === 'manager').length,
      budgetTotal: orgProjects.reduce((sum, project) => sum + (project.budget_total ?? 0), 0),
      latestSignIn,
    };
  });

  const userRows = data.profiles.slice(0, 25).map((user) => {
    const organization = user.organization_id ? orgById.get(user.organization_id) : null;
    const authUser = authById.get(user.id);
    const memberships = membershipsByProfile.get(user.id) ?? [];
    const roles = memberships.map((membership) => ({
      role: membership.project_role,
      project: projectById.get(membership.project_id)?.name ?? 'Unknown project',
    }));

    return {
      user,
      organization,
      authUser,
      roles,
      isDemo: demoProfileIds.has(user.id),
    };
  });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Admin' }, { label: 'Clients' }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="size-6 text-rc-orange" />
            <h1 className="font-heading text-2xl font-bold">Client Dashboard</h1>
            <Badge variant="secondary" className="text-xs">
              Internal
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Track organizations, users, project roles, invitations, and demo activity.
          </p>
        </div>
        <form action={lockAdminDashboard}>
          <Button variant="outline" type="submit">
            Lock dashboard
          </Button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Client orgs"
          value={realOrganizations.length}
          description={`${data.organizations.length - realOrganizations.length} demo orgs excluded`}
          icon={Building2}
        />
        <StatCard
          title="Projects"
          value={realProjects.length}
          description={`${data.projects.length - realProjects.length} demo projects excluded`}
          icon={FolderKanban}
        />
        <StatCard
          title="Users"
          value={realProfiles.length}
          description={`${recentlyActiveUsers.length} active in the last 30 days`}
          icon={Users}
        />
        <StatCard
          title="Pending invites"
          value={pendingInvites.length}
          description="Open project invitations"
          icon={Mail}
        />
        <StatCard
          title="Active demos"
          value={data.demoAccounts.filter((demo) => demo.is_active).length}
          description={`${data.demoAccounts.reduce((sum, demo) => sum + (demo.access_count ?? 0), 0)} total demo opens`}
          icon={FlaskConical}
        />
        <StatCard
          title="Last 30 days"
          value={recentlyActiveUsers.length}
          description="Signed-in non-demo users"
          icon={Activity}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients</CardTitle>
          <CardDescription>Organizations, member counts, project counts, and last sign-in activity.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {clientRows.map((row) => (
              <div key={row.org.id} className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words font-medium">{row.org.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatRole(row.org.type)}</span>
                      {row.isDemo && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
                    </div>
                  </div>
                  <Badge variant="secondary" className="capitalize">
                    {row.org.tier ?? 'free'}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MobileField label="Projects">{row.projectCount}</MobileField>
                  <MobileField label="Users">{row.userCount}</MobileField>
                  <MobileField label="Admins">{row.adminCount}</MobileField>
                  <MobileField label="Project Value">{formatMoney(row.budgetTotal)}</MobileField>
                </div>
                <div className="mt-3 border-t pt-3">
                  <MobileField label="Last Sign-In">{formatDateTime(row.latestSignIn)}</MobileField>
                </div>
              </div>
            ))}
            {clientRows.length === 0 && <MobileEmptyState message="No organizations found." />}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-rc-card">
                  <TableHead>Organization</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Admins</TableHead>
                  <TableHead>Project Value</TableHead>
                  <TableHead>Last Sign-In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientRows.map((row) => (
                  <TableRow key={row.org.id}>
                    <TableCell>
                      <div className="font-medium">{row.org.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatRole(row.org.type)}</span>
                        {row.isDemo && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {row.org.tier ?? 'free'}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.projectCount}</TableCell>
                    <TableCell>{row.userCount}</TableCell>
                    <TableCell>{row.adminCount}</TableCell>
                    <TableCell>{formatMoney(row.budgetTotal)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(row.latestSignIn)}</TableCell>
                  </TableRow>
                ))}
                {clientRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No organizations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users and Roles</CardTitle>
          <CardDescription>Latest 25 profile records with organization role, project role, and usage status.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {userRows.map((row) => (
              <div key={row.user.id} className="rounded-lg border bg-background p-4">
                <div className="min-w-0">
                  <h3 className="break-words font-medium">{row.user.full_name ?? 'Unnamed user'}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="break-all">{row.user.email}</span>
                    {row.isDemo && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <MobileField label="Organization">
                    {row.organization?.name ?? 'Project-only / unassigned'}
                  </MobileField>
                  <MobileField label="Org Role">
                    <Badge variant="outline" className={roleBadgeClass(row.user.role)}>
                      {formatRole(row.user.role)}
                    </Badge>
                  </MobileField>
                  <MobileField label="Project Roles">
                    <div className="flex flex-wrap gap-1.5">
                      {row.roles.slice(0, 3).map((role) => (
                        <Badge
                          key={`${row.user.id}-mobile-${role.project}-${role.role}`}
                          variant="outline"
                          className={roleBadgeClass(role.role)}
                          title={role.project}
                        >
                          {formatRole(role.role)}
                        </Badge>
                      ))}
                      {row.roles.length > 3 && (
                        <Badge variant="secondary">+{row.roles.length - 3}</Badge>
                      )}
                      {row.roles.length === 0 && (
                        <span className="text-sm text-muted-foreground">No project role</span>
                      )}
                    </div>
                  </MobileField>
                  <div className="grid grid-cols-2 gap-3 border-t pt-3">
                    <MobileField label="Last Sign-In">
                      {formatDateTime(row.authUser?.last_sign_in_at)}
                    </MobileField>
                    <MobileField label="Created">{formatDate(row.user.created_at)}</MobileField>
                  </div>
                </div>
              </div>
            ))}
            {userRows.length === 0 && <MobileEmptyState message="No users found." />}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-rc-card">
                  <TableHead>User</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Org Role</TableHead>
                  <TableHead>Project Roles</TableHead>
                  <TableHead>Last Sign-In</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userRows.map((row) => (
                  <TableRow key={row.user.id}>
                    <TableCell>
                      <div className="font-medium">{row.user.full_name ?? 'Unnamed user'}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{row.user.email}</span>
                        {row.isDemo && <Badge variant="outline" className="text-[10px]">Demo</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{row.organization?.name ?? 'Project-only / unassigned'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={roleBadgeClass(row.user.role)}>
                        {formatRole(row.user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {row.roles.slice(0, 3).map((role) => (
                          <Badge
                            key={`${row.user.id}-${role.project}-${role.role}`}
                            variant="outline"
                            className={roleBadgeClass(role.role)}
                            title={role.project}
                          >
                            {formatRole(role.role)}
                          </Badge>
                        ))}
                        {row.roles.length > 3 && (
                          <Badge variant="secondary">+{row.roles.length - 3}</Badge>
                        )}
                        {row.roles.length === 0 && (
                          <span className="text-sm text-muted-foreground">No project role</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(row.authUser?.last_sign_in_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(row.user.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {userRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Demo Activity</CardTitle>
          <CardDescription>Prospect demo environments and engagement.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-3 p-4 md:hidden">
            {data.demoAccounts.map((demo) => (
              <div key={demo.id} className="rounded-lg border bg-background p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="break-words font-medium">{demo.company_name}</h3>
                    <code className="mt-1 block break-all text-xs text-muted-foreground">
                      /demo/{demo.slug}
                    </code>
                  </div>
                  <Badge variant="secondary" className={demo.is_active ? 'bg-rc-emerald/10 text-rc-emerald' : 'bg-muted text-muted-foreground'}>
                    {demo.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MobileField label="Type">
                    {demo.is_team_demo ? 'Team demo' : 'Prospect demo'}
                  </MobileField>
                  <MobileField label="Access Count">{demo.access_count ?? 0}</MobileField>
                  <MobileField label="Last Accessed">
                    {formatDateTime(demo.last_accessed_at)}
                  </MobileField>
                  <MobileField label="Created">{formatDate(demo.created_at)}</MobileField>
                </div>
              </div>
            ))}
            {data.demoAccounts.length === 0 && <MobileEmptyState message="No demo accounts found." />}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-rc-card">
                  <TableHead>Demo</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Access Count</TableHead>
                  <TableHead>Last Accessed</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.demoAccounts.map((demo) => (
                  <TableRow key={demo.id}>
                    <TableCell>
                      <div className="font-medium">{demo.company_name}</div>
                      <code className="text-xs text-muted-foreground">/demo/{demo.slug}</code>
                    </TableCell>
                    <TableCell>{demo.is_team_demo ? 'Team demo' : 'Prospect demo'}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={demo.is_active ? 'bg-rc-emerald/10 text-rc-emerald' : 'bg-muted text-muted-foreground'}>
                        {demo.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>{demo.access_count ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(demo.last_accessed_at)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(demo.created_at)}</TableCell>
                  </TableRow>
                ))}
                {data.demoAccounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No demo accounts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
