// src/lib/actions/milestones.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { Milestone, MilestoneStatus } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getMilestones -- all milestones for a project
// ---------------------------------------------------------------------------
export async function getMilestones(projectId: string): Promise<ActionResult<Milestone[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (error) return { error: error.message };

    return { success: true, data: (data as Milestone[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch milestones' };
  }
}

// ---------------------------------------------------------------------------
// createMilestone -- requires schedule:edit
// ---------------------------------------------------------------------------
export async function createMilestone(
  projectId: string,
  data: {
    name: string;
    description: string;
    target_date: string;
    status?: MilestoneStatus;
    percent_complete?: number;
    budget_planned?: number;
    budget_actual?: number;
    sort_order?: number;
  }
): Promise<ActionResult<Milestone>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.SCHEDULE_EDIT);
    if (!perm.allowed) return { error: perm.error };

    // Determine the next sort_order if not provided
    let sortOrder = data.sort_order;
    if (sortOrder === undefined) {
      const { data: existing } = await supabase
        .from('milestones')
        .select('sort_order')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: false })
        .limit(1);

      sortOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;
    }

    const { data: milestone, error } = await supabase
      .from('milestones')
      .insert({
        project_id: projectId,
        name: data.name,
        description: data.description,
        target_date: data.target_date,
        actual_date: null,
        status: data.status ?? 'not_started',
        percent_complete: data.percent_complete ?? 0,
        budget_planned: data.budget_planned ?? 0,
        budget_actual: data.budget_actual ?? 0,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'milestone',
      milestone.id,
      'created',
      `created milestone: ${data.name}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/schedule`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: milestone as Milestone };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create milestone' };
  }
}

// ---------------------------------------------------------------------------
// updateMilestone -- requires schedule:edit
// ---------------------------------------------------------------------------
export async function updateMilestone(
  projectId: string,
  milestoneId: string,
  data: {
    name?: string;
    description?: string;
    target_date?: string;
    actual_date?: string | null;
    status?: MilestoneStatus;
    percent_complete?: number;
    budget_planned?: number;
    budget_actual?: number;
    sort_order?: number;
  }
): Promise<ActionResult<Milestone>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.SCHEDULE_EDIT);
    if (!perm.allowed) return { error: perm.error };

    // If status is being set to 'complete', auto-fill actual_date
    const updateData = { ...data };
    if (updateData.status === 'complete' && updateData.actual_date === undefined) {
      updateData.actual_date = new Date().toISOString().split('T')[0];
    }
    if (updateData.status === 'complete' && updateData.percent_complete === undefined) {
      updateData.percent_complete = 100;
    }

    const { data: milestone, error } = await supabase
      .from('milestones')
      .update(updateData)
      .eq('id', milestoneId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    const actionType = data.status ? 'status_changed' : 'updated';
    const description = data.status
      ? `changed milestone "${milestone.name}" status to ${data.status}`
      : `updated milestone: ${milestone.name}`;

    await logActivity(
      supabase,
      projectId,
      'milestone',
      milestoneId,
      actionType,
      description,
      user.id
    );

    revalidatePath(`/projects/${projectId}/schedule`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: milestone as Milestone };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update milestone' };
  }
}
