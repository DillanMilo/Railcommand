'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { DemoAccount, DemoTeamLogin } from './types';

/**
 * Look up a demo account by slug. Returns null if not found or inactive.
 */
export async function getDemoBySlug(slug: string): Promise<DemoAccount | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('demo_accounts')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;

  // Check expiration
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return null;
  }

  return data as DemoAccount;
}

/**
 * Get team logins for a team demo account.
 */
export async function getDemoTeamLogins(demoAccountId: string): Promise<DemoTeamLogin[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('demo_team_logins')
    .select('*')
    .eq('demo_account_id', demoAccountId)
    .order('created_at');

  if (error || !data) return [];
  return data as DemoTeamLogin[];
}

/**
 * Check if the current user is in a demo session.
 */
export async function isCurrentUserDemo(): Promise<{ isDemo: boolean; demoSlug?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isDemo: false };

  const admin = createAdminClient();

  // Check if user's email matches any demo account
  const { data: demoAccount } = await admin
    .from('demo_accounts')
    .select('slug')
    .eq('demo_user_id', user.id)
    .eq('is_active', true)
    .single();

  if (demoAccount) {
    return { isDemo: true, demoSlug: demoAccount.slug };
  }

  // Check team logins
  const { data: teamLogin } = await admin
    .from('demo_team_logins')
    .select('demo_account_id, demo_accounts!inner(slug)')
    .eq('profile_id', user.id)
    .single();

  if (teamLogin) {
    return { isDemo: true, demoSlug: (teamLogin as any).demo_accounts?.slug };
  }

  return { isDemo: false };
}
