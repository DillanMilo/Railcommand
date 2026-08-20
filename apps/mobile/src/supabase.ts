import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { createClient } from '@supabase/supabase-js';
import { mobileConfig } from './config';
import { initializeSecureSessionStorage, secureSessionStorage } from './secure-storage';

await initializeSecureSessionStorage();

export const supabase = createClient(
  mobileConfig.supabaseUrl,
  mobileConfig.supabasePublishableKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storage: secureSessionStorage,
    },
  },
);

if (Capacitor.isNativePlatform()) {
  void App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
