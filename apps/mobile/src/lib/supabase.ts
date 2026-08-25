import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { mobileConfig } from './config';

const prefix = `railcommand.${mobileConfig.profile}.auth.`;
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(`${prefix}${key}`),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(`${prefix}${key}`, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(`${prefix}${key}`),
};

export const supabase = createClient(mobileConfig.supabaseUrl, mobileConfig.publishableKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
