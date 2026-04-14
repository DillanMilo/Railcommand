// src/lib/actions/modifications.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { Modification, ModificationType } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';
import { getLocalDateString } from '@/lib/date-utils';

const PROFILE_JOINS =
  '*, issued_by_profile:profiles!modifications_issued_by_fkey(*), acknowledged_by_profile:profiles!modifications_acknowledged_by_fkey(*)';

// ---------------------------------------------------------------------------
// getModifications -- all modifications for a project
// ---------------------------------------------------------------------------
export async function getModifications(projectId: string): Promise<ActionResult<Modification[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('modifications')
      .select(PROFILE_JOINS)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as Modification[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch modifications' };
  }
}

// ---------------------------------------------------------------------------
// getModificationById -- single modification with profile joins
// ---------------------------------------------------------------------------
export async function getModificationById(
  modificationId: string,
  projectId: string
): Promise<ActionResult<Modification>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('modifications')
      .select(PROFILE_JOINS)
      .eq('id', modificationId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };

    return { success: true, data: data as Modification };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch modification' };
  }
}

// ---------------------------------------------------------------------------
// createModification -- requires SCHEDULE_EDIT
// ---------------------------------------------------------------------------
export async function createModification(
  projectId: string,
  data: {
    title: string;
    description: string;
    modification_type: ModificationType;
    revision_number: string;
    affected_documents: string;
    linked_milestone_id?: string | null;
  }
): Promise<ActionResult<Modification>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.SCHEDULE_EDIT);
    if (!perm.allowed) return { error: perm.error };

    // Auto-number: count existing modifications for this project
    const { count } = await supabase
      .from('modifications')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const number = `MOD-${String((count ?? 0) + 1).padStart(3, '0')}`;

    const { data: modification, error } = await supabase
      .from('modifications')
      .insert({
        project_id: projectId,
        number,
        title: data.title,
        description: data.description,
        modification_type: data.modification_type,
        revision_number: data.revision_number,
        affected_documents: data.affected_documents,
        status: 'draft',
        issued_by: user.id,
        issued_date: getLocalDateString(),
        linked_milestone_id: data.linked_milestone_id ?? null,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as const,
      modification.id,
      'created',
      `created modification ${number}: ${data.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/schedule`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: modification as Modification };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create modification' };
  }
}

// ---------------------------------------------------------------------------
// updateModification -- requires SCHEDULE_EDIT
// ---------------------------------------------------------------------------
export async function updateModification(
  projectId: string,
  modificationId: string,
  data: {
    title?: string;
    description?: string;
    modification_type?: ModificationType;
    revision_number?: string;
    affected_documents?: string;
    status?: Modification['status'];
    linked_milestone_id?: string | null;
  }
): Promise<ActionResult<Modification>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.SCHEDULE_EDIT);
    if (!perm.allowed) return { error: perm.error };

    const updateData: Record<string, unknown> = { ...data };

    // Auto-set acknowledged fields when status changes to 'acknowledged'
    if (data.status === 'acknowledged') {
      updateData.acknowledged_by = user.id;
      updateData.acknowledged_date = getLocalDateString();
    }

    // Auto-set effective_date when status changes to 'implemented'
    if (data.status === 'implemented') {
      updateData.effective_date = getLocalDateString();
    }

    const { data: modification, error } = await supabase
      .from('modifications')
      .update(updateData)
      .eq('id', modificationId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    const actionType = data.status ? 'status_changed' : 'updated';
    const description = data.status
      ? `changed modification "${modification.title}" status to ${data.status}`
      : `updated modification: ${modification.title}`;

    await logActivity(
      supabase,
      projectId,
      'project' as const,
      modificationId,
      actionType,
      description,
      user.id
    );

    revalidatePath(`/projects/${projectId}/schedule`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: modification as Modification };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update modification' };
  }
}

// ---------------------------------------------------------------------------
// deleteModification -- requires SCHEDULE_EDIT
// ---------------------------------------------------------------------------
export async function deleteModification(
  projectId: string,
  modificationId: string
): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.SCHEDULE_EDIT);
    if (!perm.allowed) return { error: perm.error };

    const { error } = await supabase
      .from('modifications')
      .delete()
      .eq('id', modificationId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as const,
      modificationId,
      'deleted',
      `deleted modification`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/schedule`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete modification' };
  }
}
