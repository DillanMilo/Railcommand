// src/lib/actions/submittals.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { Submittal, SubmittalStatus } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getSubmittals -- all submittals for a project
// ---------------------------------------------------------------------------
export async function getSubmittals(projectId: string): Promise<ActionResult<Submittal[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('submittals')
      .select(`
        *,
        submitted_by_profile:profiles!submittals_submitted_by_fkey(id, full_name, email, avatar_url),
        reviewed_by_profile:profiles!submittals_reviewed_by_fkey(id, full_name, email, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as Submittal[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch submittals' };
  }
}

// ---------------------------------------------------------------------------
// getSubmittalById -- single submittal with profile joins
// ---------------------------------------------------------------------------
export async function getSubmittalById(
  projectId: string,
  submittalId: string
): Promise<ActionResult<Submittal>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('submittals')
      .select(`
        *,
        submitted_by_profile:profiles!submittals_submitted_by_fkey(id, full_name, email, avatar_url),
        reviewed_by_profile:profiles!submittals_reviewed_by_fkey(id, full_name, email, avatar_url),
        attachments(*)
      `)
      .eq('id', submittalId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'Submittal not found' };

    return { success: true, data: data as Submittal };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch submittal' };
  }
}

// ---------------------------------------------------------------------------
// createSubmittal -- requires submittal:create
// Auto-generates human-readable number server-side (SUB-001, SUB-002, ...)
// ---------------------------------------------------------------------------
export async function createSubmittal(
  projectId: string,
  data: {
    title: string;
    description: string;
    spec_section: string;
    due_date: string;
    milestone_id?: string | null;
  }
): Promise<ActionResult<Submittal>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.SUBMITTAL_CREATE);
    if (!perm.allowed) return { error: perm.error };

    // Generate the next human-readable number for this project
    const { count, error: countError } = await supabase
      .from('submittals')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (countError) return { error: countError.message };

    const nextNum = (count ?? 0) + 1;
    const number = `SUB-${String(nextNum).padStart(3, '0')}`;

    const { data: submittal, error } = await supabase
      .from('submittals')
      .insert({
        project_id: projectId,
        number,
        title: data.title,
        description: data.description,
        spec_section: data.spec_section,
        status: 'submitted' as SubmittalStatus,
        submitted_by: user.id,
        submit_date: new Date().toISOString(),
        due_date: data.due_date,
        milestone_id: data.milestone_id ?? null,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'submittal',
      submittal.id,
      'created',
      `submitted ${number}: ${data.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/submittals`);

    return { success: true, data: submittal as Submittal };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create submittal' };
  }
}

// ---------------------------------------------------------------------------
// updateSubmittalStatus -- requires submittal:review for approve/reject/conditional
// ---------------------------------------------------------------------------
export async function updateSubmittalStatus(
  projectId: string,
  submittalId: string,
  status: SubmittalStatus,
  reviewNotes?: string
): Promise<ActionResult<Submittal>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Approve, reject, conditional require submittal:review permission
    const reviewStatuses: SubmittalStatus[] = ['approved', 'rejected', 'conditional'];
    if (reviewStatuses.includes(status)) {
      const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.SUBMITTAL_REVIEW);
      if (!perm.allowed) return { error: perm.error };
    } else {
      // For other status changes, verify membership at minimum
      const access = await checkProjectMembership(supabase, user.id, projectId);
      if (!access.isMember) return { error: access.error };
    }

    const updateData: Record<string, unknown> = { status };

    if (reviewStatuses.includes(status)) {
      updateData.reviewed_by = user.id;
      updateData.review_date = new Date().toISOString();
    }

    if (reviewNotes !== undefined) {
      updateData.review_notes = reviewNotes;
    }

    const { data: submittal, error } = await supabase
      .from('submittals')
      .update(updateData)
      .eq('id', submittalId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    const actionType = reviewStatuses.includes(status)
      ? (status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'status_changed')
      : 'status_changed';

    await logActivity(
      supabase,
      projectId,
      'submittal',
      submittalId,
      actionType,
      `changed ${submittal.number} status to ${status}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/submittals`);
    revalidatePath(`/projects/${projectId}/submittals/${submittalId}`);

    return { success: true, data: submittal as Submittal };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update submittal status' };
  }
}
