// src/lib/actions/activity-log.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import type { ActivityLogEntry } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkProjectMembership,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getActivityLog -- recent activity for a project
// ---------------------------------------------------------------------------
export async function getActivityLog(
  projectId: string,
  limit: number = 50
): Promise<ActionResult<ActivityLogEntry[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    // Clamp limit to a reasonable range
    const safeLimit = Math.min(Math.max(1, limit), 200);

    const { data, error } = await supabase
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
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) return { error: error.message };

    return { success: true, data: (data as ActivityLogEntry[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch activity log' };
  }
}
