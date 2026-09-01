'use server';

import { createClient } from '@/lib/supabase/server';
import type { DailyLog, Project, ProjectMember } from '@/lib/types';
import {
  RECENT_DAILY_LOG_LIMIT,
  type OfflineProjectSnapshot,
} from '@/lib/offline/project-cache';
import {
  type ActionResult,
  checkProjectMembership,
  getAuthenticatedUser,
} from './permissions-helper';

/**
 * Build the read-only bundle needed to reopen the active project when the
 * network disappears. Authentication, membership, and RLS are evaluated on
 * every refresh; IndexedDB is only a device cache, never an authorization
 * boundary.
 */
export async function getOfflineProjectSnapshot(
  projectId: string
): Promise<ActionResult<OfflineProjectSnapshot>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const [projectResult, membersResult, dailyLogsResult] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).single(),
      supabase
        .from('project_members')
        .select(`
          *,
          profile:profiles(
            id,
            full_name,
            email,
            phone,
            role,
            avatar_url,
            organization:organizations(id, name, type)
          )
        `)
        .eq('project_id', projectId)
        .order('added_at', { ascending: true }),
      supabase
        .from('daily_logs')
        .select(`
          *,
          created_by_profile:profiles!daily_logs_created_by_fkey(
            id,
            full_name,
            email,
            avatar_url
          ),
          personnel:daily_log_personnel(*),
          equipment:daily_log_equipment(*),
          work_items:daily_log_work_items(*)
        `)
        .eq('project_id', projectId)
        .order('log_date', { ascending: false })
        .limit(RECENT_DAILY_LOG_LIMIT),
    ]);

    const error = projectResult.error ?? membersResult.error ?? dailyLogsResult.error;
    if (error) return { error: error.message };
    if (!projectResult.data) return { error: 'Project not found' };

    return {
      success: true,
      data: {
        project: projectResult.data as Project,
        members: (membersResult.data as ProjectMember[]) ?? [],
        dailyLogs: (dailyLogsResult.data as DailyLog[]) ?? [],
        synchronizedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to refresh offline project data',
    };
  }
}
