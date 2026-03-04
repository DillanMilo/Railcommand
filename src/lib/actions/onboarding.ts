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

    // Create the organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name,
        type,
        tier: 'free',
      })
      .select()
      .single();

    if (orgError || !organization) {
      return { error: orgError?.message ?? 'Failed to create organization' };
    }

    // Link the user's profile to the new organization
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ organization_id: organization.id })
      .eq('id', user.id);

    if (profileError) {
      return { error: profileError.message };
    }

    return { success: true, data: organization as Organization };
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
