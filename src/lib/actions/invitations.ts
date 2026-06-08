// src/lib/actions/invitations.ts
'use server';

import { revalidatePath } from 'next/cache';
import { Resend } from 'resend';
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

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? 'RailCommand <noreply@railcommand.io>';

let resendClient: Resend | null = null;

function getSiteUrl(): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';
  return siteUrl.replace(/\/$/, '');
}

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatRole(role: string): string {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildInvitationEmailHtml(input: {
  inviteUrl: string;
  projectName: string;
  projectRole: string;
  invitedByName: string;
}): string {
  const projectName = escapeHtml(input.projectName);
  const invitedByName = escapeHtml(input.invitedByName);
  const projectRole = escapeHtml(formatRole(input.projectRole));
  const inviteUrl = escapeHtml(input.inviteUrl);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RailCommand Project Invitation</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#1e293b;padding:20px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">RailCommand</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;">Project Invitation</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
                ${invitedByName} invited you to join <strong>${projectName}</strong> as <strong>${projectRole}</strong>.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border-radius:6px;padding:16px;margin-bottom:24px;">
                <tr>
                  <td style="padding:8px 16px;">
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Project</p>
                    <p style="margin:0;color:#1e293b;font-size:14px;font-weight:600;">${projectName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 16px;">
                    <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">Role</p>
                    <p style="margin:0;color:#1e293b;font-size:14px;">${projectRole}</p>
                  </td>
                </tr>
              </table>
              <a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background-color:#1e293b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">
                View Invitation
              </a>
              <p style="margin:20px 0 0;color:#64748b;font-size:13px;line-height:1.5;">
                If you are asked to sign in first, use this same email address and RailCommand will bring you back to the invitation.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
                This is an automated invitation from RailCommand.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function buildInvitationEmailText(input: {
  inviteUrl: string;
  projectName: string;
  projectRole: string;
  invitedByName: string;
}): string {
  return [
    'RailCommand project invitation',
    '',
    `${input.invitedByName} invited you to join ${input.projectName} as ${formatRole(input.projectRole)}.`,
    '',
    `View invitation: ${input.inviteUrl}`,
    '',
    'If you are asked to sign in first, use this same email address and RailCommand will bring you back to the invitation.',
  ].join('\n');
}

async function sendInvitationEmail(input: {
  email: string;
  token: string;
  projectName: string;
  projectRole: string;
  invitedByName: string;
}): Promise<string | null> {
  const resend = getResendClient();
  if (!resend) {
    return 'RESEND_API_KEY is not configured';
  }

  const inviteUrl = `${getSiteUrl()}/invite/${encodeURIComponent(input.token)}`;
  const safeProjectName = input.projectName.replace(/[\r\n]+/g, ' ');
  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: input.email,
      subject: `You're invited to ${safeProjectName} on RailCommand`,
      html: buildInvitationEmailHtml({
        inviteUrl,
        projectName: input.projectName,
        projectRole: input.projectRole,
        invitedByName: input.invitedByName,
      }),
      text: buildInvitationEmailText({
        inviteUrl,
        projectName: input.projectName,
        projectRole: input.projectRole,
        invitedByName: input.invitedByName,
      }),
      tags: [{ name: 'type', value: 'project_invitation' }],
    });

    return error?.message ?? null;
  } catch (err) {
    return err instanceof Error ? err.message : 'Unknown email provider error';
  }
}

// ---------------------------------------------------------------------------
// createInvitation -- invite someone by email to a project
// ---------------------------------------------------------------------------
export async function createInvitation(
  projectId: string,
  email: string,
  projectRole: ProjectMember['project_role']
): Promise<ActionResult<ProjectInvitation>> {
  try {
    const inviteEmail = email.trim().toLowerCase();
    if (!inviteEmail) return { error: 'Email is required' };

    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.TEAM_MANAGE);
    if (!perm.allowed) return { error: perm.error };
    const adminClient = createAdminClient();

    // Get project + org for tier check
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id, name, organization_id')
      .eq('id', projectId)
      .single();

    if (projError || !project) return { error: 'Project not found' };
    if (!project.organization_id) {
      return { error: 'This project is not linked to an organization. Please contact support.' };
    }

    // Use the admin client after authorization so RLS on organizations cannot
    // silently hide the tier and downgrade an eligible org to the free limit.
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('tier')
      .eq('id', project.organization_id)
      .single();

    if (orgError || !org) return { error: 'Organization plan not found' };

    const tier = (org?.tier ?? 'free') as Tier;
    const limit = TIER_LIMITS[tier];
    const nowIso = new Date().toISOString();

    await adminClient
      .from('project_invitations')
      .update({ status: 'expired' })
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .lte('expires_at', nowIso);

    // Check if email is already a member
    const { data: existingMember } = await supabase
      .from('project_members')
      .select('id, profile:profiles!project_members_profile_id_fkey(email)')
      .eq('project_id', projectId);

    const alreadyMember = existingMember?.some(
      (m) =>
        (m.profile as unknown as { email?: string })?.email?.toLowerCase() ===
        inviteEmail
    );
    if (alreadyMember) {
      return { error: 'This person is already a member of this project' };
    }

    const { data: inviterProfile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const invitedByName = inviterProfile?.full_name ?? user.email ?? 'A team member';

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('project_id', projectId)
      .eq('email', inviteEmail)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (existingInvite) {
      const { data: refreshedInvite, error: refreshError } = await adminClient
        .from('project_invitations')
        .update({
          project_role: projectRole,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', existingInvite.id)
        .select()
        .single();

      if (refreshError || !refreshedInvite) {
        return { error: refreshError?.message ?? 'Failed to refresh invitation' };
      }

      const emailError = await sendInvitationEmail({
        email: inviteEmail,
        token: refreshedInvite.token,
        projectName: project.name,
        projectRole,
        invitedByName,
      });

      if (emailError) {
        return {
          error: `Invitation email could not be sent: ${emailError}`,
        };
      }

      await logActivity(
        supabase,
        projectId,
        'project',
        projectId,
        'assigned',
        `resent invitation to ${inviteEmail} as ${projectRole}`,
        user.id
      );

      revalidatePath(`/projects/${projectId}/team`);

      return { success: true, data: refreshedInvite as ProjectInvitation };
    }

    // Count existing members + pending invitations before adding a new invite.
    const { count: memberCount } = await adminClient
      .from('project_members')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const { count: pendingCount } = await adminClient
      .from('project_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .gt('expires_at', nowIso);

    const total = (memberCount ?? 0) + (pendingCount ?? 0);
    if (total >= limit) {
      return {
        error: `Your ${tier} plan allows up to ${limit} members per project. Upgrade to add more.`,
      };
    }

    // Create the invitation record
    const { data: invitation, error: insertError } = await supabase
      .from('project_invitations')
      .insert({
        project_id: projectId,
        email: inviteEmail,
        project_role: projectRole,
        invited_by: user.id,
      })
      .select()
      .single();

    if (insertError || !invitation) {
      return { error: insertError?.message ?? 'Failed to create invitation' };
    }

    const emailError = await sendInvitationEmail({
      email: inviteEmail,
      token: invitation.token,
      projectName: project.name,
      projectRole,
      invitedByName,
    });

    if (emailError) {
      await adminClient
        .from('project_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);

      return {
        error: `Invitation email could not be sent: ${emailError}`,
      };
    }

    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'assigned',
      `invited ${inviteEmail} as ${projectRole}`,
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
// getInvitationByToken -- public lookup for a single invite link
// ---------------------------------------------------------------------------
export async function getInvitationByToken(token: string): Promise<
  ActionResult<{ invitation: ProjectInvitation; viewerEmail: string | null }>
> {
  try {
    const normalizedToken = token.trim();
    if (!/^[a-f0-9]{32,128}$/i.test(normalizedToken)) {
      return { error: 'Invitation not found, expired, or already used.' };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const adminClient = createAdminClient();
    const { data, error } = await adminClient
      .from('project_invitations')
      .select(`
        *,
        project:projects(id, name),
        invited_by_profile:profiles!project_invitations_invited_by_fkey(id, full_name)
      `)
      .eq('token', normalizedToken)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error) return { error: error.message };
    if (!data) return { error: 'Invitation not found, expired, or already used.' };

    return {
      success: true,
      data: {
        invitation: data as ProjectInvitation,
        viewerEmail: user?.email?.toLowerCase() ?? null,
      },
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to fetch invitation',
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
    const userEmail = user.email?.toLowerCase();
    if (!userEmail) return { error: 'Your account does not have an email address.' };

    // Find the invitation
    const { data: invitation, error: findError } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('token', token)
      .eq('email', userEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (findError || !invitation) {
      return { error: 'Invitation not found, expired, or already used.' };
    }

    // Add user as a project member FIRST (while invitation is still pending —
    // required by the RLS policy on project_members INSERT which checks for
    // a pending invitation as proof of authorization)
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

    // Now update invitation status to accepted
    const { error: updateError } = await supabase
      .from('project_invitations')
      .update({ status: 'accepted' })
      .eq('id', invitation.id);

    if (updateError) return { error: updateError.message };

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
    const userEmail = user.email?.toLowerCase();
    if (!userEmail) return { error: 'Your account does not have an email address.' };

    const { data: invitation, error: findError } = await supabase
      .from('project_invitations')
      .select('id')
      .eq('token', token)
      .eq('email', userEmail)
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
    const userEmail = user.email?.toLowerCase();
    if (!userEmail) return { error: 'Your account does not have an email address.' };

    const { data, error } = await supabase
      .from('project_invitations')
      .select(`
        *,
        project:projects(id, name),
        invited_by_profile:profiles!project_invitations_invited_by_fkey(id, full_name)
      `)
      .eq('email', userEmail)
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
// resendInvitation -- resend a pending invitation (manager only)
// ---------------------------------------------------------------------------
export async function resendInvitation(
  invitationId: string,
  projectId: string
): Promise<ActionResult<ProjectInvitation>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const perm = await checkPermission(supabase, user.id, projectId, ACTIONS.TEAM_MANAGE);
    if (!perm.allowed) return { error: perm.error };

    const adminClient = createAdminClient();
    const nowIso = new Date().toISOString();
    await adminClient
      .from('project_invitations')
      .update({ status: 'expired' })
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .lte('expires_at', nowIso);

    const { data: invitation, error: findError } = await adminClient
      .from('project_invitations')
      .select(`
        *,
        project:projects(id, name),
        invited_by_profile:profiles!project_invitations_invited_by_fkey(id, full_name)
      `)
      .eq('id', invitationId)
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .maybeSingle();

    if (findError) return { error: findError.message };
    if (!invitation) {
      return { error: 'This invitation has expired. Send a new invitation instead.' };
    }

    const invitedByName =
      invitation.invited_by_profile?.full_name ?? user.email ?? 'A team member';
    const projectName = invitation.project?.name ?? 'RailCommand project';

    const { data: refreshedInvite, error: refreshError } = await adminClient
      .from('project_invitations')
      .update({
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('id', invitation.id)
      .select()
      .single();

    if (refreshError || !refreshedInvite) {
      return { error: refreshError?.message ?? 'Failed to refresh invitation' };
    }

    const emailError = await sendInvitationEmail({
      email: refreshedInvite.email,
      token: refreshedInvite.token,
      projectName,
      projectRole: refreshedInvite.project_role,
      invitedByName,
    });

    if (emailError) {
      return {
        error: `Invitation email could not be sent: ${emailError}`,
      };
    }

    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'assigned',
      `resent invitation to ${refreshedInvite.email} as ${refreshedInvite.project_role}`,
      user.id
    );

    revalidatePath(`/projects/${projectId}/team`);

    return { success: true, data: refreshedInvite as ProjectInvitation };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to resend invitation',
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
