// src/lib/actions/dashboard.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import type { Submittal, RFI, DailyLog, PunchListItem } from '@/lib/types';
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

    // Run all 4 queries in parallel — single auth check above
    const [submittalsRes, rfisRes, punchRes, logsRes] = await Promise.all([
      supabase
        .from('submittals')
        .select(`
          *,
          submitted_by_profile:profiles!submittals_submitted_by_fkey(id, full_name, email, avatar_url),
          reviewed_by_profile:profiles!submittals_reviewed_by_fkey(id, full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),

      supabase
        .from('rfis')
        .select(`
          *,
          submitted_by_profile:profiles!rfis_submitted_by_fkey(id, full_name, email, avatar_url),
          assigned_to_profile:profiles!rfis_assigned_to_fkey(id, full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),

      supabase
        .from('punch_list_items')
        .select(`
          *,
          assigned_to_profile:profiles!punch_list_items_assigned_to_fkey(id, full_name, email, avatar_url),
          created_by_profile:profiles!punch_list_items_created_by_fkey(id, full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),

      supabase
        .from('daily_logs')
        .select(`
          *,
          created_by_profile:profiles!daily_logs_created_by_fkey(id, full_name, email, avatar_url)
        `)
        .eq('project_id', projectId)
        .order('log_date', { ascending: false }),
    ]);

    // Return first error if any query failed
    const firstError = [submittalsRes, rfisRes, punchRes, logsRes].find((r) => r.error);
    if (firstError?.error) return { error: firstError.error.message };

    return {
      success: true,
      data: {
        submittals: (submittalsRes.data as Submittal[]) ?? [],
        rfis: (rfisRes.data as RFI[]) ?? [],
        punchListItems: (punchRes.data as PunchListItem[]) ?? [],
        dailyLogs: (logsRes.data as DailyLog[]) ?? [],
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch dashboard data' };
  }
}
