// src/lib/actions/notification-preferences.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { type ActionResult, getAuthenticatedUser } from './permissions-helper';
import type { NotificationPreferences } from '@/lib/notifications';
import { DEFAULT_NOTIFICATION_PREFERENCES } from '@/lib/notifications';

// ---------------------------------------------------------------------------
// getNotificationPreferences -- returns the current user's preferences
// ---------------------------------------------------------------------------
export async function getNotificationPreferences(): Promise<ActionResult<NotificationPreferences>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data, error } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .single();

    if (error) return { error: error.message };

    const prefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(data?.notification_preferences as Partial<NotificationPreferences> | null ?? {}),
    };

    return { success: true, data: prefs };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to fetch notification preferences' };
  }
}

// ---------------------------------------------------------------------------
// updateNotificationPreferences -- updates the current user's preferences
// ---------------------------------------------------------------------------
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<ActionResult<NotificationPreferences>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    // Fetch current preferences
    const { data: current } = await supabase
      .from('profiles')
      .select('notification_preferences')
      .eq('id', user.id)
      .single();

    const merged: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(current?.notification_preferences as Partial<NotificationPreferences> | null ?? {}),
      ...preferences,
    };

    const { error } = await supabase
      .from('profiles')
      .update({ notification_preferences: merged })
      .eq('id', user.id);

    if (error) return { error: error.message };

    return { success: true, data: merged };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update notification preferences' };
  }
}
