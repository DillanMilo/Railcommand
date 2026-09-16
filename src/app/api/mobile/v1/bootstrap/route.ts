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
import { normalizeDailyLogReadFields } from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import { mobileQueryFailed, mobileQueryFailureStatus, type MobileQueryResult } from '@/lib/mobile-api/query-failure';
import { ACTIONS, canPerform, canPerformWithProjectEdit } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { mobilePage, parseMobilePage } from '@/lib/mobile-api/pagination';

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

function bootstrapQueryFailure(
  results: MobileQueryResult[],
  message: string,
  profileResult?: MobileQueryResult,
): Response | null {
  const status = mobileQueryFailureStatus(results);
  if (!status) return null;
  // Preserve upstream authentication failures for the client's single refresh attempt.
  if (status === 401) return mobileJson({ error: 'Not authenticated' }, 401);
  return mobileJson({ error: message }, profileResult?.error?.code === 'PGRST116' ? 403 : status);
}

export async function GET(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);

  const requestUrl = new URL(request.url);
  const requestedProjectId = requestUrl.searchParams.get('projectId');
  const page = parseMobilePage(requestUrl);
  const [profileResult, membershipResult] =
    await Promise.all([
      context.supabase.from('profiles').select('role').eq('id', context.user.id).single(),
      context.supabase
        .from('project_members')
        .select('project_id, project_role, can_edit, project:projects(id, name, status, location, client, start_date, target_end_date, budget_total, budget_spent, created_at)')
        .eq('profile_id', context.user.id)
        .limit(200),
    ]);

  const accessFailure = bootstrapQueryFailure([profileResult, membershipResult], 'Could not verify project access', profileResult);
  if (accessFailure) return accessFailure;
  const { data: profile } = profileResult;
  const { data: memberships } = membershipResult;

  let rows = (memberships ?? []) as unknown as MembershipRow[];
  if (profile?.role === 'admin') {
    const projectsResult = await context.supabase
      .from('projects')
      .select('id, name, status, location, client, start_date, target_end_date, budget_total, budget_spent, created_at')
      .order('name')
      .limit(200);
    const projectsFailure = bootstrapQueryFailure([projectsResult], 'Could not list projects');
    if (projectsFailure) return projectsFailure;
    const { data: projects } = projectsResult;
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
      canCreateRfi: profile?.role === 'admin' || (row.can_edit && canPerform(row.project_role, ACTIONS.RFI_CREATE)),
      canCreateSubmittal: profile?.role === 'admin' || (row.can_edit && canPerform(row.project_role, ACTIONS.SUBMITTAL_CREATE)),
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
  let dailyLogsHasMore = false;
  let submittalsHasMore = false;
  let rfisHasMore = false;
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
    const [logsResult, membersResult, submittalsResult, rfisResult, punchResult, embedsResult] = await Promise.all([
      context.supabase
        .from('daily_logs')
        .select('id, project_id, log_date, weather_temp, weather_conditions, weather_wind, work_summary, safety_notes, geo_tag, created_at, personnel:daily_log_personnel(id, role, headcount, company), equipment:daily_log_equipment(id, equipment_type, count, notes), work_items:daily_log_work_items(id, description, quantity, unit, location)')
        .eq('project_id', activeProjectId)
        .order('log_date', { ascending: false })
        .range(page.offset, page.offset + page.limit),
      context.supabase
        .from('project_members')
        .select('project_id, project_role, can_edit, profile:profiles(id, full_name, email)')
        .eq('project_id', activeProjectId)
        .limit(200),
      context.supabase
        .from('submittals')
        .select('id, project_id, number, title, status, due_date, created_at')
        .eq('project_id', activeProjectId)
        .order('created_at', { ascending: false })
        .range(page.offset, page.offset + page.limit),
      context.supabase
        .from('rfis')
        .select('id, project_id, number, subject, status, priority, due_date, created_at')
        .eq('project_id', activeProjectId)
        .order('created_at', { ascending: false })
        .range(page.offset, page.offset + page.limit),
      context.supabase
        .from('punch_list_items')
        .select('status, priority')
        .eq('project_id', activeProjectId)
        .limit(500),
      earthCamClient
        .from('earthcam_embeds')
        .select('id, project_id, label, url, created_at')
        .eq('project_id', activeProjectId)
        .order('label', { ascending: true })
        .limit(100),
    ]);
    const userResults: MobileQueryResult[] = [logsResult, membersResult, submittalsResult, rfisResult, punchResult];
    if (profile?.role !== 'admin') userResults.push(embedsResult);
    const fieldFailure = bootstrapQueryFailure(userResults, 'Could not load project field data');
    if (fieldFailure) return fieldFailure;
    // Service-client failures cannot be repaired by refreshing the user's session.
    if (mobileQueryFailed(embedsResult)) {
      return mobileJson({ error: 'Could not load project field data' }, 500);
    }
    const { data: logs } = logsResult;
    const { data: members } = membersResult;
    const { data: submittalRows } = submittalsResult;
    const { data: rfiRows } = rfisResult;
    const { data: punchRows } = punchResult;
    const { data: embedRows } = embedsResult;
    const logPage = mobilePage(logs, page.limit);
    const submittalPage = mobilePage(submittalRows, page.limit);
    const rfiPage = mobilePage(rfiRows, page.limit);
    dailyLogsHasMore = logPage.hasMore;
    submittalsHasMore = submittalPage.hasMore;
    rfisHasMore = rfiPage.hasMore;
    dailyLogs = logPage.items.map((log) => ({
      id: log.id,
      projectId: log.project_id,
      logDate: log.log_date,
      weatherConditions: log.weather_conditions ?? '',
      workSummary: log.work_summary ?? '',
      safetyNotes: log.safety_notes ?? '',
      createdAt: log.created_at,
      ...normalizeDailyLogReadFields({
        weatherTemp: log.weather_temp,
        weatherWind: log.weather_wind,
        geoTag: log.geo_tag,
        personnel: log.personnel,
        equipment: log.equipment?.map((row) => ({ id: row.id, equipmentType: row.equipment_type, count: row.count, notes: row.notes })),
        workItems: log.work_items,
      }),
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
    submittals = submittalPage.items.map((item) => ({
      id: item.id,
      projectId: item.project_id,
      number: item.number,
      title: item.title,
      status: item.status,
      dueDate: item.due_date,
      createdAt: item.created_at,
    }));
    rfis = rfiPage.items.map((item) => ({
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
    pagination: {
      offset: page.offset,
      limit: page.limit,
      dailyLogsHasMore,
      submittalsHasMore,
      rfisHasMore,
    },
    synchronizedAt: new Date().toISOString(),
  };
  return mobileJson(response);
}
