const STAGING_SUPABASE_REF = 'cyacardivfzrsravqjto';
const STAGING_API_HOST = 'railcommand-mobile-staging.vercel.app';

function required(name: string): string {
  const value = import.meta.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the mobile staging spike`);
  return value;
}

const supabaseUrl = new URL(required('VITE_SUPABASE_URL'));
const apiBaseUrl = new URL(required('VITE_API_BASE_URL'));
if (supabaseUrl.protocol !== 'https:' || supabaseUrl.hostname !== `${STAGING_SUPABASE_REF}.supabase.co`) {
  throw new Error('Mobile Supabase configuration is not the approved staging project');
}
if (apiBaseUrl.protocol !== 'https:' || apiBaseUrl.hostname !== STAGING_API_HOST) {
  throw new Error('Mobile API configuration is not the approved staging deployment');
}
if (import.meta.env.VITE_MOBILE_APP_ID !== 'io.railcommand.app.dev') {
  throw new Error('Mobile Phase 1 must use io.railcommand.app.dev');
}

export const mobileConfig = {
  apiBaseUrl: apiBaseUrl.origin,
  appId: 'io.railcommand.app.dev',
  supabasePublishableKey: required('VITE_SUPABASE_PUBLISHABLE_KEY'),
  supabaseUrl: supabaseUrl.origin,
} as const;
