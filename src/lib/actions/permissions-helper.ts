// src/lib/actions/permissions-helper.ts
'use server';

import { type SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { canPerform, type Action } from '@/lib/permissions';
import type { ProjectMember, Profile } from '@/lib/types';

export type ActionResult<T = undefined> =
  | { error: string; success?: never; data?: never }
  | { success: true; error?: never; data: T };

/**
 * Get the authenticated user or return an error.
 * Does NOT redirect -- returns { error } so server actions can return it to the client.
 */
export async function getAuthenticatedUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error: 'Not authenticated' };
  }

  return { user, error: null };
}

/**
 * Check whether the current user has permission to perform the given action
 * within the specified project. Returns the user's org role and project role
 * for downstream use, or an error if the permission check fails.
 */
export async function checkPermission(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  action: Action
): Promise<
  | { allowed: false; error: string; orgRole?: never; projectRole?: never }
  | {
      allowed: true;
      error?: never;
      orgRole: Profile['role'];
      projectRole: ProjectMember['project_role'] | null;
    }
> {
  // Get the user's org-level role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    return { allowed: false, error: 'Profile not found' };
  }

  // Get the user's project-level membership
  const { data: membership } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('profile_id', userId)
    .single();

  const orgRole = (profile.role ?? 'viewer') as Profile['role'];
  const projectRole = (membership?.project_role ?? null) as ProjectMember['project_role'] | null;

  // Admins bypass project-level permission checks
  if (orgRole === 'admin') {
    return { allowed: true, orgRole, projectRole };
  }

  if (!canPerform(projectRole, action)) {
    return { allowed: false, error: 'Permission denied' };
  }

  return { allowed: true, orgRole, projectRole };
}

/**
 * Verify the user is a member of the given project (read access).
 * Returns the membership record or an error.
 */
export async function checkProjectMembership(
  supabase: SupabaseClient,
  userId: string,
  projectId: string
): Promise<
  | { isMember: false; error: string }
  | { isMember: true; error?: never; membership: { project_role: string } }
> {
  const { data: membership, error } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('profile_id', userId)
    .single();

  if (error || !membership) {
    // Also allow admins who may not be explicit members
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role === 'admin') {
      return { isMember: true, membership: { project_role: 'manager' } };
    }

    return { isMember: false, error: 'Not a member of this project' };
  }

  return { isMember: true, membership };
}

/**
 * Log an activity to the activity_log table.
 */
export async function logActivity(
  supabase: SupabaseClient,
  projectId: string,
  entityType: 'submittal' | 'rfi' | 'daily_log' | 'punch_list' | 'milestone' | 'project',
  entityId: string,
  action: 'created' | 'updated' | 'status_changed' | 'commented' | 'approved' | 'rejected' | 'submitted' | 'assigned',
  description: string,
  performedBy: string
) {
  await supabase.from('activity_log').insert({
    project_id: projectId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    description,
    performed_by: performedBy,
  });
}
