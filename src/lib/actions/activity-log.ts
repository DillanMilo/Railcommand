// src/lib/actions/activity-log.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActivityLogEntry } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkProjectMembership,
} from './permissions-helper';

const ACTIVITY_EXPORT_PAGE_SIZE = 1000;

// ---------------------------------------------------------------------------
// getActivityLog -- recent activity for a project
// ---------------------------------------------------------------------------
export async function getActivityLog(
  projectId: string,
  limit: number | 'all' = 50
): Promise<ActionResult<ActivityLogEntry[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const baseQuery = () => supabase
      .from('activity_log')
      .select(`
        *,
        performed_by_profile:profiles!activity_log_performed_by_fkey(
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (limit === 'all') {
      const allRows: ActivityLogEntry[] = [];
      let offset = 0;

      while (true) {
        const { data, error } = await baseQuery().range(
          offset,
          offset + ACTIVITY_EXPORT_PAGE_SIZE - 1
        );

        if (error) return { error: error.message };

        const page = (data as ActivityLogEntry[]) ?? [];
        allRows.push(...page);

        if (page.length < ACTIVITY_EXPORT_PAGE_SIZE) {
          return { success: true, data: allRows };
        }

        offset += ACTIVITY_EXPORT_PAGE_SIZE;
      }
    }

    // Clamp list views to a reasonable range while allowing explicit full-history exports.
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const { data, error } = await baseQuery().limit(safeLimit);

    if (error) return { error: error.message };

    return { success: true, data: (data as ActivityLogEntry[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch activity log' };
  }
}
