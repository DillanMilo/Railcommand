// src/lib/notifications/send.ts
//
// Automated notification email delivery is intentionally disabled. RailCommand
// only sends email when a user explicitly requests it (for example, inviting a
// teammate or requesting a password reset).

import type { NotificationPayload } from './types';
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

// ---------------------------------------------------------------------------
// Main send function
// ---------------------------------------------------------------------------
export async function sendNotification(
  recipientUserId: string,
  payload: NotificationPayload
): Promise<void> {
  // Keep this exported no-op as a second line of defense for any overlooked
  // or future call site. Do not initialize Resend or record an email event.
  void recipientUserId;
  void payload;
}

// ---------------------------------------------------------------------------
// Convenience: send without needing to look up recipient details yourself
// ---------------------------------------------------------------------------
export async function sendNotificationToUser(
  recipientUserId: string,
  buildPayload: (recipient: { email: string; name: string }) => NotificationPayload
): Promise<void> {
  // Avoid even loading the recipient profile while automated email is off.
  void recipientUserId;
  void buildPayload;
}
