// src/lib/actions/projects.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACTIONS } from '@/lib/permissions';
import { TIER_LIMITS } from '@/lib/types';
import type { Project, Tier } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';
import { getLocalDateString } from '@/lib/date-utils';

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
// getProjectPlanInfo -- tier and member limit for a project organization
// ---------------------------------------------------------------------------
export async function getProjectPlanInfo(
  projectId: string
): Promise<ActionResult<{ tier: Tier; limit: number }>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) return { error: 'Project not found' };
    if (!project.organization_id) {
      return { error: 'This project is not linked to an organization. Please contact support.' };
    }

    const admin = createAdminClient();
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .select('tier')
      .eq('id', project.organization_id)
      .single();

    if (orgError || !org) return { error: 'Organization plan not found' };

    const tier = org.tier as Tier;
    return { success: true, data: { tier, limit: TIER_LIMITS[tier] } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch project plan' };
  }
}

// ---------------------------------------------------------------------------
// getProjectDemoInfo -- whether this project belongs to an active demo account
// ---------------------------------------------------------------------------
export async function getProjectDemoInfo(
  projectId: string
): Promise<ActionResult<{ isDemoProject: boolean }>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('demo_accounts')
      .select('id')
      .eq('project_id', projectId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) return { error: error.message };

    return { success: true, data: { isDemoProject: Boolean(data) } };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch project demo info' };
  }
}

// ---------------------------------------------------------------------------
// createProject -- any authenticated user can create a project
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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.organization_id) {
      return { error: 'Your profile is not linked to an organization' };
    }

    const { data: project, error } = await supabase.rpc('create_project', {
      p_name: data.name,
      p_description: data.description,
      p_location: data.location,
      p_client: data.client,
      p_start_date: data.start_date,
      p_target_end_date: data.target_end_date,
      p_budget_total: data.budget_total,
    });
    if (error) return { error: error.message };
    if (!project) return { error: 'Failed to create project' };

    let createdProject = project as Project;

    if (!createdProject.organization_id) {
      const admin = createAdminClient();
      const { data: updatedProject, error: updateError } = await admin
        .from('projects')
        .update({ organization_id: profile.organization_id })
        .eq('id', createdProject.id)
        .eq('created_by', user.id)
        .select()
        .single();

      if (updateError || !updatedProject) {
        return {
          error: updateError?.message ?? 'Failed to link project to organization',
        };
      }

      createdProject = updatedProject as Project;
    }

    await logActivity(
      supabase,
      createdProject.id,
      'project',
      createdProject.id,
      'created',
      `created project: ${createdProject.name}`,
      user.id
    );
    revalidatePath('/dashboard');
    revalidatePath('/projects');
    return { success: true, data: createdProject };
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
    turnover_date?: string | null;
    substantial_completion_date?: string | null;
    project_completion_date?: string | null;
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
      updateData.actual_end_date = getLocalDateString();
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
