// src/lib/actions/onboarding.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import type { Organization } from '@/lib/types';
import {
  type ActionResult,
  getAuthenticatedUser,
} from './permissions-helper';

// ---------------------------------------------------------------------------
// setupBusiness -- create an organization and link it to the user's profile
// ---------------------------------------------------------------------------
export async function setupBusiness(
  name: string,
  type: Organization['type']
): Promise<ActionResult<Organization>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Use SECURITY DEFINER rpc to atomically create org + link profile
    const { data, error: rpcError } = await supabase.rpc('setup_organization', {
      org_name: name,
      org_type: type,
    });

    if (rpcError || !data) {
      return { error: rpcError?.message ?? 'Failed to create organization' };
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
