import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { mobileConfig } from './config';

const prefix = `railcommand.${mobileConfig.profile}.auth.`;
const nativeSecureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(`${prefix}${key}`),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(`${prefix}${key}`, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(`${prefix}${key}`),
};

// Browser support exists only for local visual QA. Native sessions continue to
// use Keychain/Keystore and the web preview intentionally forgets its session
// when the page process ends rather than placing private data in persistent browser storage.
const previewMemory = new Map<string, string>();
const previewStorage = {
  getItem: async (key: string) => previewMemory.get(`${prefix}${key}`) ?? null,
  setItem: async (key: string, value: string) => { previewMemory.set(`${prefix}${key}`, value); },
  removeItem: async (key: string) => { previewMemory.delete(`${prefix}${key}`); },
};
const secureStorage = Platform.OS === 'web' ? previewStorage : nativeSecureStorage;

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
