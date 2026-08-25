import { validateExpoMobileConfig } from './config-guard';
import Constants from 'expo-constants';

const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID
  ?? Constants.expoConfig?.extra?.eas?.projectId
  ?? Constants.easConfig?.projectId;

export const mobileConfig = validateExpoMobileConfig({
  profile: process.env.EXPO_PUBLIC_BUILD_PROFILE,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  expectedSupabaseProjectRef: process.env.EXPO_PUBLIC_EXPECTED_SUPABASE_PROJECT_REF,
  expectedApiHost: process.env.EXPO_PUBLIC_EXPECTED_API_HOST,
  blockedSupabaseProjectRefs: process.env.EXPO_PUBLIC_BLOCKED_SUPABASE_PROJECT_REFS,
  blockedApiHosts: process.env.EXPO_PUBLIC_BLOCKED_API_HOSTS,
  easProjectId,
});
