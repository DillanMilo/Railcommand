// src/lib/actions/safety.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { SafetyIncident, IncidentType, IncidentSeverity, IncidentStatus } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getSafetyIncidents -- all safety incidents for a project
// ---------------------------------------------------------------------------
export async function getSafetyIncidents(
  projectId: string
): Promise<ActionResult<SafetyIncident[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('safety_incidents')
      .select(`
        *,
        reported_by_profile:profiles!safety_incidents_reported_by_fkey(id, full_name)
      `)
      .eq('project_id', projectId)
      .order('incident_date', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as SafetyIncident[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch safety incidents' };
  }
}

// ---------------------------------------------------------------------------
// getSafetyIncident -- single incident with profile join + attachments
// ---------------------------------------------------------------------------
export async function getSafetyIncident(
  incidentId: string,
  projectId: string
): Promise<ActionResult<SafetyIncident>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('safety_incidents')
      .select(`
        *,
        reported_by_profile:profiles!safety_incidents_reported_by_fkey(id, full_name)
      `)
      .eq('id', incidentId)
      .eq('project_id', projectId)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'Safety incident not found' };

    // Fetch attachments separately using entity_id
    const { data: attachments } = await supabase
      .from('attachments')
      .select('*')
      .eq('entity_type', 'safety_incident')
      .eq('entity_id', incidentId)
      .order('created_at', { ascending: true });

    return {
      success: true,
      data: { ...data, attachments: attachments ?? [] } as SafetyIncident,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch safety incident' };
  }
}

// ---------------------------------------------------------------------------
// createSafetyIncident -- creates a new incident
// Auto-generates human-readable number (SAF-001, SAF-002, ...)
// ---------------------------------------------------------------------------
export async function createSafetyIncident(
  projectId: string,
  data: {
    title: string;
    incident_type: IncidentType;
    severity: IncidentSeverity;
    description?: string;
    location?: string;
    personnel_involved?: string;
    incident_date?: string;
    daily_log_id?: string | null;
  }
): Promise<ActionResult<SafetyIncident>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    // Generate the next human-readable number for this project
    const { count, error: countError } = await supabase
      .from('safety_incidents')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    if (countError) return { error: countError.message };

    const nextNum = (count ?? 0) + 1;
    const number = `SAF-${String(nextNum).padStart(3, '0')}`;

    const { data: incident, error } = await supabase
      .from('safety_incidents')
      .insert({
        project_id: projectId,
        number,
        reported_by: user.id,
        incident_date: data.incident_date ?? new Date().toISOString().split('T')[0],
        title: data.title,
        description: data.description ?? '',
        incident_type: data.incident_type,
        severity: data.severity,
        status: 'open' as IncidentStatus,
        location: data.location ?? '',
        personnel_involved: data.personnel_involved ?? '',
        root_cause: '',
        corrective_action: '',
        daily_log_id: data.daily_log_id ?? null,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'safety_incident' as Parameters<typeof logActivity>[2],
      incident.id,
      'created',
      `reported ${number}: ${data.title}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/safety`);

    return { success: true, data: incident as SafetyIncident };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create safety incident' };
  }
}

// ---------------------------------------------------------------------------
// updateSafetyIncident -- update fields on an existing incident
// ---------------------------------------------------------------------------
export async function updateSafetyIncident(
  incidentId: string,
  projectId: string,
  data: {
    title?: string;
    description?: string;
    incident_type?: IncidentType;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    location?: string;
    personnel_involved?: string;
    incident_date?: string;
    root_cause?: string;
    corrective_action?: string;
    daily_log_id?: string | null;
  }
): Promise<ActionResult<SafetyIncident>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data: incident, error } = await supabase
      .from('safety_incidents')
      .update(data)
      .eq('id', incidentId)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    const actionType = data.status ? 'status_changed' : 'updated';
    const description = data.status
      ? `changed ${incident.number} status to ${data.status}`
      : `updated ${incident.number}: ${incident.title}`;

    await logActivity(
      supabase,
      projectId,
      'safety_incident' as Parameters<typeof logActivity>[2],
      incidentId,
      actionType,
      description,
      user.id
    );

    revalidatePath(`/projects/${projectId}/safety`);
    revalidatePath(`/projects/${projectId}/safety/${incidentId}`);

    return { success: true, data: incident as SafetyIncident };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update safety incident' };
  }
}

// ---------------------------------------------------------------------------
// deleteSafetyIncident -- only the reporter or a manager can delete
// ---------------------------------------------------------------------------
export async function deleteSafetyIncident(
  incidentId: string,
  projectId: string
): Promise<ActionResult<null>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    // Verify the user is the reporter or a manager
    const { data: existing, error: fetchError } = await supabase
      .from('safety_incidents')
      .select('reported_by')
      .eq('id', incidentId)
      .eq('project_id', projectId)
      .single();

    if (fetchError || !existing) return { error: 'Safety incident not found' };

    const isReporter = existing.reported_by === user.id;
    const isManager = access.isMember && 'membership' in access && access.membership.project_role === 'manager';

    // Also check org-level admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    if (!isReporter && !isManager && !isAdmin) {
      return { error: 'Only the reporter or a manager can delete this incident' };
    }

    // Delete associated attachments from storage
    const { data: files } = await supabase.storage
      .from('project-photos')
      .list(`${projectId}/safety_incident/${incidentId}`);

    if (files && files.length > 0) {
      const paths = files.map((f) => `${projectId}/safety_incident/${incidentId}/${f.name}`);
      await supabase.storage.from('project-photos').remove(paths);
    }

    // Delete attachment records
    await supabase
      .from('attachments')
      .delete()
      .eq('entity_type', 'safety_incident')
      .eq('entity_id', incidentId);

    // Delete the incident
    const { error } = await supabase
      .from('safety_incidents')
      .delete()
      .eq('id', incidentId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'safety_incident' as Parameters<typeof logActivity>[2],
      incidentId,
      'deleted',
      `deleted safety incident`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/safety`);

    return { success: true, data: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete safety incident' };
  }
}
