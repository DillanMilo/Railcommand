import type { MobileBootstrap, MobileDailyLog, MobileProject } from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

type MembershipRow = {
  project_id: string;
  project_role: MobileProject['role'];
  can_edit: boolean;
  project: {
    id: string;
    name: string;
    status: MobileProject['status'];
    location: string | null;
    client: string | null;
    created_at: string;
  } | null;
};

export async function GET(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);

  const requestedProjectId = new URL(request.url).searchParams.get('projectId');
  const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] =
    await Promise.all([
      context.supabase.from('profiles').select('role').eq('id', context.user.id).single(),
      context.supabase
        .from('project_members')
        .select('project_id, project_role, can_edit, project:projects(id, name, status, location, client, created_at)')
        .eq('profile_id', context.user.id),
    ]);

  if (profileError || membershipError) {
    return mobileJson({ error: 'Could not verify project access' }, 403);
  }

  let rows = (memberships ?? []) as unknown as MembershipRow[];
  if (profile?.role === 'admin') {
    const { data: projects, error } = await context.supabase
      .from('projects')
      .select('id, name, status, location, client, created_at')
      .order('name');
    if (error) return mobileJson({ error: 'Could not list projects' }, 500);
    const byProject = new Map(rows.map((row) => [row.project_id, row]));
    rows = (projects ?? []).map((project) => byProject.get(project.id) ?? {
      project_id: project.id,
      project_role: 'admin',
      can_edit: true,
      project,
    }) as MembershipRow[];
  }

  const projects = rows
    .filter((row) => row.project)
    .map((row): MobileProject => ({
      id: row.project!.id,
      name: row.project!.name,
      status: row.project!.status,
      location: row.project!.location ?? '',
      client: row.project!.client ?? '',
      role: profile?.role === 'admin' ? 'admin' : row.project_role,
      canEdit: profile?.role === 'admin' || row.can_edit,
      updatedAt: row.project!.created_at,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeProjectId = requestedProjectId ?? projects[0]?.id ?? null;
  if (activeProjectId && !projects.some((project) => project.id === activeProjectId)) {
    return mobileJson({ error: 'Project membership required' }, 403);
  }

  let dailyLogs: MobileDailyLog[] = [];
  if (activeProjectId) {
    const { data, error } = await context.supabase
      .from('daily_logs')
      .select('id, project_id, log_date, weather_conditions, work_summary, safety_notes, created_at')
      .eq('project_id', activeProjectId)
      .order('log_date', { ascending: false })
      .limit(90);
    if (error) return mobileJson({ error: 'Could not load daily logs' }, 500);
    dailyLogs = (data ?? []).map((log) => ({
      id: log.id,
      projectId: log.project_id,
      logDate: log.log_date,
      weatherConditions: log.weather_conditions ?? '',
      workSummary: log.work_summary ?? '',
      safetyNotes: log.safety_notes ?? '',
      createdAt: log.created_at,
    }));
  }

  const response: MobileBootstrap = {
    userId: context.user.id,
    projects,
    activeProjectId,
    dailyLogs,
    synchronizedAt: new Date().toISOString(),
  };
  return mobileJson(response);
}
