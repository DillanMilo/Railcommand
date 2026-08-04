// src/lib/notifications/send.ts
//
// Automated email delivery remains disabled. Project events are delivered to
// the recipient's in-app notification center instead.

import { createClient } from '@/lib/supabase/server';

// ---------------------------------------------------------------------------
// Look up a user's profile by ID to get email + name
// ---------------------------------------------------------------------------
export async function getUserProfile(userId: string): Promise<{ email: string; full_name: string } | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .single();
    return data ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Look up project name
// ---------------------------------------------------------------------------
export async function getProjectName(projectId: string): Promise<string> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single();
    return data?.name ?? 'Unknown Project';
  } catch {
    return 'Unknown Project';
  }
}
