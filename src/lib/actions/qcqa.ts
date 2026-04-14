// src/lib/actions/qcqa.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { QCQAReport, QCQAReportType, QCQAReportStatus } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getQCQAReports -- all QC/QA reports for a project
// ---------------------------------------------------------------------------
export async function getQCQAReports(
  projectId: string
): Promise<ActionResult<QCQAReport[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('qcqa_reports')
      .select(`
        *,
        inspector_profile:profiles!qcqa_reports_inspector_fkey(id, full_name)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as QCQAReport[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch QC/QA reports' };
  }
}

// ---------------------------------------------------------------------------
// getQCQAReportById -- single report with profile join
// ---------------------------------------------------------------------------
export async function getQCQAReportById(
  reportId: string,
  projectId: string
): Promise<ActionResult<QCQAReport>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('qcqa_reports')
      .select(`
        *,
        inspector_profile:profiles!qcqa_reports_inspector_fkey(id, full_name),
        closed_by_profile:profiles!qcqa_reports_closed_by_fkey(id, full_name)
      `)
      .eq('id', reportId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'QC/QA report not found' };

    return { success: true, data: data as QCQAReport };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch QC/QA report' };
  }
}

// ---------------------------------------------------------------------------
// createQCQAReport -- creates a new QC/QA report
// Auto-generates human-readable number (QC-001, QC-002, ...)
// ---------------------------------------------------------------------------
export async function createQCQAReport(
  projectId: string,
  data: {
    report_type: QCQAReportType;
    title: string;
    description?: string;
    spec_reference?: string;
    location?: string;
    severity?: 'minor' | 'major' | 'critical';
    findings?: string;
    corrective_action?: string;
    is_nonconformance?: boolean;
    linked_punch_list_ids?: string[];
  }
): Promise<ActionResult<QCQAReport>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    // Generate the next human-readable number for this project
    const { count, error: countError } = await supabase
      .from('qcqa_reports')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (countError) return { error: countError.message };

    const nextNum = (count ?? 0) + 1;
    const number = `QC-${String(nextNum).padStart(3, '0')}`;

    const { data: report, error } = await supabase
      .from('qcqa_reports')
      .insert({
        project_id: projectId,
        number,
        report_type: data.report_type,
        title: data.title,
        description: data.description ?? '',
        spec_reference: data.spec_reference ?? '',
        location: data.location ?? '',
        status: 'draft' as QCQAReportStatus,
        findings: data.findings ?? '',
        corrective_action: data.corrective_action ?? '',
        is_nonconformance: data.is_nonconformance ?? false,
        severity: data.severity ?? 'minor',
        inspector: user.id,
        linked_punch_list_ids: data.linked_punch_list_ids ?? [],
        closed_by: null,
        closed_date: null,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as Parameters<typeof logActivity>[2],
      report.id,
      'created',
      `created QC/QA report ${number}: ${data.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/qcqa`);

    return { success: true, data: report as QCQAReport };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create QC/QA report' };
  }
}

// ---------------------------------------------------------------------------
// updateQCQAReport -- update fields on an existing report
// ---------------------------------------------------------------------------
export async function updateQCQAReport(
  projectId: string,
  reportId: string,
  data: {
    report_type?: QCQAReportType;
    title?: string;
    description?: string;
    spec_reference?: string;
    location?: string;
    status?: QCQAReportStatus;
    findings?: string;
    corrective_action?: string;
    is_nonconformance?: boolean;
    severity?: 'minor' | 'major' | 'critical';
    linked_punch_list_ids?: string[];
  }
): Promise<ActionResult<QCQAReport>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    // If closing, set closed_by and closed_date
    const updatePayload: Record<string, unknown> = { ...data };
    if (data.status === 'closed') {
      updatePayload.closed_by = user.id;
      updatePayload.closed_date = new Date().toISOString();
    }

    const { data: report, error } = await supabase
      .from('qcqa_reports')
      .update(updatePayload)
      .eq('id', reportId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    const actionType = data.status ? 'status_changed' : 'updated';
    const description = data.status
      ? `changed QC/QA ${report.number} status to ${data.status}`
      : `updated QC/QA ${report.number}: ${report.title}`;

    await logActivity(
      supabase,
      projectId,
      'project' as Parameters<typeof logActivity>[2],
      reportId,
      actionType,
      description,
      user.id
    );

    revalidatePath(`/projects/${projectId}/qcqa`);
    revalidatePath(`/projects/${projectId}/qcqa/${reportId}`);

    return { success: true, data: report as QCQAReport };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update QC/QA report' };
  }
}

// ---------------------------------------------------------------------------
// deleteQCQAReport -- only the inspector or a manager can delete
// ---------------------------------------------------------------------------
export async function deleteQCQAReport(
  projectId: string,
  reportId: string
): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    // Verify the user is the inspector or a manager
    const { data: existing, error: fetchError } = await supabase
      .from('qcqa_reports')
      .select('inspector, number')
      .eq('id', reportId)
      .eq('project_id', projectId)
      .single();

    if (fetchError || !existing) return { error: 'QC/QA report not found' };

    const isInspector = existing.inspector === user.id;
    const isManager = access.isMember && 'membership' in access && access.membership.project_role === 'manager';

    // Also check org-level admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    if (!isInspector && !isManager && !isAdmin) {
      return { error: 'Only the inspector or a manager can delete this report' };
    }

    // Delete the report
    const { error } = await supabase
      .from('qcqa_reports')
      .delete()
      .eq('id', reportId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as Parameters<typeof logActivity>[2],
      reportId,
      'deleted',
      `deleted QC/QA report ${existing.number}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/qcqa`);

    return { success: true, data: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete QC/QA report' };
  }
}
