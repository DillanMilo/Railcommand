// src/lib/actions/weekly-reports.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { WeeklyReport, WeeklyReportStatus, WeeklyReportType } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';
import { getLocalDateString } from '@/lib/date-utils';

// ---------------------------------------------------------------------------
// getWeeklyReports -- all weekly reports for a project
// ---------------------------------------------------------------------------
export async function getWeeklyReports(projectId: string): Promise<ActionResult<WeeklyReport[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('weekly_reports')
      .select('*, submitted_by_profile:profiles!weekly_reports_submitted_by_fkey(*), approved_by_profile:profiles!weekly_reports_approved_by_fkey(*)')
      .eq('project_id', projectId)
      .order('week_start_date', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as WeeklyReport[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch weekly reports' };
  }
}

// ---------------------------------------------------------------------------
// getWeeklyReportById -- single weekly report with profile joins
// ---------------------------------------------------------------------------
export async function getWeeklyReportById(
  reportId: string,
  projectId: string
): Promise<ActionResult<WeeklyReport>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('weekly_reports')
      .select('*, submitted_by_profile:profiles!weekly_reports_submitted_by_fkey(*), approved_by_profile:profiles!weekly_reports_approved_by_fkey(*)')
      .eq('id', reportId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };

    return { success: true, data: data as WeeklyReport };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch weekly report' };
  }
}

// ---------------------------------------------------------------------------
// createWeeklyReport -- requires weekly_report:create
// ---------------------------------------------------------------------------
export async function createWeeklyReport(
  projectId: string,
  data: {
    report_type: WeeklyReportType;
    week_start_date: string;
    week_end_date: string;
    title: string;
    work_summary: string;
    safety_summary: string;
    schedule_summary: string;
    issues_concerns: string;
    upcoming_work: string;
    weather_summary: string;
    manpower_total: number;
    equipment_hours: number;
  }
): Promise<ActionResult<WeeklyReport>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.WEEKLY_REPORT_CREATE);
    if (!perm.allowed) return { error: perm.error };

    // Auto-number: count existing weekly reports for this project
    const { count } = await supabase
      .from('weekly_reports')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const number = `WR-${String((count ?? 0) + 1).padStart(3, '0')}`;

    const { data: report, error } = await supabase
      .from('weekly_reports')
      .insert({
        project_id: projectId,
        number,
        report_type: data.report_type,
        week_start_date: data.week_start_date,
        week_end_date: data.week_end_date,
        title: data.title,
        status: 'draft',
        work_summary: data.work_summary,
        safety_summary: data.safety_summary,
        schedule_summary: data.schedule_summary,
        issues_concerns: data.issues_concerns,
        upcoming_work: data.upcoming_work,
        weather_summary: data.weather_summary,
        manpower_total: data.manpower_total,
        equipment_hours: data.equipment_hours,
        submitted_by: user.id,
        submit_date: getLocalDateString(),
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as const,
      report.id,
      'created',
      `created weekly report ${number}: ${data.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/weekly-reports`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: report as WeeklyReport };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create weekly report' };
  }
}

// ---------------------------------------------------------------------------
// updateWeeklyReport -- requires weekly_report:create
// ---------------------------------------------------------------------------
export async function updateWeeklyReport(
  projectId: string,
  reportId: string,
  data: {
    report_type?: WeeklyReportType;
    week_start_date?: string;
    week_end_date?: string;
    title?: string;
    status?: WeeklyReportStatus;
    work_summary?: string;
    safety_summary?: string;
    schedule_summary?: string;
    issues_concerns?: string;
    upcoming_work?: string;
    weather_summary?: string;
    manpower_total?: number;
    equipment_hours?: number;
  }
): Promise<ActionResult<WeeklyReport>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.WEEKLY_REPORT_CREATE);
    if (!perm.allowed) return { error: perm.error };

    // If status changes to 'approved', auto-set approval fields
    const updateData: Record<string, unknown> = { ...data };
    if (data.status === 'approved') {
      updateData.approval_date = getLocalDateString();
      updateData.approved_by = user.id;
    }

    const { data: report, error } = await supabase
      .from('weekly_reports')
      .update(updateData)
      .eq('id', reportId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    const actionType = data.status ? 'status_changed' : 'updated';
    const description = data.status
      ? `changed weekly report "${report.title}" status to ${data.status}`
      : `updated weekly report: ${report.title}`;

    await logActivity(
      supabase,
      projectId,
      'project' as const,
      reportId,
      actionType,
      description,
      user.id
    );

    revalidatePath(`/projects/${projectId}/weekly-reports`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: report as WeeklyReport };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update weekly report' };
  }
}

// ---------------------------------------------------------------------------
// deleteWeeklyReport -- requires weekly_report:create
// ---------------------------------------------------------------------------
export async function deleteWeeklyReport(
  projectId: string,
  reportId: string
): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.WEEKLY_REPORT_CREATE);
    if (!perm.allowed) return { error: perm.error };

    const { error } = await supabase
      .from('weekly_reports')
      .delete()
      .eq('id', reportId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project' as const,
      reportId,
      'deleted',
      `deleted weekly report`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/weekly-reports`);
    revalidatePath(`/projects/${projectId}`);

    return { success: true, data: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete weekly report' };
  }
}
