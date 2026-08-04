'use server';

import { createClient } from '@/lib/supabase/server';
import type { UserNotification } from '@/lib/types';
import { type ActionResult, getAuthenticatedUser } from './permissions-helper';

export async function getMyNotifications(): Promise<ActionResult<UserNotification[]>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { data, error } = await supabase
      .from('user_notifications')
      .select('id, recipient_id, project_id, type, title, body, href, entity_type, entity_id, read_at, dismissed_at, created_at')
      .eq('recipient_id', user.id)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return { error: error.message };
    return { success: true, data: (data as UserNotification[]) ?? [] };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to load notifications',
    };
  }
}

export async function markUserNotificationRead(
  notificationId: string,
): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('recipient_id', user.id);

    if (error) return { error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update notification',
    };
  }
}

export async function markAllUserNotificationsRead(): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .is('dismissed_at', null)
      .is('read_at', null);

    if (error) return { error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update notifications',
    };
  }
}

export async function dismissUserNotification(
  notificationId: string,
): Promise<ActionResult<undefined>> {
  try {
    const supabase = await createClient();
    const { user, error: authError } = await getAuthenticatedUser(supabase);
    if (authError || !user) return { error: authError ?? 'Not authenticated' };

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('user_notifications')
      .update({ read_at: now, dismissed_at: now })
      .eq('id', notificationId)
      .eq('recipient_id', user.id);

    if (error) return { error: error.message };
    return { success: true, data: undefined };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to dismiss notification',
    };
  }
}
