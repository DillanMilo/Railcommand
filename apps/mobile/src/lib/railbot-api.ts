import { fetch as expoFetch } from 'expo/fetch';
import { supabase } from './supabase';
import { mobileConfig } from './config';
export function railbotClient(userId: string, current: () => boolean) {
  return async (path: string, init: RequestInit = {}) => {
    if (!current()) throw new Error('Account or project changed.');
    let { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== userId || !current()) throw new Error('Please sign in again.');
    if (session.expires_at && session.expires_at * 1000 < Date.now() + 60_000) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
      if (refreshed.error || !session || session.user.id !== userId || !current()) throw new Error('Please sign in again. Your draft is retained.');
    }
    // Never automatically replay a POST after an ambiguous network failure.
    const response = await expoFetch(`${mobileConfig.apiBaseUrl}/api/mobile/v1/railbot${path}`, {
      ...init, headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` },
    });
    if (!current()) throw new Error('Account or project changed.');
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? `RailBot request failed (${response.status}). Your draft is retained.`);
    }
    return response;
  };
}
