export type MobileEnvironment = 'development' | 'staging' | 'production';

const STAGING_SUPABASE_REF = 'cyacardivfzrsravqjto';
const STAGING_API_HOST = 'railcommand-mobile-staging.vercel.app';
const PROFILE_APP_IDS: Record<MobileEnvironment, string> = {
  development: 'io.railcommand.app.dev',
  staging: 'io.railcommand.app.staging',
  production: 'io.railcommand.app',
};

function required(name: string): string {
  const value = import.meta.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the mobile build`);
  return value;
}

function readEnvironment(): MobileEnvironment {
  const value = required('VITE_BUILD_PROFILE');
  if (value !== 'development' && value !== 'staging' && value !== 'production') {
    throw new Error('VITE_BUILD_PROFILE must be development, staging, or production');
  }
  return value;
}

const environment = readEnvironment();
const appId = required('VITE_MOBILE_APP_ID');
if (appId !== PROFILE_APP_IDS[environment]) {
  throw new Error(`${environment} builds must use ${PROFILE_APP_IDS[environment]}`);
}

const supabaseUrl = new URL(required('VITE_SUPABASE_URL'));
const apiBaseUrl = new URL(required('VITE_API_BASE_URL'));
if (supabaseUrl.protocol !== 'https:' || apiBaseUrl.protocol !== 'https:') {
  throw new Error('Mobile backends must use HTTPS');
}

if (environment === 'production') {
  if (import.meta.env.VITE_ALLOW_PRODUCTION_BUILD !== 'yes') {
    throw new Error('Production mobile builds require an explicit release authorization');
  }
  const expectedSupabaseRef = required('VITE_EXPECTED_SUPABASE_PROJECT_REF');
  const expectedApiHost = required('VITE_EXPECTED_API_HOST');
  if (supabaseUrl.hostname !== `${expectedSupabaseRef}.supabase.co`) {
    throw new Error('Production Supabase URL does not match the release environment');
  }
  if (apiBaseUrl.hostname !== expectedApiHost) {
    throw new Error('Production API URL does not match the release environment');
  }
} else {
  if (supabaseUrl.hostname !== `${STAGING_SUPABASE_REF}.supabase.co`) {
    throw new Error('Development and staging builds must use the approved staging Supabase project');
  }
  if (apiBaseUrl.hostname !== STAGING_API_HOST) {
    throw new Error('Development and staging builds must use the approved staging API');
  }
}

export const mobileConfig = {
  apiBaseUrl: apiBaseUrl.origin,
  appId,
  buildNumber: required('VITE_BUILD_NUMBER'),
  environment,
  supabasePublishableKey: required('VITE_SUPABASE_PUBLISHABLE_KEY'),
  supabaseUrl: supabaseUrl.origin,
  version: required('VITE_APP_VERSION'),
} as const;
