// src/lib/actions/dashboard.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { getLocalDateString } from '@/lib/date-utils';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkProjectMembership,
} from './permissions-helper';

export interface DashboardMetrics {
  totalSubmittals: number;
  pendingSubmittals: number;
  openRFIs: number;
  overdueRFIs: number;
  openPunch: number;
  criticalPunch: number;
  totalLogs: number;
  lastLogDate: string | null;
  approvedChangeOrderTotal: number;
  pendingChangeOrders: number;
  earnedValue: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
}

/**
 * Fetch all dashboard data in a single server action.
 * Authenticates once, then runs all 4 queries in parallel.
 */
export async function getDashboardData(
  projectId: string
): Promise<ActionResult<DashboardData>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const today = getLocalDateString();
    const [
      submittalsTotalRes,
      pendingSubmittalsRes,
      openRfisRes,
      overdueRfisRes,
      openPunchRes,
      criticalPunchRes,
      logsCountRes,
      lastLogRes,
      approvedChangeOrdersRes,
      pendingChangeOrdersRes,
      milestonesRes,
    ] = await Promise.all([
      supabase
        .from('submittals')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId),

      supabase
        .from('submittals')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', ['submitted', 'under_review']),

      supabase
        .from('rfis')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', ['open', 'overdue']),

      supabase
        .from('rfis')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .lt('due_date', today)
        .not('status', 'in', '("answered","closed")'),

      supabase
        .from('punch_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', ['open', 'in_progress']),

      supabase
        .from('punch_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', ['open', 'in_progress'])
        .eq('priority', 'critical'),

      supabase
        .from('daily_logs')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId),

      supabase
        .from('daily_logs')
        .select('log_date')
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('change_orders')
        .select('amount')
        .eq('project_id', projectId)
        .eq('status', 'approved'),

      supabase
        .from('change_orders')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('status', ['submitted', 'draft']),

      supabase
        .from('milestones')
        .select('budget_planned, percent_complete')
        .eq('project_id', projectId),
    ]);

    // Return first error if any query failed
    const firstError = [
      submittalsTotalRes,
      pendingSubmittalsRes,
      openRfisRes,
      overdueRfisRes,
      openPunchRes,
      criticalPunchRes,
      logsCountRes,
      lastLogRes,
      approvedChangeOrdersRes,
      pendingChangeOrdersRes,
      milestonesRes,
    ].find((r) => r.error);
    if (firstError?.error) return { error: firstError.error.message };

    const approvedChangeOrderTotal = (approvedChangeOrdersRes.data ?? []).reduce(
      (sum, co) => sum + (Number(co.amount) || 0),
      0,
    );
    const earnedValue = (milestonesRes.data ?? []).reduce(
      (sum, milestone) =>
        sum + ((Number(milestone.budget_planned) || 0) * (Number(milestone.percent_complete) || 0)) / 100,
      0,
    );

    return {
      success: true,
      data: {
        metrics: {
          totalSubmittals: submittalsTotalRes.count ?? 0,
          pendingSubmittals: pendingSubmittalsRes.count ?? 0,
          openRFIs: openRfisRes.count ?? 0,
          overdueRFIs: overdueRfisRes.count ?? 0,
          openPunch: openPunchRes.count ?? 0,
          criticalPunch: criticalPunchRes.count ?? 0,
          totalLogs: logsCountRes.count ?? 0,
          lastLogDate: lastLogRes.data?.log_date ?? null,
          approvedChangeOrderTotal,
          pendingChangeOrders: pendingChangeOrdersRes.count ?? 0,
          earnedValue,
        },
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch dashboard data' };
  }
}
