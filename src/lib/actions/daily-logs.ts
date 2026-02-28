// src/lib/actions/daily-logs.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { DailyLog, GeoTag } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getDailyLogs -- all daily logs for a project
// ---------------------------------------------------------------------------
export async function getDailyLogs(projectId: string): Promise<ActionResult<DailyLog[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('daily_logs')
      .select(`
        *,
        created_by_profile:profiles!daily_logs_created_by_fkey(id, full_name, email, avatar_url)
      `)
      .eq('project_id', projectId)
      .order('log_date', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as DailyLog[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch daily logs' };
  }
}

// ---------------------------------------------------------------------------
// getDailyLogById -- single log with nested personnel, equipment, work_items
// ---------------------------------------------------------------------------
export async function getDailyLogById(
  projectId: string,
  logId: string
): Promise<ActionResult<DailyLog>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('daily_logs')
      .select(`
        *,
        created_by_profile:profiles!daily_logs_created_by_fkey(id, full_name, email, avatar_url),
        personnel:daily_log_personnel(*),
        equipment:daily_log_equipment(*),
        work_items:daily_log_work_items(*),
        attachments(*)
      `)
      .eq('id', logId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'Daily log not found' };

    return { success: true, data: data as DailyLog };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch daily log' };
  }
}

// ---------------------------------------------------------------------------
// createDailyLog -- requires daily_log:create
// Handles nested inserts for personnel, equipment, and work_items
// ---------------------------------------------------------------------------
export async function createDailyLog(
  projectId: string,
  data: {
    log_date: string;
    weather_temp: number;
    weather_conditions: string;
    weather_wind: string;
    work_summary: string;
    safety_notes: string;
    geo_tag?: GeoTag | null;
    personnel: { role: string; headcount: number; company: string }[];
    equipment: { equipment_type: string; count: number; notes: string }[];
    work_items: { description: string; quantity: number; unit: string; location: string }[];
  }
): Promise<ActionResult<DailyLog>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.DAILY_LOG_CREATE);
    if (!perm.allowed) return { error: perm.error };

    // Insert the daily log
    const { data: log, error: logError } = await supabase
      .from('daily_logs')
      .insert({
        project_id: projectId,
        log_date: data.log_date,
        created_by: user.id,
        weather_temp: data.weather_temp,
        weather_conditions: data.weather_conditions,
        weather_wind: data.weather_wind,
        work_summary: data.work_summary,
        safety_notes: data.safety_notes,
        geo_tag: data.geo_tag ?? null,
      })
      .select()
      .single();

    if (logError) return { error: logError.message };

    // Insert nested personnel rows (filter out empty entries)
    const validPersonnel = data.personnel.filter((p) => p.role.trim() !== '');
    if (validPersonnel.length > 0) {
      const { error: personnelError } = await supabase
        .from('daily_log_personnel')
        .insert(
          validPersonnel.map((p) => ({
            daily_log_id: log.id,
            role: p.role,
            headcount: p.headcount,
            company: p.company,
          }))
        );

      if (personnelError) {
        console.error('Failed to insert personnel:', personnelError.message);
      }
    }

    // Insert nested equipment rows
    const validEquipment = data.equipment.filter((e) => e.equipment_type.trim() !== '');
    if (validEquipment.length > 0) {
      const { error: equipmentError } = await supabase
        .from('daily_log_equipment')
        .insert(
          validEquipment.map((e) => ({
            daily_log_id: log.id,
            equipment_type: e.equipment_type,
            count: e.count,
            notes: e.notes,
          }))
        );

      if (equipmentError) {
        console.error('Failed to insert equipment:', equipmentError.message);
      }
    }

    // Insert nested work items
    const validWorkItems = data.work_items.filter((w) => w.description.trim() !== '');
    if (validWorkItems.length > 0) {
      const { error: workItemsError } = await supabase
        .from('daily_log_work_items')
        .insert(
          validWorkItems.map((w) => ({
            daily_log_id: log.id,
            description: w.description,
            quantity: w.quantity,
            unit: w.unit,
            location: w.location,
          }))
        );

      if (workItemsError) {
        console.error('Failed to insert work items:', workItemsError.message);
      }
    }

    await logActivity(
      supabase,
      projectId,
      'daily_log',
      log.id,
      'created',
      `created daily log for ${data.log_date}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/daily-logs`);

    // Re-fetch the complete log with nested data for the response
    const { data: fullLog, error: fetchError } = await supabase
      .from('daily_logs')
      .select(`
        *,
        created_by_profile:profiles!daily_logs_created_by_fkey(id, full_name, email, avatar_url),
        personnel:daily_log_personnel(*),
        equipment:daily_log_equipment(*),
        work_items:daily_log_work_items(*)
      `)
      .eq('id', log.id)
      .single();

    if (fetchError) {
      // Return the base log even if the re-fetch fails
      return { success: true, data: log as DailyLog };
    }

    return { success: true, data: fullLog as DailyLog };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create daily log' };
  }
}
