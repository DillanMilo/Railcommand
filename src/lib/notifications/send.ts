// src/lib/notifications/send.ts
//
// Core notification sender. All calls are wrapped in try/catch so a failed
// email NEVER breaks the caller's workflow.

import { Resend } from 'resend';
import { renderNotificationEmail } from './templates';
import type { NotificationPayload, NotificationType, NotificationPreferences } from './types';
import { DEFAULT_NOTIFICATION_PREFERENCES } from './types';
import { createClient } from '@/lib/supabase/server';

// Lazily initialised so missing env var doesn't crash at import time
let _resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[notifications] RESEND_API_KEY is not set -- skipping email');
    return null;
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL ?? 'RailCommand <noreply@railcommand.a5rail.com>';

// ---------------------------------------------------------------------------
// Preference check
// ---------------------------------------------------------------------------
async function getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', userId)
      .single();

    if (data?.notification_preferences) {
      return {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(data.notification_preferences as Partial<NotificationPreferences>),
      };
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

function isNotificationEnabled(
  prefs: NotificationPreferences,
  type: NotificationType
): boolean {
  return prefs[type] ?? true;
}

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
  try {
    // 1. Check user preferences
    const prefs = await getUserNotificationPreferences(recipientUserId);
    if (!isNotificationEnabled(prefs, payload.type)) {
      return; // User has opted out of this notification type
    }

    // 2. Get Resend client
    const resend = getResendClient();
    if (!resend) return;

    // 3. Render the email
    const { subject, html } = renderNotificationEmail(payload);

    // 4. Send
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: payload.recipientEmail,
      subject,
      html,
    });

    if (error) {
      console.error(`[notifications] Failed to send ${payload.type} to ${payload.recipientEmail}:`, error);
    }
  } catch (err) {
    // NEVER let email failures bubble up
    console.error('[notifications] Unexpected error sending notification:', err);
  }
}

// ---------------------------------------------------------------------------
// Convenience: send without needing to look up recipient details yourself
// ---------------------------------------------------------------------------
export async function sendNotificationToUser(
  recipientUserId: string,
  buildPayload: (recipient: { email: string; name: string }) => NotificationPayload
): Promise<void> {
  try {
    const profile = await getUserProfile(recipientUserId);
    if (!profile) {
      console.warn(`[notifications] Could not find profile for user ${recipientUserId}`);
      return;
    }
    const payload = buildPayload({ email: profile.email, name: profile.full_name });
    await sendNotification(recipientUserId, payload);
  } catch (err) {
    console.error('[notifications] Unexpected error in sendNotificationToUser:', err);
  }
}
