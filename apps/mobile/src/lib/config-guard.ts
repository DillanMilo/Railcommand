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
type MobileRuntime = {
  isDebug: boolean;
  isPhysicalDevice: boolean;
  nativeProfile: string | undefined;
};

// This checked-in inventory is deliberately independent of build-time variables:
// a missing or altered denylist must never let a development bundle use production.
const productionProjectFingerprints = new Set(['fbf44d01']);
const productionApiHosts = new Set(['railcommand.io', 'www.railcommand.io']);
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

function csv(value: string | undefined): Set<string> {
  return new Set((value ?? '').split(',').map((part) => part.trim().toLowerCase()).filter(Boolean));
}

function inventoryFingerprint(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function validateExpoMobileConfig(raw: RawConfig, runtime?: MobileRuntime): ExpoMobileConfig {
  const profile = raw.profile;
  if (profile !== 'development' && profile !== 'staging' && profile !== 'production') {
    throw new Error('RailCommand mobile build profile is invalid');
  }
  // An environment variable alone cannot promote a debug/simulator bundle.
  // Reject before constructing either client, and never report service values.
  if (profile === 'production' && (runtime?.isDebug !== false
    || runtime?.isPhysicalDevice !== true || runtime?.nativeProfile !== 'production')) {
    throw new Error('Production services require an explicitly configured physical-device release');
  }
  let supabaseUrl: URL;
  let apiBaseUrl: URL;
  try {
    supabaseUrl = new URL(raw.supabaseUrl ?? '');
    apiBaseUrl = new URL(raw.apiBaseUrl ?? '');
  } catch {
    throw new Error('RailCommand mobile service configuration is invalid');
  }
  const expectedSupabaseProjectRef = raw.expectedSupabaseProjectRef?.trim().toLowerCase();
  const expectedApiHost = raw.expectedApiHost?.trim().toLowerCase();
  const linkHost = raw.linkHost?.trim().toLowerCase();
  const publishableKey = raw.publishableKey?.trim();
  if (!expectedSupabaseProjectRef || !expectedApiHost || !linkHost || !publishableKey) {
    throw new Error('RailCommand mobile environment is incomplete');
  }
  const localSupabase = profile === 'development' && supabaseUrl.protocol === 'http:'
    && loopbackHosts.has(supabaseUrl.hostname);
  const localApi = profile === 'development' && apiBaseUrl.protocol === 'http:'
    && loopbackHosts.has(apiBaseUrl.hostname);
  if ((!localSupabase && supabaseUrl.protocol !== 'https:') || (!localApi && apiBaseUrl.protocol !== 'https:')) {
    throw new Error('RailCommand mobile services must use HTTPS');
  }
  if (localSupabase ? expectedSupabaseProjectRef !== 'local' : supabaseUrl.hostname !== `${expectedSupabaseProjectRef}.supabase.co`) {
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
  const actualProjectRef = localSupabase ? 'local' : supabaseUrl.hostname.split('.')[0];
  if (profile !== 'production' && (
    productionProjectFingerprints.has(inventoryFingerprint(expectedSupabaseProjectRef))
    || productionProjectFingerprints.has(inventoryFingerprint(actualProjectRef))
    || productionApiHosts.has(expectedApiHost)
    || productionApiHosts.has(apiBaseUrl.hostname)
    || blockedRefs.has(expectedSupabaseProjectRef)
    || blockedHosts.has(expectedApiHost)
  )) {
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
