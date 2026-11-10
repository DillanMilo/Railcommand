import { MobileApiClient } from '@railcommand/api-client';
import { mobileConfig } from './config';
import { supabase } from './supabase';
import { recordMobileRequestMetric } from './request-metrics';

export const mobileApi = new MobileApiClient({
  baseUrl: mobileConfig.apiBaseUrl,
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  refreshAccessToken: async () => {
    const { data, error } = await supabase.auth.refreshSession();
    return error ? null : data.session?.access_token ?? null;
  },
  onRequestMetric: recordMobileRequestMetric,
});

// Keep retries bound to the account that started the operation. A global token
// lookup must never replay A's request with B's freshly signed-in credentials.
export function mobileApiForUser(userId: string, isCurrent: () => boolean): MobileApiClient {
  const currentSession = async () => {
    if (!isCurrent()) return null;
    const { data, error } = await supabase.auth.getSession();
    return !error && isCurrent() && data.session?.user.id === userId ? data.session : null;
  };
  return new MobileApiClient({
    baseUrl: mobileConfig.apiBaseUrl,
    fetch: (input, init) => {
      if (!isCurrent()) return Promise.reject(new Error('Request canceled after the account changed.'));
      return fetch(input, init);
    },
    getAccessToken: async () => {
      const session = await currentSession();
      return isCurrent() ? session?.access_token ?? null : null;
    },
    refreshAccessToken: async () => {
      if (!await currentSession() || !isCurrent()) return null;
      const { data, error } = await supabase.auth.refreshSession();
      return !error && isCurrent() && data.session?.user.id === userId ? data.session.access_token : null;
    },
    onRequestMetric: recordMobileRequestMetric,
  });
}
