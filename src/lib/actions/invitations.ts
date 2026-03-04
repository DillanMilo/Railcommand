// src/lib/actions/invitations.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ACTIONS } from '@/lib/permissions';
import { TIER_LIMITS } from '@/lib/types';
import type { ProjectInvitation, ProjectMember, Tier } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
  checkPermission,
  checkProjectMembership,
  logActivity,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// createInvitation -- invite someone by email to a project
// ---------------------------------------------------------------------------
export async function createInvitation(
  projectId: string,
  email: string,
  projectRole: ProjectMember['project_role']
): Promise<ActionResult<ProjectInvitation>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.TEAM_MANAGE);
    if (!perm.allowed) return { error: perm.error };

    // Get project + org for tier check
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id, name, organization_id')
      .eq('id', projectId)
      .single();

    if (projError || !project) return { error: 'Project not found' };

    const { data: org } = await supabase
      .from('organizations')
      .select('tier')
      .eq('id', project.organization_id)
      .single();

    const tier = (org?.tier ?? 'free') as Tier;
    const limit = TIER_LIMITS[tier];

    // Count existing members + pending invitations
    const { count: memberCount } = await supabase
      .from('project_members')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const { count: pendingCount } = await supabase
      .from('project_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', 'pending');

    const total = (memberCount ?? 0) + (pendingCount ?? 0);
    if (total >= limit) {
      return {
        error: `Your ${tier} plan allows up to ${limit} members per project. Upgrade to add more.`,
      };
    }

    // Check if email is already a member
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id, profile:profiles!project_members_profile_id_fkey(email)')
      .eq('project_id', projectId);

    const alreadyMember = existingMember?.some(
      (m) => (m.profile as unknown as { email: string })?.email === email
    );
    if (alreadyMember) {
      return { error: 'This person is already a member of this project' };
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('project_invitations')
      .select('id')
      .eq('project_id', projectId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return { error: 'An invitation has already been sent to this email' };
    }

    // Create the invitation record
    const { data: invitation, error: insertError } = await supabase
      .from('project_invitations')
      .insert({
        project_id: projectId,
        email,
        project_role: projectRole,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError || !invitation) {
      return { error: insertError?.message ?? 'Failed to create invitation' };
    }

    // Check if user exists in auth and send email if they're new
    const adminClient = createAdminClient();
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!existingProfile) {
      // User doesn't exist — send Supabase auth invite email
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      try {
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { invite_token: invitation.token },
          redirectTo: `${siteUrl}/auth/callback?next=/invite/${invitation.token}`,
        });
      } catch {
        // Invitation record still created — user can be re-invited if email fails
      }
    }

    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'assigned',
      `invited ${email} as ${projectRole}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/team`);

    return { success: true, data: invitation as ProjectInvitation };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to create invitation',
    };
  }
}

// ---------------------------------------------------------------------------
// acceptInvitation -- accept a project invitation by token
// ---------------------------------------------------------------------------
export async function acceptInvitation(
  token: string
): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Find the invitation
    const { data: invitation, error: findError } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('token', token)
      .eq('email', user.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (findError || !invitation) {
      return { error: 'Invitation not found, expired, or already used.' };
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('project_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    if (updateError) return { error: updateError.message };

    // Add user as a project member
    const { error: memberError } = await supabase
      .from('project_members')
      .insert({
        project_id: invitation.project_id,
        profile_id: user.id,
        project_role: invitation.project_role,
        can_edit: ['manager', 'superintendent', 'foreman', 'engineer'].includes(
          invitation.project_role
        ),
      });

    if (memberError) return { error: memberError.message };

    await logActivity(
      supabase,
      invitation.project_id,
      'project',
      invitation.project_id,
      'assigned',
      `accepted invitation as ${invitation.project_role}`,
      user.id
    );

    revalidatePath('/dashboard');
    revalidatePath(`/projects/${invitation.project_id}/team`);

    return { success: true, data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to accept invitation',
    };
  }
}

// ---------------------------------------------------------------------------
// declineInvitation -- decline a project invitation by token
// ---------------------------------------------------------------------------
export async function declineInvitation(
  token: string
): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data: invitation, error: findError } = await supabase
      .from('project_invitations')
      .select('id')
      .eq('token', token)
      .eq('email', user.email)
      .eq('status', 'pending')
      .single();

    if (findError || !invitation) {
      return { error: 'Invitation not found or already handled.' };
    }

    const { error: updateError } = await supabase
      .from('project_invitations')
      .update({ status: 'declined' })
      .eq('id', invitation.id);

    if (updateError) return { error: updateError.message };

    revalidatePath('/dashboard');

    return { success: true, data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to decline invitation',
    };
  }
}

// ---------------------------------------------------------------------------
// getPendingInvitationsForUser -- all pending invitations for current user
// ---------------------------------------------------------------------------
export async function getPendingInvitationsForUser(): Promise<
  ActionResult<ProjectInvitation[]>
> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data, error } = await supabase
      .from('project_invitations')
      .select(`
        *,
        project:projects(id, name),
        invited_by_profile:profiles!project_invitations_invited_by_fkey(id, full_name)
      `)
      .eq('email', user.email)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as ProjectInvitation[]) ?? [] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch invitations',
    };
  }
}

// ---------------------------------------------------------------------------
// getProjectInvitations -- all invitations for a project (team page)
// ---------------------------------------------------------------------------
export async function getProjectInvitations(
  projectId: string
): Promise<ActionResult<ProjectInvitation[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const access = await checkProjectMembership(supabase, user.id, projectId);
    if (!access.isMember) return { error: access.error };

    const { data, error } = await supabase
      .from('project_invitations')
      .select(`
        *,
        invited_by_profile:profiles!project_invitations_invited_by_fkey(id, full_name)
      `)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };

    return { success: true, data: (data as ProjectInvitation[]) ?? [] };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch project invitations',
    };
  }
}

// ---------------------------------------------------------------------------
// cancelInvitation -- cancel a pending invitation (manager only)
// ---------------------------------------------------------------------------
export async function cancelInvitation(
  invitationId: string,
  projectId: string
): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.TEAM_MANAGE);
    if (!perm.allowed) return { error: perm.error };

    const { error } = await supabase
      .from('project_invitations')
      .update({ status: 'expired' })
      .eq('id', invitationId)
      .eq('project_id', projectId)
      .eq('status', 'pending');

    if (error) return { error: error.message };

    revalidatePath(`/projects/${projectId}/team`);

    return { success: true, data: undefined };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to cancel invitation',
    };
  }
}
