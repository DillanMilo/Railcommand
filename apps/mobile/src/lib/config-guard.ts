export type MobileBuildProfile = 'development' | 'staging' | 'production';

export type ExpoMobileConfig = {
  profile: MobileBuildProfile;
  supabaseUrl: string;
  publishableKey: string;
  apiBaseUrl: string;
  expectedSupabaseProjectRef: string;
  expectedApiHost: string;
  linkHost: string;
  easProjectId: string | null;
};

type RawConfig = Record<string, string | undefined>;

function csv(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map((part) => part.trim().toLowerCase()).filter(Boolean));
}

export function validateExpoMobileConfig(raw: RawConfig): ExpoMobileConfig {
  const profile = raw.profile;
  if (profile !== 'development' && profile !== 'staging' && profile !== 'production') {
    throw new Error('RailCommand mobile build profile is invalid');
  }
  const supabaseUrl = new URL(raw.supabaseUrl ?? '');
  const apiBaseUrl = new URL(raw.apiBaseUrl ?? '');
  const expectedSupabaseProjectRef = raw.expectedSupabaseProjectRef?.trim().toLowerCase();
  const expectedApiHost = raw.expectedApiHost?.trim().toLowerCase();
  const linkHost = raw.linkHost?.trim().toLowerCase();
  const publishableKey = raw.publishableKey?.trim();
  if (!expectedSupabaseProjectRef || !expectedApiHost || !linkHost || !publishableKey) {
    throw new Error('RailCommand mobile environment is incomplete');
  }
  if (supabaseUrl.protocol !== 'https:' || apiBaseUrl.protocol !== 'https:') {
    throw new Error('RailCommand mobile services must use HTTPS');
  }
  if (supabaseUrl.hostname !== `${expectedSupabaseProjectRef}.supabase.co`) {
    throw new Error('RailCommand mobile Supabase host does not match the approved inventory');
  }
  if (apiBaseUrl.hostname !== expectedApiHost) {
    throw new Error('RailCommand mobile API host does not match the approved inventory');
  }
  const approvedLinkHost = profile === 'production'
    ? 'railcommand.io'
    : 'mobile-staging.railcommand.io';
  if (linkHost !== approvedLinkHost) {
    throw new Error('RailCommand mobile link host does not match the build profile');
  }
  const blockedRefs = csv(raw.blockedSupabaseProjectRefs);
  const blockedHosts = csv(raw.blockedApiHosts);
  if (profile !== 'production' && (blockedRefs.has(expectedSupabaseProjectRef) || blockedHosts.has(expectedApiHost))) {
    throw new Error('A non-production mobile build cannot use production services');
  }
  if (/service_role|secret/i.test(publishableKey)) {
    throw new Error('Server credentials are forbidden in the mobile bundle');
  }
  return {
    profile,
    supabaseUrl: supabaseUrl.toString(),
    publishableKey,
    apiBaseUrl: apiBaseUrl.toString(),
    expectedSupabaseProjectRef,
    expectedApiHost,
    linkHost,
    easProjectId: raw.easProjectId?.trim() || null,
  };
}
