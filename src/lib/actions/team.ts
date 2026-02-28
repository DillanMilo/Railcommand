// src/lib/actions/team.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import type { ProjectMember } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// getProjectMembers -- all members of a project, with profiles and orgs
// ---------------------------------------------------------------------------
export async function getProjectMembers(
  projectId: string
): Promise<ActionResult<ProjectMember[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        profile:profiles(
          id,
          full_name,
          email,
          phone,
          role,
          avatar_url,
          organization:organizations(id, name, type)
        )
      `)
      .eq('project_id', projectId)
      .order('added_at', { ascending: true });

    if (error) return { error: error.message };

    return { success: true, data: (data as ProjectMember[]) ?? [] };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch project members' };
  }
}

// ---------------------------------------------------------------------------
// addProjectMember -- requires team:manage
// ---------------------------------------------------------------------------
export async function addProjectMember(
  projectId: string,
  profileId: string,
  role: ProjectMember['project_role']
): Promise<ActionResult<ProjectMember>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.TEAM_MANAGE);
    if (!perm.allowed) return { error: perm.error };

    // Check if the member already exists on the project
    const { data: existing } = await supabase
      .from('project_members')
      .select('id')
      .eq('project_id', projectId)
      .eq('profile_id', profileId)
      .single();

    if (existing) {
      return { error: 'This user is already a member of this project' };
    }

    // Verify that the target profile exists
    const { data: targetProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', profileId)
      .single();

    if (profileError || !targetProfile) {
      return { error: 'User profile not found' };
    }

    const { data: member, error } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        profile_id: profileId,
        project_role: role,
        can_edit: ['manager', 'superintendent', 'foreman', 'engineer'].includes(role),
      })
      .select()
      .single();

    if (error) return { error: error.message };

    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'assigned',
      `added ${targetProfile.full_name} as ${role}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/team`);

    return { success: true, data: member as ProjectMember };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to add project member' };
  }
}

// ---------------------------------------------------------------------------
// removeProjectMember -- requires team:manage
// ---------------------------------------------------------------------------
export async function removeProjectMember(
  projectId: string,
  memberId: string
): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.TEAM_MANAGE);
    if (!perm.allowed) return { error: perm.error };

    // Get the member info for activity log before deleting
    const { data: memberInfo } = await supabase
      .from('project_members')
      .select(`
        profile_id,
        project_role,
        profile:profiles(full_name)
      `)
      .eq('id', memberId)
      .eq('project_id', projectId)
      .single();

    if (!memberInfo) {
      return { error: 'Member not found on this project' };
    }

    // Prevent removing yourself
    if (memberInfo.profile_id === user.id) {
      return { error: 'You cannot remove yourself from the project' };
    }

    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('id', memberId)
      .eq('project_id', projectId);

    if (error) return { error: error.message };

    const profileData = memberInfo.profile as unknown as { full_name: string } | null;
    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'updated',
      `removed ${profileData?.full_name ?? 'member'} from the project`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/team`);

    return { success: true, data: undefined };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to remove project member' };
  }
}

// ---------------------------------------------------------------------------
// updateMemberRole -- requires team:manage
// ---------------------------------------------------------------------------
export async function updateMemberRole(
  projectId: string,
  memberId: string,
  role: ProjectMember['project_role']
): Promise<ActionResult<ProjectMember>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.TEAM_MANAGE);
    if (!perm.allowed) return { error: perm.error };

    const { data: member, error } = await supabase
      .from('project_members')
      .update({
        project_role: role,
        can_edit: ['manager', 'superintendent', 'foreman', 'engineer'].includes(role),
      })
      .eq('id', memberId)
      .eq('project_id', projectId)
      .select(`
        *,
        profile:profiles(full_name)
      `)
      .single();

    if (error) return { error: error.message };

    const profileData = member.profile as unknown as { full_name: string } | null;
    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'updated',
      `changed ${profileData?.full_name ?? 'member'} role to ${role}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/team`);

    return { success: true, data: member as ProjectMember };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update member role' };
  }
}
