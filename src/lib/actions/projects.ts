// src/lib/actions/projects.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { Project } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getProjects -- all projects the current user is a member of
// ---------------------------------------------------------------------------
export async function getProjects(): Promise<ActionResult<Project[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Check if user is an admin (admins can see all projects)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    let query = supabase.from('projects').select('*');

    if (profile?.role !== 'admin') {
      // Get project IDs where the user is a member
      const { data: memberships, error: memberError } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('profile_id', user.id);

      if (memberError) return { error: memberError.message };

      const projectIds = memberships?.map((m) => m.project_id) ?? [];
      if (projectIds.length === 0) return { success: true, data: [] };

      query = query.in('id', projectIds);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as Project[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch projects' };
  }
}

// ---------------------------------------------------------------------------
// getProjectById -- single project (must be a member or admin)
// ---------------------------------------------------------------------------
export async function getProjectById(projectId: string): Promise<ActionResult<Project>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Verify membership
    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'Project not found' };

    return { success: true, data: data as Project };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch project' };
  }
}

// ---------------------------------------------------------------------------
// createProject -- requires admin or manager org role
// ---------------------------------------------------------------------------
export async function createProject(data: {
  name: string;
  description: string;
  location: string;
  client: string;
  start_date: string;
  target_end_date: string;
  budget_total: number;
}): Promise<ActionResult<Project>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Only admin or manager org role can create projects
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return { error: 'Profile not found' };

    if (!['admin', 'manager'].includes(profile.role)) {
      return { error: 'Permission denied: only admins and managers can create projects' };
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        name: data.name,
        description: data.description,
        location: data.location,
        client: data.client,
        start_date: data.start_date,
        target_end_date: data.target_end_date,
        budget_total: data.budget_total,
        budget_spent: 0,
        status: 'active',
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // Auto-add the creator as a project manager
    await supabase.from('project_members').insert({
      project_id: project.id,
      profile_id: user.id,
      project_role: 'manager',
      can_edit: true,
    });

    await logActivity(
      supabase,
      project.id,
      'project',
      project.id,
      'created',
      `created project: ${project.name}`,
      user.id
    );

    revalidatePath('/dashboard');
    revalidatePath('/projects');

    return { success: true, data: project as Project };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create project' };
  }
}

// ---------------------------------------------------------------------------
// updateProject -- requires project:edit permission
// ---------------------------------------------------------------------------
export async function updateProject(
  projectId: string,
  data: {
    name?: string;
    description?: string;
    location?: string;
    client?: string;
    start_date?: string;
    target_end_date?: string;
    budget_total?: number;
  }
): Promise<ActionResult<Project>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.PROJECT_EDIT);
    if (!perm.allowed) return { error: perm.error };

    const { data: project, error } = await supabase
      .from('projects')
      .update(data)
      .eq('id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'updated',
      `updated project details`,
      user.id
    );

    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/dashboard');

    return { success: true, data: project as Project };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update project' };
  }
}

// ---------------------------------------------------------------------------
// updateProjectStatus -- requires project:edit permission
// ---------------------------------------------------------------------------
export async function updateProjectStatus(
  projectId: string,
  status: 'active' | 'on_hold' | 'completed' | 'archived'
): Promise<ActionResult<Project>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.PROJECT_EDIT);
    if (!perm.allowed) return { error: perm.error };

    const updateData: Record<string, unknown> = { status };
    if (status === 'completed') {
      updateData.actual_end_date = new Date().toISOString().split('T')[0];
    }

    const { data: project, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', projectId)
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'status_changed',
      `project marked as ${status.replace('_', ' ')}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}`);
    revalidatePath('/dashboard');

    return { success: true, data: project as Project };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update project status' };
  }
}

// ---------------------------------------------------------------------------
// deleteProject -- requires admin org role; cascading handled by DB
// ---------------------------------------------------------------------------
export async function deleteProject(projectId: string): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Only admins can delete projects
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) return { error: 'Profile not found' };
    if (profile.role !== 'admin') {
      return { error: 'Permission denied: only admins can delete projects' };
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) return { error: error.message };

    revalidatePath('/dashboard');
    revalidatePath('/projects');

    return { success: true, data: undefined };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete project' };
  }
}
