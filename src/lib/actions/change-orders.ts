// src/lib/actions/change-orders.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { ChangeOrder } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';
import { getLocalDateString } from '@/lib/date-utils';

// ---------------------------------------------------------------------------
// getChangeOrders -- all change orders for a project
// ---------------------------------------------------------------------------
export async function getChangeOrders(projectId: string): Promise<ActionResult<ChangeOrder[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('change_orders')
      .select('*, submitted_by_profile:profiles!change_orders_submitted_by_fkey(*), approved_by_profile:profiles!change_orders_approved_by_fkey(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as ChangeOrder[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch change orders' };
  }
}

// ---------------------------------------------------------------------------
// getChangeOrderById -- single change order with profile joins
// ---------------------------------------------------------------------------
export async function getChangeOrderById(
  changeOrderId: string,
  projectId: string
): Promise<ActionResult<ChangeOrder>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('change_orders')
      .select('*, submitted_by_profile:profiles!change_orders_submitted_by_fkey(*), approved_by_profile:profiles!change_orders_approved_by_fkey(*)')
      .eq('id', changeOrderId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };

    return { success: true, data: data as ChangeOrder };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch change order' };
  }
}

// ---------------------------------------------------------------------------
// createChangeOrder -- requires change_order:manage
// ---------------------------------------------------------------------------
export async function createChangeOrder(
  projectId: string,
  data: {
    title: string;
    description: string;
    reason: string;
    amount: number;
    linked_milestone_id?: string | null;
  }
): Promise<ActionResult<ChangeOrder>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.CHANGE_ORDER_MANAGE);
    if (!perm.allowed) return { error: perm.error };

    // Auto-number: count existing change orders for this project
    const { count } = await supabase
      .from('change_orders')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const number = `CO-${String((count ?? 0) + 1).padStart(3, '0')}`;

    const { data: changeOrder, error } = await supabase
      .from('change_orders')
      .insert({
        project_id: projectId,
        number,
        title: data.title,
        description: data.description,
        reason: data.reason,
        amount: data.amount,
        status: 'draft',
        submitted_by: user.id,
        submit_date: getLocalDateString(),
        linked_milestone_id: data.linked_milestone_id ?? null,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as const,
      changeOrder.id,
      'created',
      `created change order ${number}: ${data.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/schedule`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: changeOrder as ChangeOrder };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create change order' };
  }
}

// ---------------------------------------------------------------------------
// updateChangeOrder -- requires change_order:manage
// ---------------------------------------------------------------------------
export async function updateChangeOrder(
  projectId: string,
  changeOrderId: string,
  data: {
    title?: string;
    description?: string;
    reason?: string;
    amount?: number;
    status?: ChangeOrder['status'];
    linked_milestone_id?: string | null;
  }
): Promise<ActionResult<ChangeOrder>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.CHANGE_ORDER_MANAGE);
    if (!perm.allowed) return { error: perm.error };

    // If status changes to 'approved', auto-set approval fields
    const updateData: Record<string, unknown> = { ...data };
    if (data.status === 'approved') {
      updateData.approval_date = getLocalDateString();
      updateData.approved_by = user.id;
    }

    const { data: changeOrder, error } = await supabase
      .from('change_orders')
      .update(updateData)
      .eq('id', changeOrderId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    const actionType = data.status ? 'status_changed' : 'updated';
    const description = data.status
      ? `changed change order "${changeOrder.title}" status to ${data.status}`
      : `updated change order: ${changeOrder.title}`;

    await logActivity(
      supabase,
      projectId,
      'project' as const,
      changeOrderId,
      actionType,
      description,
      user.id
    );

    revalidatePath(`/projects/${projectId}/schedule`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: changeOrder as ChangeOrder };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update change order' };
  }
}

// ---------------------------------------------------------------------------
// deleteChangeOrder -- requires change_order:manage
// ---------------------------------------------------------------------------
export async function deleteChangeOrder(
  projectId: string,
  changeOrderId: string
): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.CHANGE_ORDER_MANAGE);
    if (!perm.allowed) return { error: perm.error };

    const { error } = await supabase
      .from('change_orders')
      .delete()
      .eq('id', changeOrderId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as const,
      changeOrderId,
      'deleted',
      `deleted change order`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/schedule`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete change order' };
  }
}
