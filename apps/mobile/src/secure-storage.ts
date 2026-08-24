import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import type { SupportedStorage } from '@supabase/supabase-js';

const memory = new Map<string, string>();

const memoryStorage: SupportedStorage = {
  getItem: async (key) => memory.get(key) ?? null,
  setItem: async (key, value) => { memory.set(key, value); },
  removeItem: async (key) => { memory.delete(key); },
};

const nativeStorage: SupportedStorage = {
  getItem: (key) => SecureStorage.getItem(key),
  setItem: (key, value) => SecureStorage.setItem(key, value),
  removeItem: (key) => SecureStorage.removeItem(key),
};

export const secureSessionStorage = Capacitor.isNativePlatform()
  ? nativeStorage
  : memoryStorage;

export async function initializeSecureSessionStorage(environment: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await SecureStorage.setKeyPrefix(`railcommand_${environment}_session_`);
  await SecureStorage.setSynchronize(false);
}
