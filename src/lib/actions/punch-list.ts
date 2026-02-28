// src/lib/actions/punch-list.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { PunchListItem, PunchListStatus, Priority, GeoTag } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getPunchListItems -- all punch list items for a project
// ---------------------------------------------------------------------------
export async function getPunchListItems(
  projectId: string
): Promise<ActionResult<PunchListItem[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('punch_list_items')
      .select(`
        *,
        assigned_to_profile:profiles!punch_list_items_assigned_to_fkey(id, full_name, email, avatar_url),
        created_by_profile:profiles!punch_list_items_created_by_fkey(id, full_name, email, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as PunchListItem[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch punch list items' };
  }
}

// ---------------------------------------------------------------------------
// getPunchListItemById -- single punch list item with attachments
// ---------------------------------------------------------------------------
export async function getPunchListItemById(
  projectId: string,
  itemId: string
): Promise<ActionResult<PunchListItem>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('punch_list_items')
      .select(`
        *,
        assigned_to_profile:profiles!punch_list_items_assigned_to_fkey(id, full_name, email, avatar_url),
        created_by_profile:profiles!punch_list_items_created_by_fkey(id, full_name, email, avatar_url),
        attachments(*)
      `)
      .eq('id', itemId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'Punch list item not found' };

    return { success: true, data: data as PunchListItem };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch punch list item' };
  }
}

// ---------------------------------------------------------------------------
// createPunchListItem -- requires punch_list:create
// Auto-generates human-readable number (PL-001, PL-002, ...)
// ---------------------------------------------------------------------------
export async function createPunchListItem(
  projectId: string,
  data: {
    title: string;
    description: string;
    location: string;
    priority: Priority;
    assigned_to: string;
    due_date: string;
    geo_tag?: GeoTag | null;
  }
): Promise<ActionResult<PunchListItem>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.PUNCH_LIST_CREATE);
    if (!perm.allowed) return { error: perm.error };

    // Generate next human-readable number for this project
    const { count, error: countError } = await supabase
      .from('punch_list_items')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (countError) return { error: countError.message };

    const nextNum = (count ?? 0) + 1;
    const number = `PL-${String(nextNum).padStart(3, '0')}`;

    const { data: item, error } = await supabase
      .from('punch_list_items')
      .insert({
        project_id: projectId,
        number,
        title: data.title,
        description: data.description,
        location: data.location,
        geo_tag: data.geo_tag ?? null,
        status: 'open' as PunchListStatus,
        priority: data.priority,
        assigned_to: data.assigned_to || user.id,
        created_by: user.id,
        due_date: data.due_date,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'punch_list',
      item.id,
      'created',
      `created ${number}: ${data.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/punch-list`);

    return { success: true, data: item as PunchListItem };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create punch list item' };
  }
}

// ---------------------------------------------------------------------------
// updatePunchListStatus
//  - 'resolved' requires punch_list:resolve
//  - 'verified' requires punch_list:verify
//  - other status changes require membership
// ---------------------------------------------------------------------------
export async function updatePunchListStatus(
  projectId: string,
  itemId: string,
  status: PunchListStatus,
  resolutionNotes?: string
): Promise<ActionResult<PunchListItem>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Check appropriate permission based on the target status
    if (status === 'resolved') {
      const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.PUNCH_LIST_RESOLVE);
      if (!perm.allowed) return { error: perm.error };
    } else if (status === 'verified') {
      const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.PUNCH_LIST_VERIFY);
      if (!perm.allowed) return { error: perm.error };
    } else {
      const access = await checkProjectMembership(supabase, user.id, projectId);
      if (!access.isMember) return { error: access.error };
    }

    const updateData: Record<string, unknown> = { status };

    if (status === 'resolved') {
      updateData.resolved_date = new Date().toISOString();
    }

    if (status === 'verified') {
      updateData.verified_date = new Date().toISOString();
    }

    if (resolutionNotes !== undefined) {
      updateData.resolution_notes = resolutionNotes;
    }

    const { data: item, error } = await supabase
      .from('punch_list_items')
      .update(updateData)
      .eq('id', itemId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'punch_list',
      itemId,
      'status_changed',
      `changed ${item.number} status to ${status}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/punch-list`);
    revalidatePath(`/projects/${projectId}/punch-list/${itemId}`);

    return { success: true, data: item as PunchListItem };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update punch list status' };
  }
}
