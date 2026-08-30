import type {
  MobileBootstrap,
  MobileDailyLog,
  MobileEarthCamEmbed,
  MobileProject,
  MobileRfi,
  MobileSubmittal,
  MobileTeamMember,
  ProjectRole,
} from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import { ACTIONS, canPerform, canPerformWithProjectEdit } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

type MembershipRow = {
  project_id: string;
  project_role: ProjectRole;
  can_edit: boolean;
  project: {
    id: string;
    name: string;
    status: MobileProject['status'];
    location: string | null;
    client: string | null;
    start_date: string | null;
    target_end_date: string | null;
    budget_total: number | null;
    budget_spent: number | null;
    created_at: string;
  } | null;
};

type TeamRow = {
  project_id: string;
  project_role: MobileTeamMember['role'];
  can_edit: boolean;
  profile: { id: string; full_name: string | null; email: string } | null;
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
        .select('project_id, project_role, can_edit, project:projects(id, name, status, location, client, start_date, target_end_date, budget_total, budget_spent, created_at)')
        .eq('profile_id', context.user.id),
    ]);

  if (profileError || membershipError) {
    return mobileJson({ error: 'Could not verify project access' }, 403);
  }

  let rows = (memberships ?? []) as unknown as MembershipRow[];
  if (profile?.role === 'admin') {
    const { data: projects, error } = await context.supabase
      .from('projects')
      .select('id, name, status, location, client, start_date, target_end_date, budget_total, budget_spent, created_at')
      .order('name');
    if (error) return mobileJson({ error: 'Could not list projects' }, 500);
    const byProject = new Map(rows.map((row) => [row.project_id, row]));
    rows = (projects ?? []).map((project) => byProject.get(project.id) ?? {
      project_id: project.id,
      project_role: 'manager',
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
      startDate: row.project!.start_date ?? undefined,
      targetEndDate: row.project!.target_end_date ?? undefined,
      budgetTotal: row.project!.budget_total ?? 0,
      budgetSpent: row.project!.budget_spent ?? 0,
      canViewEarthCam: profile?.role === 'admin'
        || canPerform(row.project_role, ACTIONS.EARTHCAM_VIEW),
      canManageEarthCam: profile?.role === 'admin'
        || canPerformWithProjectEdit(
          row.project_role,
          row.can_edit,
          ACTIONS.EARTHCAM_EMBED_MANAGE,
        ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const activeProjectId = requestedProjectId ?? projects[0]?.id ?? null;
  if (activeProjectId && !projects.some((project) => project.id === activeProjectId)) {
    return mobileJson({ error: 'Project membership required' }, 403);
  }

  let dailyLogs: MobileDailyLog[] = [];
  let team: MobileTeamMember[] = [];
  let submittals: MobileSubmittal[] = [];
  let rfis: MobileRfi[] = [];
  let earthCamEmbeds: MobileEarthCamEmbed[] = [];
  let dashboard: MobileBootstrap['dashboard'] = {
    submittalsTotal: 0,
    submittalsPending: 0,
    openRfis: 0,
    overdueRfis: 0,
    openPunchItems: 0,
    criticalPunchItems: 0,
  };
  if (activeProjectId) {
    const earthCamClient = profile?.role === 'admin' ? createAdminClient() : context.supabase;
    const [
      { data: logs, error: logsError },
      { data: members, error: membersError },
      { data: submittalRows, error: submittalsError },
      { data: rfiRows, error: rfisError },
      { data: punchRows, error: punchError },
      { data: embedRows, error: embedsError },
    ] = await Promise.all([
      context.supabase
        .from('daily_logs')
        .select('id, project_id, log_date, weather_conditions, work_summary, safety_notes, created_at')
        .eq('project_id', activeProjectId)
        .order('log_date', { ascending: false })
        .limit(90),
      context.supabase
        .from('project_members')
        .select('project_id, project_role, can_edit, profile:profiles(id, full_name, email)')
        .eq('project_id', activeProjectId),
      context.supabase
        .from('submittals')
        .select('id, project_id, number, title, status, due_date, created_at')
        .eq('project_id', activeProjectId)
        .order('created_at', { ascending: false })
        .limit(100),
      context.supabase
        .from('rfis')
        .select('id, project_id, number, subject, status, priority, due_date, created_at')
        .eq('project_id', activeProjectId)
        .order('created_at', { ascending: false })
        .limit(100),
      context.supabase
        .from('punch_list_items')
        .select('status, priority')
        .eq('project_id', activeProjectId),
      earthCamClient
        .from('earthcam_embeds')
        .select('id, project_id, label, url, created_at')
        .eq('project_id', activeProjectId)
        .order('label', { ascending: true }),
    ]);
    if (logsError || membersError || submittalsError || rfisError || punchError || embedsError) {
      return mobileJson({ error: 'Could not load project field data' }, 500);
    }
    dailyLogs = (logs ?? []).map((log) => ({
      id: log.id,
      projectId: log.project_id,
      logDate: log.log_date,
      weatherConditions: log.weather_conditions ?? '',
      workSummary: log.work_summary ?? '',
      safetyNotes: log.safety_notes ?? '',
      createdAt: log.created_at,
    }));
    team = ((members ?? []) as unknown as TeamRow[])
      .filter((member) => member.profile)
      .map((member) => ({
        id: member.profile!.id,
        projectId: member.project_id,
        fullName: member.profile!.full_name || member.profile!.email,
        email: member.profile!.email,
        role: member.project_role,
        canEdit: member.can_edit,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    submittals = (submittalRows ?? []).map((item) => ({
      id: item.id,
      projectId: item.project_id,
      number: item.number,
      title: item.title,
      status: item.status,
      dueDate: item.due_date,
      createdAt: item.created_at,
    }));
    rfis = (rfiRows ?? []).map((item) => ({
      id: item.id,
      projectId: item.project_id,
      number: item.number,
      subject: item.subject,
      status: item.status,
      priority: item.priority,
      dueDate: item.due_date,
      createdAt: item.created_at,
    }));
    earthCamEmbeds = (embedRows ?? []).flatMap((item) => {
      try {
        const url = new URL(item.url);
        if (url.protocol !== 'https:' || url.hostname !== 'share.earthcam.net') return [];
        return [{
          id: item.id,
          projectId: item.project_id,
          label: item.label,
          url: url.toString(),
          createdAt: item.created_at,
        }];
      } catch {
        return [];
      }
    });
    const openSubmittalStatuses = new Set(['submitted', 'under_review']);
    const openRfiStatuses = new Set(['open', 'overdue']);
    const openPunchStatuses = new Set(['open', 'in_progress']);
    dashboard = {
      submittalsTotal: submittals.length,
      submittalsPending: submittals.filter((item) => openSubmittalStatuses.has(item.status)).length,
      openRfis: rfis.filter((item) => openRfiStatuses.has(item.status)).length,
      overdueRfis: rfis.filter((item) => item.status === 'overdue').length,
      openPunchItems: (punchRows ?? []).filter((item) => openPunchStatuses.has(item.status)).length,
      criticalPunchItems: (punchRows ?? []).filter((item) => openPunchStatuses.has(item.status) && item.priority === 'critical').length,
    };
  }

  const response: MobileBootstrap = {
    userId: context.user.id,
    projects,
    activeProjectId,
    dailyLogs,
    team,
    submittals,
    rfis,
    earthCamEmbeds,
    dashboard,
    synchronizedAt: new Date().toISOString(),
  };
  return mobileJson(response);
}
