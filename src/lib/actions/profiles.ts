// src/lib/actions/profiles.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';
import { type ActionResult, getAuthenticatedUser } from './permissions-helper';

// ---------------------------------------------------------------------------
// getMyProfile -- returns the current authenticated user's profile
// ---------------------------------------------------------------------------
export async function getMyProfile(): Promise<ActionResult<Profile>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data, error } = await supabase
      .from('profiles')
      .select('*, organization:organizations(*)')
      .eq('id', user.id)
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'Profile not found' };

    return { success: true, data: data as Profile };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch profile' };
  }
}

// ---------------------------------------------------------------------------
// updateMyProfile -- updates the current authenticated user's profile
// ---------------------------------------------------------------------------
export async function updateMyProfile(updates: {
  full_name?: string;
  phone?: string;
}): Promise<ActionResult<Profile>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select('*, organization:organizations(*)')
      .single();

    if (error) return { error: error.message };
    if (!data) return { error: 'Profile not found' };

    return { success: true, data: data as Profile };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update profile' };
  }
}
