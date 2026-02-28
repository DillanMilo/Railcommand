// src/lib/actions/rfis.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { RFI, RFIResponse, RFIStatus, Priority } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getRFIs -- all RFIs for a project
// ---------------------------------------------------------------------------
export async function getRFIs(projectId: string): Promise<ActionResult<RFI[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('rfis')
      .select(`
        *,
        submitted_by_profile:profiles!rfis_submitted_by_fkey(id, full_name, email, avatar_url),
        assigned_to_profile:profiles!rfis_assigned_to_fkey(id, full_name, email, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as RFI[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch RFIs' };
  }
}

// ---------------------------------------------------------------------------
// getRFIById -- single RFI with responses included
// ---------------------------------------------------------------------------
export async function getRFIById(
  projectId: string,
  rfiId: string
): Promise<ActionResult<RFI>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('rfis')
      .select(`
        *,
        submitted_by_profile:profiles!rfis_submitted_by_fkey(id, full_name, email, avatar_url),
        assigned_to_profile:profiles!rfis_assigned_to_fkey(id, full_name, email, avatar_url),
        responses:rfi_responses(
          *,
          author:profiles!rfi_responses_author_id_fkey(id, full_name, email, avatar_url)
        ),
        attachments(*)
      `)
      .eq('id', rfiId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'RFI not found' };

    return { success: true, data: data as RFI };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch RFI' };
  }
}

// ---------------------------------------------------------------------------
// createRFI -- requires rfi:create
// Auto-generates human-readable number server-side (RFI-001, RFI-002, ...)
// ---------------------------------------------------------------------------
export async function createRFI(
  projectId: string,
  data: {
    subject: string;
    question: string;
    priority: Priority;
    assigned_to: string;
    due_date: string;
    milestone_id?: string | null;
  }
): Promise<ActionResult<RFI>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.RFI_CREATE);
    if (!perm.allowed) return { error: perm.error };

    // Generate next human-readable number for this project
    const { count, error: countError } = await supabase
      .from('rfis')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (countError) return { error: countError.message };

    const nextNum = (count ?? 0) + 1;
    const number = `RFI-${String(nextNum).padStart(3, '0')}`;

    const { data: rfi, error } = await supabase
      .from('rfis')
      .insert({
        project_id: projectId,
        number,
        subject: data.subject,
        question: data.question,
        answer: null,
        status: 'open' as RFIStatus,
        priority: data.priority,
        submitted_by: user.id,
        assigned_to: data.assigned_to,
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
      'rfi',
      rfi.id,
      'created',
      `created ${number}: ${data.subject}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/rfis`);

    return { success: true, data: rfi as RFI };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create RFI' };
  }
}

// ---------------------------------------------------------------------------
// updateRFIStatus -- requires rfi:close for closing
// ---------------------------------------------------------------------------
export async function updateRFIStatus(
  projectId: string,
  rfiId: string,
  status: RFIStatus
): Promise<ActionResult<RFI>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Closing an RFI requires rfi:close permission
    if (status === 'closed') {
      const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.RFI_CLOSE);
      if (!perm.allowed) return { error: perm.error };
    } else {
      const access = await checkProjectMembership(supabase, user.id, projectId);
      if (!access.isMember) return { error: access.error };
    }

    const updateData: Record<string, unknown> = { status };

    if (status === 'answered' || status === 'closed') {
      updateData.response_date = new Date().toISOString();
    }

    const { data: rfi, error } = await supabase
      .from('rfis')
      .update(updateData)
      .eq('id', rfiId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'rfi',
      rfiId,
      'status_changed',
      `changed ${rfi.number} status to ${status}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/rfis`);
    revalidatePath(`/projects/${projectId}/rfis/${rfiId}`);

    return { success: true, data: rfi as RFI };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update RFI status' };
  }
}

// ---------------------------------------------------------------------------
// addRFIResponse -- requires rfi:respond for official responses
// ---------------------------------------------------------------------------
export async function addRFIResponse(
  projectId: string,
  rfiId: string,
  content: string,
  isOfficial: boolean
): Promise<ActionResult<RFIResponse>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Official responses require rfi:respond permission
    if (isOfficial) {
      const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.RFI_RESPOND);
      if (!perm.allowed) return { error: perm.error };
    } else {
      // Non-official comments just require membership
      const access = await checkProjectMembership(supabase, user.id, projectId);
      if (!access.isMember) return { error: access.error };
    }

    const { data: response, error } = await supabase
      .from('rfi_responses')
      .insert({
        rfi_id: rfiId,
        author_id: user.id,
        content,
        is_official_response: isOfficial,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // If this is an official response, also update the RFI status to 'answered'
    // and set the answer field
    if (isOfficial) {
      await supabase
        .from('rfis')
        .update({
          status: 'answered' as RFIStatus,
          answer: content,
          response_date: new Date().toISOString(),
        })
        .eq('id', rfiId)
        .eq('project_id', projectId);
    }

    // Fetch the RFI number for the activity log description
    const { data: rfi } = await supabase
      .from('rfis')
      .select('number')
      .eq('id', rfiId)
      .single();

    await logActivity(
      supabase,
      projectId,
      'rfi',
      rfiId,
      'commented',
      `${isOfficial ? 'officially ' : ''}responded to ${rfi?.number ?? rfiId}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/rfis`);
    revalidatePath(`/projects/${projectId}/rfis/${rfiId}`);

    return { success: true, data: response as RFIResponse };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add RFI response' };
  }
}
