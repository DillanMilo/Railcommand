import { canPerform, ACTIONS, type Action } from '@/lib/permissions';
import type { ProjectMember } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PATCH_NOTES } from '@/lib/patch-notes';
import {
  seedSubmittals,
  seedRFIs,
  seedDailyLogs,
  seedPunchListItems,
  seedMilestones,
  seedProject,
  seedProjectMembers,
  seedProfiles,
  seedActivityLog,
} from '@/lib/seed-data';

// Map each tool to its required permission (null = read-only, no special perm)
const TOOL_PERMISSIONS: Record<string, Action | null> = {
  search_submittals: null,
  search_rfis: null,
  search_punch_list: null,
  search_daily_logs: null,
  get_project_summary: null,
  get_overdue_items: null,
  get_budget_summary: ACTIONS.BUDGET_VIEW,
  get_team_members: null,
  get_milestones: null,
  get_recent_activity: null,
  get_daily_log_rollup: null,
  get_notifications_summary: null,
  create_rfi: ACTIONS.RFI_CREATE,
  create_punch_list_item: ACTIONS.PUNCH_LIST_CREATE,
  create_daily_log: ACTIONS.DAILY_LOG_CREATE,
};

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  projectRole: ProjectMember['project_role'],
  projectId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // ── Permission check ────────────────────────────────────────────────
  const requiredPerm = TOOL_PERMISSIONS[toolName];
  if (requiredPerm !== undefined && requiredPerm !== null) {
    if (!canPerform(projectRole, requiredPerm)) {
      return {
        success: false,
        error: `Permission denied: your project role (${projectRole}) cannot perform ${requiredPerm}.`,
      };
    }
  }

  if (!(toolName in TOOL_PERMISSIONS)) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  // ── Dispatch ────────────────────────────────────────────────────────
  try {
    switch (toolName) {
      case 'search_submittals':
        return await searchSubmittals(supabase, projectId, args);
      case 'search_rfis':
        return await searchRFIs(supabase, projectId, args);
      case 'search_punch_list':
        return await searchPunchList(supabase, projectId, args);
      case 'search_daily_logs':
        return await searchDailyLogs(supabase, projectId, args);
      case 'get_project_summary':
        return await getProjectSummary(supabase, projectId, projectRole);
      case 'get_overdue_items':
        return await getOverdueItems(supabase, projectId);
      case 'get_budget_summary':
        return await getBudgetSummary(supabase, projectId);
      case 'get_team_members':
        return await getTeamMembers(supabase, projectId, args);
      case 'get_milestones':
        return await getMilestones(supabase, projectId, args, projectRole);
      case 'get_recent_activity':
        return await getRecentActivity(supabase, projectId, args);
      case 'get_daily_log_rollup':
        return await getDailyLogRollup(supabase, projectId, args);
      case 'get_notifications_summary':
        return await getNotificationsSummary(supabase, projectId, args);
      case 'create_rfi':
        return await createRFI(supabase, projectId, userId, args);
      case 'create_punch_list_item':
        return await createPunchListItem(supabase, projectId, userId, args);
      case 'create_daily_log':
        return await createDailyLog(supabase, projectId, userId, args);
      default:
        return { success: false, error: `Unhandled tool: ${toolName}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ── Read Tool Handlers ──────────────────────────────────────────────────

async function searchSubmittals(
  supabase: SupabaseClient,
  projectId: string,
  args: Record<string, unknown>,
) {
  let query = supabase
    .from('submittals')
    .select('id, number, title, status, spec_section, due_date, submit_date')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (args.status) query = query.eq('status', args.status as string);
  if (args.search) query = query.or(`title.ilike.%${args.search}%,spec_section.ilike.%${args.search}%`);
  if (args.due_before) query = query.lte('due_date', args.due_before as string);
  if (args.due_after) query = query.gte('due_date', args.due_after as string);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function searchRFIs(
  supabase: SupabaseClient,
  projectId: string,
  args: Record<string, unknown>,
) {
  let query = supabase
    .from('rfis')
    .select('id, number, subject, status, priority, due_date, submit_date')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (args.status) query = query.eq('status', args.status as string);
  if (args.priority) query = query.eq('priority', args.priority as string);
  if (args.search) query = query.ilike('subject', `%${args.search}%`);
  if (args.due_before) query = query.lte('due_date', args.due_before as string);
  if (args.due_after) query = query.gte('due_date', args.due_after as string);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function searchPunchList(
  supabase: SupabaseClient,
  projectId: string,
  args: Record<string, unknown>,
) {
  let query = supabase
    .from('punch_list_items')
    .select('id, number, title, status, priority, location, due_date, assigned_to')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (args.status) query = query.eq('status', args.status as string);
  if (args.priority) query = query.eq('priority', args.priority as string);
  if (args.search) query = query.or(`title.ilike.%${args.search}%,location.ilike.%${args.search}%`);
  if (args.assigned_to) query = query.eq('assigned_to', args.assigned_to as string);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function searchDailyLogs(
  supabase: SupabaseClient,
  projectId: string,
  args: Record<string, unknown>,
) {
  let query = supabase
    .from('daily_logs')
    .select('id, log_date, weather_conditions, weather_temp, work_summary, created_by')
    .eq('project_id', projectId)
    .order('log_date', { ascending: false })
    .limit(20);

  if (args.date_from) query = query.gte('log_date', args.date_from as string);
  if (args.date_to) query = query.lte('log_date', args.date_to as string);
  if (args.search) query = query.ilike('work_summary', `%${args.search}%`);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getProjectSummary(supabase: SupabaseClient, projectId: string, projectRole: ProjectMember['project_role']) {
  const today = new Date().toISOString().split('T')[0];

  const hasBudgetView = canPerform(projectRole, ACTIONS.BUDGET_VIEW);

  const [submittals, rfis, punchList, milestones, overdueSubmittals, overdueRFIs, overduePunch] =
    await Promise.all([
      supabase.from('submittals').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('rfis').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('punch_list_items').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase.from('milestones').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
      supabase
        .from('submittals')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .lt('due_date', today)
        .not('status', 'in', '("approved","rejected")'),
      supabase
        .from('rfis')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .lt('due_date', today)
        .not('status', 'in', '("closed","answered")'),
      supabase
        .from('punch_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .lt('due_date', today)
        .not('status', 'in', '("resolved","verified")'),
    ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: Record<string, any> = {
    totalSubmittals: submittals.count ?? 0,
    totalRFIs: rfis.count ?? 0,
    totalPunchList: punchList.count ?? 0,
    totalMilestones: milestones.count ?? 0,
    overdueItems:
      (overdueSubmittals.count ?? 0) +
      (overdueRFIs.count ?? 0) +
      (overduePunch.count ?? 0),
  };

  // Only fetch and include budget data if the user is authorized
  if (hasBudgetView) {
    const projectResult = await supabase
      .from('projects')
      .select('budget_total, budget_spent')
      .eq('id', projectId)
      .single();

    if (projectResult.data) {
      summary.budgetTotal = projectResult.data.budget_total;
      summary.budgetSpent = projectResult.data.budget_spent;
      summary.budgetRemaining = projectResult.data.budget_total - projectResult.data.budget_spent;
    }
  }

  return { success: true, data: summary };
}

async function getOverdueItems(supabase: SupabaseClient, projectId: string) {
  const today = new Date().toISOString().split('T')[0];

  const [submittals, rfis, punchList] = await Promise.all([
    supabase
      .from('submittals')
      .select('id, number, title, status, due_date')
      .eq('project_id', projectId)
      .lt('due_date', today)
      .not('status', 'in', '("approved","rejected")')
      .order('due_date', { ascending: true })
      .limit(20),
    supabase
      .from('rfis')
      .select('id, number, subject, status, priority, due_date')
      .eq('project_id', projectId)
      .lt('due_date', today)
      .not('status', 'in', '("closed","answered")')
      .order('due_date', { ascending: true })
      .limit(20),
    supabase
      .from('punch_list_items')
      .select('id, number, title, status, priority, due_date, location')
      .eq('project_id', projectId)
      .lt('due_date', today)
      .not('status', 'in', '("resolved","verified")')
      .order('due_date', { ascending: true })
      .limit(20),
  ]);

  return {
    success: true,
    data: {
      overdueSubmittals: submittals.data ?? [],
      overdueRFIs: rfis.data ?? [],
      overduePunchList: punchList.data ?? [],
    },
  };
}

async function getBudgetSummary(supabase: SupabaseClient, projectId: string) {
  const [projectResult, milestonesResult] = await Promise.all([
    supabase
      .from('projects')
      .select('budget_total, budget_spent')
      .eq('id', projectId)
      .single(),
    supabase
      .from('milestones')
      .select('id, name, budget_planned, budget_actual, status, percent_complete')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true }),
  ]);

  if (projectResult.error) {
    return { success: false, error: projectResult.error.message };
  }

  return {
    success: true,
    data: {
      budgetTotal: projectResult.data.budget_total,
      budgetSpent: projectResult.data.budget_spent,
      budgetRemaining: projectResult.data.budget_total - projectResult.data.budget_spent,
      milestones: milestonesResult.data ?? [],
    },
  };
}

async function getTeamMembers(
  supabase: SupabaseClient,
  projectId: string,
  args: Record<string, unknown>,
) {
  let query = supabase
    .from('project_members')
    .select('project_role, can_edit, profiles(id, full_name, email, phone)')
    .eq('project_id', projectId);

  if (args.role) query = query.eq('project_role', args.role as string);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  let members = (data ?? []).map((m: Record<string, unknown>) => {
    const profile = m.profiles as Record<string, unknown> | null;
    return {
      id: profile?.id ?? '',
      name: profile?.full_name ?? 'Unknown',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      project_role: m.project_role,
      can_edit: m.can_edit,
    };
  });

  if (args.search) {
    const term = (args.search as string).toLowerCase();
    members = members.filter((m) => (m.name as string).toLowerCase().includes(term));
  }

  return { success: true, data: members };
}

async function getMilestones(
  supabase: SupabaseClient,
  projectId: string,
  args: Record<string, unknown>,
  projectRole: ProjectMember['project_role'],
) {
  const hasBudgetView = canPerform(projectRole, ACTIONS.BUDGET_VIEW);
  const selectFields = hasBudgetView
    ? 'id, name, status, percent_complete, target_date, budget_planned, budget_actual, sort_order'
    : 'id, name, status, percent_complete, target_date, sort_order';

  let query = supabase
    .from('milestones')
    .select(selectFields)
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (args.status) query = query.eq('status', args.status as string);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

async function getRecentActivity(
  supabase: SupabaseClient,
  projectId: string,
  args: Record<string, unknown>,
) {
  const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 20;

  let query = supabase
    .from('activity_log')
    .select('id, entity_type, action, description, created_at, profiles:performed_by(full_name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (args.entity_type) query = query.eq('entity_type', args.entity_type as string);

  const { data, error } = await query;
  if (error) return { success: false, error: error.message };

  const entries = (data ?? []).map((a: Record<string, unknown>) => {
    const profile = a.profiles as Record<string, unknown> | null;
    return {
      id: a.id,
      entity_type: a.entity_type,
      action: a.action,
      description: a.description,
      performed_by: profile?.full_name ?? 'Unknown',
      created_at: a.created_at,
    };
  });

  return { success: true, data: entries };
}

async function getNotificationsSummary(
  supabase: SupabaseClient,
  projectId: string,
  args: Record<string, unknown>,
) {
  const includePatchNotes = args.include_patch_notes !== false;
  const includeActivity = args.include_activity !== false;

  const result: Record<string, unknown> = {};

  if (includePatchNotes) {
    result.patch_notes = PATCH_NOTES.map((note) => ({
      version: note.version,
      title: note.title,
      description: note.description,
      date: note.date,
    }));
  }

  if (includeActivity) {
    const activityResult = await getRecentActivity(supabase, projectId, { limit: 10 });
    result.recent_activity = activityResult.success ? activityResult.data : [];
  }

  const latest = PATCH_NOTES[0];
  result.summary = `${PATCH_NOTES.length} product updates available. Latest: v${latest.version} — ${latest.title} (${latest.date}).`;

  return { success: true, data: result };
}

async function getDailyLogRollup(supabase: SupabaseClient, projectId: string, args: Record<string, unknown>) {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const dateFrom = (args.date_from as string) || sevenDaysAgo;
  const dateTo = (args.date_to as string) || today;

  const { data: logs, error } = await supabase
    .from('daily_logs')
    .select('id, log_date, work_summary, safety_notes, weather_temp, weather_conditions, created_by')
    .eq('project_id', projectId)
    .gte('log_date', dateFrom)
    .lte('log_date', dateTo)
    .order('log_date', { ascending: true });

  if (error) return { success: false, error: error.message };

  const logCount = (logs ?? []).length;
  const summaries = (logs ?? []).map(l => ({
    date: l.log_date,
    summary: l.work_summary,
    safety: l.safety_notes,
    weather: `${l.weather_temp}°F, ${l.weather_conditions}`,
  }));

  return {
    success: true,
    data: {
      period: `${dateFrom} to ${dateTo}`,
      totalLogs: logCount,
      logs: summaries,
    },
  };
}

// ── Write Tool Handlers ─────────────────────────────────────────────────

async function generateNextNumber(
  supabase: SupabaseClient,
  projectId: string,
  table: string,
  prefix: string,
): Promise<string> {
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId);

  const next = (count ?? 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

async function createRFI(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  args: Record<string, unknown>,
) {
  // Validate required fields
  if (!args.subject || typeof args.subject !== 'string' || args.subject.trim().length === 0) {
    return { success: false, error: 'Subject is required for creating an RFI.' };
  }
  if (!args.question || typeof args.question !== 'string' || args.question.trim().length === 0) {
    return { success: false, error: 'Question is required for creating an RFI.' };
  }

  const number = await generateNextNumber(supabase, projectId, 'rfis', 'RFI');
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('rfis')
    .insert({
      project_id: projectId,
      number,
      subject: args.subject as string,
      question: args.question as string,
      status: 'open',
      priority: (args.priority as string) ?? 'medium',
      submitted_by: userId,
      assigned_to: (args.assigned_to as string) ?? userId,
      submit_date: today,
      due_date: (args.due_date as string) ?? today,
    })
    .select('id, number, subject, status, priority, due_date')
    .single();

  if (error) return { success: false, error: error.message };

  // Log activity via RPC
  await supabase.rpc('log_activity', {
    p_project_id: projectId,
    p_entity_type: 'rfi',
    p_entity_id: data.id,
    p_action: 'created',
    p_description: `RFI ${data.number} created via RailBot: ${data.subject}`,
    p_performed_by: userId,
  });

  return { success: true, data };
}

async function createPunchListItem(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  args: Record<string, unknown>,
) {
  // Validate required fields
  if (!args.title || typeof args.title !== 'string' || args.title.trim().length === 0) {
    return { success: false, error: 'Title is required for creating a punch list item.' };
  }
  if (!args.description || typeof args.description !== 'string' || args.description.trim().length === 0) {
    return { success: false, error: 'Description is required for creating a punch list item.' };
  }
  if (!args.location || typeof args.location !== 'string' || args.location.trim().length === 0) {
    return { success: false, error: 'Location is required for creating a punch list item.' };
  }

  const number = await generateNextNumber(supabase, projectId, 'punch_list_items', 'PL');
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('punch_list_items')
    .insert({
      project_id: projectId,
      number,
      title: args.title as string,
      description: args.description as string,
      location: args.location as string,
      status: 'open',
      priority: (args.priority as string) ?? 'medium',
      assigned_to: (args.assigned_to as string) ?? userId,
      created_by: userId,
      due_date: (args.due_date as string) ?? today,
    })
    .select('id, number, title, status, priority, location, due_date')
    .single();

  if (error) return { success: false, error: error.message };

  await supabase.rpc('log_activity', {
    p_project_id: projectId,
    p_entity_type: 'punch_list',
    p_entity_id: data.id,
    p_action: 'created',
    p_description: `Punch list item ${data.number} created via RailBot: ${data.title}`,
    p_performed_by: userId,
  });

  return { success: true, data };
}

async function createDailyLog(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  args: Record<string, unknown>,
) {
  // Validate required fields
  if (!args.work_summary || typeof args.work_summary !== 'string' || args.work_summary.trim().length === 0) {
    return { success: false, error: 'Work summary is required for creating a daily log.' };
  }

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('daily_logs')
    .insert({
      project_id: projectId,
      log_date: (args.log_date as string) ?? today,
      created_by: userId,
      weather_temp: (args.weather_temp as number) ?? 0,
      weather_conditions: (args.weather_conditions as string) ?? '',
      weather_wind: (args.weather_wind as string) ?? '',
      work_summary: args.work_summary as string,
      safety_notes: (args.safety_notes as string) ?? '',
    })
    .select('id, log_date, work_summary, weather_conditions, weather_temp')
    .single();

  if (error) return { success: false, error: error.message };

  await supabase.rpc('log_activity', {
    p_project_id: projectId,
    p_entity_type: 'daily_log',
    p_entity_id: data.id,
    p_action: 'created',
    p_description: `Daily log for ${data.log_date} created via RailBot`,
    p_performed_by: userId,
  });

  return { success: true, data };
}

// ══════════════════════════════════════════════════════════════════════════
// Demo Mode Tool Executor — queries seed data instead of Supabase
// ══════════════════════════════════════════════════════════════════════════

export async function executeDemoTool(
  toolName: string,
  args: Record<string, unknown>,
  projectRole: ProjectMember['project_role'],
  projectId: string,
  userId: string,
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  // Permission check (same as real mode)
  const requiredPerm = TOOL_PERMISSIONS[toolName];
  if (requiredPerm !== undefined && requiredPerm !== null) {
    if (!canPerform(projectRole, requiredPerm)) {
      return {
        success: false,
        error: `Permission denied: your project role (${projectRole}) cannot perform ${requiredPerm}.`,
      };
    }
  }

  if (!(toolName in TOOL_PERMISSIONS)) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }

  try {
    switch (toolName) {
      case 'search_submittals':
        return demoSearchSubmittals(projectId, args);
      case 'search_rfis':
        return demoSearchRFIs(projectId, args);
      case 'search_punch_list':
        return demoSearchPunchList(projectId, args);
      case 'search_daily_logs':
        return demoSearchDailyLogs(projectId, args);
      case 'get_project_summary':
        return demoGetProjectSummary(projectId, projectRole);
      case 'get_overdue_items':
        return demoGetOverdueItems(projectId);
      case 'get_budget_summary':
        return demoGetBudgetSummary(projectId);
      case 'get_team_members':
        return demoGetTeamMembers(projectId, args);
      case 'get_milestones':
        return demoGetMilestones(projectId, args, projectRole);
      case 'get_recent_activity':
        return demoGetRecentActivity(projectId, args);
      case 'get_daily_log_rollup':
        return demoGetDailyLogRollup(projectId, args);
      case 'create_rfi':
        return demoCreateRFI(projectId, args);
      case 'create_punch_list_item':
        return demoCreatePunchListItem(projectId, args);
      case 'create_daily_log':
        return demoCreateDailyLog(args);
      default:
        return { success: false, error: `Unhandled tool: ${toolName}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// ── Demo Read Handlers ───────────────────────────────────────────────────

function demoSearchSubmittals(projectId: string, args: Record<string, unknown>) {
  let items = seedSubmittals.filter((s) => s.project_id === projectId);
  if (args.status) items = items.filter((s) => s.status === args.status);
  if (args.search) {
    const q = (args.search as string).toLowerCase();
    items = items.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.spec_section.toLowerCase().includes(q),
    );
  }
  if (args.due_before) items = items.filter((s) => s.due_date <= (args.due_before as string));
  if (args.due_after) items = items.filter((s) => s.due_date >= (args.due_after as string));
  const data = items.slice(0, 20).map((s) => ({
    id: s.id, number: s.number, title: s.title, status: s.status,
    spec_section: s.spec_section, due_date: s.due_date, submit_date: s.submit_date,
  }));
  return { success: true, data };
}

function demoSearchRFIs(projectId: string, args: Record<string, unknown>) {
  let items = seedRFIs.filter((r) => r.project_id === projectId);
  if (args.status) items = items.filter((r) => r.status === args.status);
  if (args.priority) items = items.filter((r) => r.priority === args.priority);
  if (args.search) {
    const q = (args.search as string).toLowerCase();
    items = items.filter((r) => r.subject.toLowerCase().includes(q));
  }
  if (args.due_before) items = items.filter((r) => r.due_date <= (args.due_before as string));
  if (args.due_after) items = items.filter((r) => r.due_date >= (args.due_after as string));
  const data = items.slice(0, 20).map((r) => ({
    id: r.id, number: r.number, subject: r.subject, status: r.status,
    priority: r.priority, due_date: r.due_date, submit_date: r.submit_date,
  }));
  return { success: true, data };
}

function demoSearchPunchList(projectId: string, args: Record<string, unknown>) {
  let items = seedPunchListItems.filter((p) => p.project_id === projectId);
  if (args.status) items = items.filter((p) => p.status === args.status);
  if (args.priority) items = items.filter((p) => p.priority === args.priority);
  if (args.search) {
    const q = (args.search as string).toLowerCase();
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q),
    );
  }
  if (args.assigned_to) items = items.filter((p) => p.assigned_to === args.assigned_to);
  const data = items.slice(0, 20).map((p) => ({
    id: p.id, number: p.number, title: p.title, status: p.status,
    priority: p.priority, location: p.location, due_date: p.due_date,
    assigned_to: p.assigned_to,
  }));
  return { success: true, data };
}

function demoSearchDailyLogs(projectId: string, args: Record<string, unknown>) {
  let items = seedDailyLogs.filter((d) => d.project_id === projectId);
  if (args.date_from) items = items.filter((d) => d.log_date >= (args.date_from as string));
  if (args.date_to) items = items.filter((d) => d.log_date <= (args.date_to as string));
  if (args.search) {
    const q = (args.search as string).toLowerCase();
    items = items.filter((d) => d.work_summary.toLowerCase().includes(q));
  }
  const data = items.slice(0, 20).map((d) => ({
    id: d.id, log_date: d.log_date, weather_conditions: d.weather_conditions,
    weather_temp: d.weather_temp, work_summary: d.work_summary,
    created_by: d.created_by,
  }));
  return { success: true, data };
}

function demoGetProjectSummary(projectId: string, projectRole: ProjectMember['project_role']) {
  const today = new Date().toISOString().split('T')[0];
  const subs = seedSubmittals.filter((s) => s.project_id === projectId);
  const rfiItems = seedRFIs.filter((r) => r.project_id === projectId);
  const punch = seedPunchListItems.filter((p) => p.project_id === projectId);
  const ms = seedMilestones.filter((m) => m.project_id === projectId);

  const overdueSubs = subs.filter((s) => s.due_date < today && !['approved', 'rejected'].includes(s.status));
  const overdueRfis = rfiItems.filter((r) => r.due_date < today && !['closed', 'answered'].includes(r.status));
  const overduePunch = punch.filter((p) => p.due_date < today && !['resolved', 'verified'].includes(p.status));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summary: Record<string, any> = {
    totalSubmittals: subs.length,
    totalRFIs: rfiItems.length,
    totalPunchList: punch.length,
    totalMilestones: ms.length,
    overdueItems: overdueSubs.length + overdueRfis.length + overduePunch.length,
  };

  // Only include budget data if the role has budget:view permission
  if (canPerform(projectRole, ACTIONS.BUDGET_VIEW) && seedProject.id === projectId) {
    summary.budgetTotal = seedProject.budget_total;
    summary.budgetSpent = seedProject.budget_spent;
    summary.budgetRemaining = seedProject.budget_total - seedProject.budget_spent;
  }

  return { success: true, data: summary };
}

function demoGetOverdueItems(projectId: string) {
  const today = new Date().toISOString().split('T')[0];

  const overdueSubmittals = seedSubmittals
    .filter((s) => s.project_id === projectId && s.due_date < today && !['approved', 'rejected'].includes(s.status))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 20)
    .map((s) => ({ id: s.id, number: s.number, title: s.title, status: s.status, due_date: s.due_date }));

  const overdueRFIs = seedRFIs
    .filter((r) => r.project_id === projectId && r.due_date < today && !['closed', 'answered'].includes(r.status))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 20)
    .map((r) => ({ id: r.id, number: r.number, subject: r.subject, status: r.status, priority: r.priority, due_date: r.due_date }));

  const overduePunchList = seedPunchListItems
    .filter((p) => p.project_id === projectId && p.due_date < today && !['resolved', 'verified'].includes(p.status))
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 20)
    .map((p) => ({ id: p.id, number: p.number, title: p.title, status: p.status, priority: p.priority, due_date: p.due_date, location: p.location }));

  return { success: true, data: { overdueSubmittals, overdueRFIs, overduePunchList } };
}

function demoGetBudgetSummary(projectId: string) {
  if (seedProject.id !== projectId) {
    return { success: false, error: 'Project not found in demo data' };
  }

  const ms = seedMilestones
    .filter((m) => m.project_id === projectId)
    .map((m) => ({
      id: m.id, name: m.name, budget_planned: m.budget_planned,
      budget_actual: m.budget_actual, status: m.status, percent_complete: m.percent_complete,
    }));

  return {
    success: true,
    data: {
      budgetTotal: seedProject.budget_total,
      budgetSpent: seedProject.budget_spent,
      budgetRemaining: seedProject.budget_total - seedProject.budget_spent,
      milestones: ms,
    },
  };
}

function demoGetTeamMembers(projectId: string, args: Record<string, unknown>) {
  let members = seedProjectMembers.filter((m) => m.project_id === projectId);
  if (args.role) members = members.filter((m) => m.project_role === args.role);

  let data = members.map((m) => {
    const profile = seedProfiles.find((p) => p.id === m.profile_id);
    return {
      id: profile?.id ?? '',
      name: profile?.full_name ?? 'Unknown',
      email: profile?.email ?? '',
      phone: profile?.phone ?? '',
      project_role: m.project_role,
      can_edit: m.can_edit,
    };
  });

  if (args.search) {
    const term = (args.search as string).toLowerCase();
    data = data.filter((m) => m.name.toLowerCase().includes(term));
  }

  return { success: true, data };
}

function demoGetMilestones(projectId: string, args: Record<string, unknown>, projectRole: ProjectMember['project_role']) {
  const hasBudgetView = canPerform(projectRole, ACTIONS.BUDGET_VIEW);
  let items = seedMilestones.filter((m) => m.project_id === projectId);
  if (args.status) items = items.filter((m) => m.status === args.status);

  const data = items.map((m) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const milestone: Record<string, any> = {
      id: m.id,
      name: m.name,
      status: m.status,
      percent_complete: m.percent_complete,
      target_date: m.target_date,
      sort_order: m.sort_order,
    };
    if (hasBudgetView) {
      milestone.budget_planned = m.budget_planned;
      milestone.budget_actual = m.budget_actual;
    }
    return milestone;
  });

  return { success: true, data };
}

function demoGetRecentActivity(projectId: string, args: Record<string, unknown>) {
  const limit = typeof args.limit === 'number' ? Math.min(args.limit, 50) : 20;

  let items = seedActivityLog
    .filter((a) => a.project_id === projectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  if (args.entity_type) items = items.filter((a) => a.entity_type === args.entity_type);

  const data = items.slice(0, limit).map((a) => {
    const profile = seedProfiles.find((p) => p.id === a.performed_by);
    return {
      id: a.id,
      entity_type: a.entity_type,
      action: a.action,
      description: a.description,
      performed_by: profile?.full_name ?? 'Unknown',
      created_at: a.created_at,
    };
  });

  return { success: true, data };
}

function demoGetDailyLogRollup(projectId: string, args: Record<string, unknown>) {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const dateFrom = (args.date_from as string) || sevenDaysAgo;
  const dateTo = (args.date_to as string) || today;

  const logs = seedDailyLogs
    .filter(d => d.project_id === projectId && d.log_date >= dateFrom && d.log_date <= dateTo)
    .sort((a, b) => a.log_date.localeCompare(b.log_date));

  const summaries = logs.map(l => ({
    date: l.log_date,
    summary: l.work_summary,
    safety: l.safety_notes,
    weather: `${l.weather_temp}°F, ${l.weather_conditions}`,
  }));

  return {
    success: true,
    data: {
      period: `${dateFrom} to ${dateTo}`,
      totalLogs: logs.length,
      logs: summaries,
    },
  };
}

// ── Demo Write Handlers (return mock successes) ──────────────────────────

function demoCreateRFI(projectId: string, args: Record<string, unknown>) {
  // Validate required fields
  if (!args.subject || typeof args.subject !== 'string' || args.subject.trim().length === 0) {
    return { success: false, error: 'Subject is required for creating an RFI.' };
  }
  if (!args.question || typeof args.question !== 'string' || args.question.trim().length === 0) {
    return { success: false, error: 'Question is required for creating an RFI.' };
  }

  const today = new Date().toISOString().split('T')[0];
  const count = seedRFIs.filter((r) => r.project_id === projectId).length;
  const number = `RFI-${String(count + 1).padStart(3, '0')}`;

  return {
    success: true,
    data: {
      id: `demo-rfi-${Date.now()}`,
      number,
      subject: args.subject as string,
      status: 'open',
      priority: (args.priority as string) ?? 'medium',
      due_date: (args.due_date as string) ?? today,
    },
  };
}

function demoCreatePunchListItem(projectId: string, args: Record<string, unknown>) {
  // Validate required fields
  if (!args.title || typeof args.title !== 'string' || args.title.trim().length === 0) {
    return { success: false, error: 'Title is required for creating a punch list item.' };
  }
  if (!args.description || typeof args.description !== 'string' || args.description.trim().length === 0) {
    return { success: false, error: 'Description is required for creating a punch list item.' };
  }
  if (!args.location || typeof args.location !== 'string' || args.location.trim().length === 0) {
    return { success: false, error: 'Location is required for creating a punch list item.' };
  }

  const today = new Date().toISOString().split('T')[0];
  const count = seedPunchListItems.filter((p) => p.project_id === projectId).length;
  const number = `PL-${String(count + 1).padStart(3, '0')}`;

  return {
    success: true,
    data: {
      id: `demo-pl-${Date.now()}`,
      number,
      title: args.title as string,
      status: 'open',
      priority: (args.priority as string) ?? 'medium',
      location: args.location as string,
      due_date: (args.due_date as string) ?? today,
    },
  };
}

function demoCreateDailyLog(args: Record<string, unknown>) {
  // Validate required fields
  if (!args.work_summary || typeof args.work_summary !== 'string' || args.work_summary.trim().length === 0) {
    return { success: false, error: 'Work summary is required for creating a daily log.' };
  }

  const today = new Date().toISOString().split('T')[0];

  return {
    success: true,
    data: {
      id: `demo-log-${Date.now()}`,
      log_date: (args.log_date as string) ?? today,
      work_summary: args.work_summary as string,
      weather_conditions: (args.weather_conditions as string) ?? '',
      weather_temp: (args.weather_temp as number) ?? 0,
    },
  };
}
