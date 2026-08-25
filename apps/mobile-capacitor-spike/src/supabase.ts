import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { createClient } from '@supabase/supabase-js';
import { mobileConfig } from './config';
import { initializeSecureSessionStorage, secureSessionStorage } from './secure-storage';

await initializeSecureSessionStorage(mobileConfig.environment);

export const supabase = createClient(
  mobileConfig.supabaseUrl,
  mobileConfig.supabasePublishableKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: secureSessionStorage,
      storageKey: `railcommand-${mobileConfig.environment}-auth`,
    },
  },
);

export async function registerAuthRefreshLifecycle(): Promise<PluginListenerHandle | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const setRefreshState = (isActive: boolean) => {
    if (isActive) supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  setRefreshState((await App.getState()).isActive);
  return App.addListener('appStateChange', ({ isActive }) => setRefreshState(isActive));
}
