// src/lib/actions/dashboard.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import type { Submittal, RFI, DailyLog, PunchListItem, Milestone, ChangeOrder } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkProjectMembership,
} from './permissions-helper';

export interface DashboardData {
  submittals: Submittal[];
  rfis: RFI[];
  punchListItems: PunchListItem[];
  dailyLogs: DailyLog[];
  milestones: Milestone[];
  changeOrders: ChangeOrder[];
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

    // Run all 6 queries in parallel — single auth check above.
    //
    // NOTE: the dashboard page aggregates KPI stats client-side from these raw
    // arrays (lengths, status filters, EV/CO amount reductions), so the return
    // shape must remain full row arrays — head-true count queries cannot be
    // substituted without changing the consumer. Each query carries a
    // defensive .limit(1000) (ordered newest-first) to bound the payload.
    const DASHBOARD_ROW_CAP = 1000;
    const [submittalsRes, rfisRes, punchRes, logsRes, milestonesRes, changeOrdersRes] = await Promise.all([
      supabase
        .from('submittals')
        .select(`
          *,
          submitted_by_profile:profiles!submittals_submitted_by_fkey(id, full_name, email, avatar_url),
          reviewed_by_profile:profiles!submittals_reviewed_by_fkey(id, full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(DASHBOARD_ROW_CAP),

      supabase
        .from('rfis')
        .select(`
          *,
          submitted_by_profile:profiles!rfis_submitted_by_fkey(id, full_name, email, avatar_url),
          assigned_to_profile:profiles!rfis_assigned_to_fkey(id, full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(DASHBOARD_ROW_CAP),

      supabase
        .from('punch_list_items')
        .select(`
          *,
          assigned_to_profile:profiles!punch_list_items_assigned_to_fkey(id, full_name, email, avatar_url),
          created_by_profile:profiles!punch_list_items_created_by_fkey(id, full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(DASHBOARD_ROW_CAP),

      supabase
        .from('daily_logs')
        .select(`
          *,
          created_by_profile:profiles!daily_logs_created_by_fkey(id, full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
        .limit(DASHBOARD_ROW_CAP),

      supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .limit(DASHBOARD_ROW_CAP),

      supabase
        .from('change_orders')
        .select(`
          *,
          submitted_by_profile:profiles!change_orders_submitted_by_fkey(id, full_name, email, avatar_url),
          approved_by_profile:profiles!change_orders_approved_by_fkey(id, full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(DASHBOARD_ROW_CAP),
    ]);

    // Return first error if any query failed
    const firstError = [submittalsRes, rfisRes, punchRes, logsRes, milestonesRes, changeOrdersRes].find((r) => r.error);
    if (firstError?.error) return { error: firstError.error.message };

    return {
      success: true,
      data: {
        submittals: (submittalsRes.data as Submittal[]) ?? [],
        rfis: (rfisRes.data as RFI[]) ?? [],
        punchListItems: (punchRes.data as PunchListItem[]) ?? [],
        dailyLogs: (logsRes.data as DailyLog[]) ?? [],
        milestones: (milestonesRes.data as Milestone[]) ?? [],
        changeOrders: (changeOrdersRes.data as ChangeOrder[]) ?? [],
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch dashboard data' };
  }
}
