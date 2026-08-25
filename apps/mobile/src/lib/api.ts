import { MobileApiClient } from '@railcommand/api-client';
import { mobileConfig } from './config';
import { supabase } from './supabase';

export const mobileApi = new MobileApiClient({
  baseUrl: mobileConfig.apiBaseUrl,
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});
