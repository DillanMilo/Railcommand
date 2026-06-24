// src/lib/actions/onboarding.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Organization, Profile } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
} from './permissions-helper';

const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

function isSelfServiceSignupEnabled(): boolean {
  const configured =
    process.env.SELF_SERVICE_SIGNUP_ENABLED ??
    process.env.NEXT_PUBLIC_SELF_SERVICE_SIGNUP_ENABLED;

  if (!configured) return false;
  return TRUE_ENV_VALUES.has(configured.trim().toLowerCase());
}

async function hasPendingInvitation(email: string | undefined): Promise<boolean> {
  if (!email) return false;

  const adminClient = createAdminClient();
  const { count, error } = await adminClient
    .from('project_invitations')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.trim().toLowerCase())
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString());

  if (error) {
    console.error('[onboarding] Failed to check pending invitations:', error);
    return false;
  }

  return (count ?? 0) > 0;
}

async function canCreateOrganization(email: string | undefined): Promise<boolean> {
  if (isSelfServiceSignupEnabled()) return true;
  return hasPendingInvitation(email);
}

// ---------------------------------------------------------------------------
// setupBusiness -- create an organization and link it to the user's profile
// ---------------------------------------------------------------------------
export async function setupBusiness(
  name: string,
  type: Organization['type'],
  role: Profile['role'] = 'member'
): Promise<ActionResult<Organization>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    if (!(await canCreateOrganization(user.email))) {
      return {
        error:
          'RailCommand onboarding is currently approval-only. Please use a project invitation link or request enterprise access from the sign-in page.',
      };
    }

    // Use SECURITY DEFINER rpc to atomically create org + link profile
    const { data, error: rpcError } = await supabase.rpc('setup_organization', {
      org_name: name,
      org_type: type,
    });

    if (rpcError || !data) {
      return { error: rpcError?.message ?? 'Failed to create organization' };
    }

    // Update the user's role on their profile
    const { error: roleError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id);

    if (roleError) {
      return { error: roleError.message };
    }

    return { success: true, data: data as Organization };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to set up business' };
  }
}

// ---------------------------------------------------------------------------
// checkOnboardingStatus -- check if user still needs to onboard
// ---------------------------------------------------------------------------
export async function checkOnboardingStatus(): Promise<
  ActionResult<{ needsOnboarding: boolean }>
> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return { error: profileError?.message ?? 'Profile not found' };
    }

    return {
      success: true,
      data: { needsOnboarding: profile.organization_id === null },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to check onboarding status' };
  }
}
