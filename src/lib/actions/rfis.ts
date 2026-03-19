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
import { sendNotificationToUser, getProjectName } from '@/lib/notifications';

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

    // Fetch the RFI (without attachments join — no FK exists)
    const { data, error } = await supabase
      .from('rfis')
      .select(`
        *,
        submitted_by_profile:profiles!rfis_submitted_by_fkey(id, full_name, email, avatar_url),
        assigned_to_profile:profiles!rfis_assigned_to_fkey(id, full_name, email, avatar_url),
        responses:rfi_responses(
          *,
          author:profiles!rfi_responses_author_id_fkey(id, full_name, email, avatar_url)
        )
      `)
      .eq('id', rfiId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'RFI not found' };

    // Fetch attachments separately using entity_id
    const { data: attachments } = await supabase
      .from('attachments')
      .select('*')
      .eq('entity_type', 'rfi')
      .eq('entity_id', rfiId)
      .order('created_at', { ascending: true });

    // Fetch linked milestone name if present
    let milestone: { id: string; name: string } | null = null;
    if (data.milestone_id) {
      const { data: ms } = await supabase
        .from('milestones')
        .select('id, name')
        .eq('id', data.milestone_id)
        .single();
      milestone = ms ?? null;
    }

    return { success: true, data: { ...data, attachments: attachments ?? [], milestone } as RFI };
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

    // Notify the assignee about the new RFI (fire-and-forget)
    try {
      if (data.assigned_to && data.assigned_to !== user.id) {
        const projectName = await getProjectName(projectId);
        const { data: submitterProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        sendNotificationToUser(data.assigned_to, (recipient) => ({
          type: 'rfi_assigned',
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          rfiNumber: number,
          rfiSubject: data.subject,
          rfiQuestion: data.question,
          priority: data.priority,
          dueDate: data.due_date,
          submitterName: submitterProfile?.full_name ?? 'A team member',
          projectName,
          projectId,
          rfiId: rfi.id,
        }));
      }
    } catch (notifErr) {
      console.error('[rfis] Notification error (non-blocking):', notifErr);
    }

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

    // Notify the RFI submitter about the response (fire-and-forget)
    try {
      // Get full RFI details for the notification
      const { data: fullRfi } = await supabase
        .from('rfis')
        .select('submitted_by, number, subject')
        .eq('id', rfiId)
        .single();

      if (fullRfi?.submitted_by && fullRfi.submitted_by !== user.id) {
        const projectName = await getProjectName(projectId);
        const { data: responderProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        sendNotificationToUser(fullRfi.submitted_by, (recipient) => ({
          type: 'rfi_response_received',
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          rfiNumber: fullRfi.number,
          rfiSubject: fullRfi.subject,
          responseContent: content,
          isOfficial,
          responderName: responderProfile?.full_name ?? 'A team member',
          projectName,
          projectId,
          rfiId,
        }));
      }
    } catch (notifErr) {
      console.error('[rfis] Notification error (non-blocking):', notifErr);
    }

    revalidatePath(`/projects/${projectId}/rfis`);
    revalidatePath(`/projects/${projectId}/rfis/${rfiId}`);

    return { success: true, data: response as RFIResponse };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add RFI response' };
  }
}

// ---------------------------------------------------------------------------
// updateRFI -- edit RFI fields, requires rfi:create
// ---------------------------------------------------------------------------
export async function updateRFI(
  projectId: string,
  rfiId: string,
  data: {
    subject?: string;
    question?: string;
    priority?: Priority;
    assigned_to?: string;
    due_date?: string;
  }
): Promise<ActionResult<RFI>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.RFI_CREATE);
    if (!perm.allowed) return { error: perm.error };

    const { data: rfi, error } = await supabase
      .from('rfis')
      .update(data)
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
      'updated',
      `updated ${rfi.number}: ${rfi.subject}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/rfis`);
    revalidatePath(`/projects/${projectId}/rfis/${rfiId}`);

    return { success: true, data: rfi as RFI };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update RFI' };
  }
}

// ---------------------------------------------------------------------------
// deleteRFI -- deletes RFI + responses + storage attachments, requires rfi:create
// ---------------------------------------------------------------------------
export async function deleteRFI(
  projectId: string,
  rfiId: string
): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.RFI_CREATE);
    if (!perm.allowed) return { error: perm.error };

    // Delete associated attachments from storage
    const { data: files } = await supabase.storage
      .from('project-photos')
      .list(`${projectId}/rfi/${rfiId}`);

    if (files && files.length > 0) {
      const paths = files.map((f) => `${projectId}/rfi/${rfiId}/${f.name}`);
      await supabase.storage.from('project-photos').remove(paths);
    }

    // Delete attachment records
    await supabase
      .from('attachments')
      .delete()
      .eq('entity_type', 'rfi')
      .eq('entity_id', rfiId);

    // Delete RFI responses
    await supabase
      .from('rfi_responses')
      .delete()
      .eq('rfi_id', rfiId);

    // Delete the RFI
    const { error } = await supabase
      .from('rfis')
      .delete()
      .eq('id', rfiId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'rfi',
      rfiId,
      'deleted',
      `deleted RFI`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/rfis`);

    return { success: true, data: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete RFI' };
  }
}
