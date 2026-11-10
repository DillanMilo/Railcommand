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
  localPhase1: boolean;
  authScheme: 'railcommand' | 'railcommandphase1';
};

type RawConfig = Record<string, string | undefined>;
type MobileRuntime = {
  isDebug: boolean;
  isPhysicalDevice: boolean;
  nativeProfile: string | undefined;
  nativeLocalPhase1?: boolean;
  nativeApplicationId?: string | null;
};

// This checked-in inventory is deliberately independent of build-time variables:
// a missing or altered denylist must never let a development bundle use production.
const productionProjectFingerprints = new Set(['fbf44d01']);
const productionApiHosts = new Set(['railcommand.io', 'www.railcommand.io']);
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

// URL parsing canonicalizes IPv4 spellings before this strict private-range check.
function privateIpv4(host: string): boolean {
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || !octets.every((value, index) => Number.isInteger(value)
    && value >= 0 && value <= 255 && String(value) === host.split('.')[index])) return false;
  return octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function localPublicKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return true;
  try {
    const payload = key.split('.')[1];
    if (!payload) return false;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))).role === 'anon';
  } catch { return false; }
}

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
  const localPhase1 = raw.localPhase1 === '1';
  const nativeLocal = runtime?.nativeLocalPhase1 === true || runtime?.nativeApplicationId === 'io.railcommand.app.phase1';
  if ((raw.localPhase1 && !localPhase1) || ((localPhase1 || nativeLocal) && (
    !localPhase1 || profile !== 'development' || runtime?.nativeProfile !== 'development'
    || runtime?.nativeLocalPhase1 !== true || runtime?.nativeApplicationId !== 'io.railcommand.app.phase1'
  ))) throw new Error('Local Phase1 requires its bundled development identity');
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
  if (!expectedSupabaseProjectRef || !expectedApiHost || (!localPhase1 && !linkHost) || !publishableKey) {
    throw new Error('RailCommand mobile environment is incomplete');
  }
  if (localPhase1) {
    const safeUrl = (url: URL) => url.protocol === 'https:' && privateIpv4(url.hostname)
      && !url.username && !url.password && !url.search && !url.hash;
    if (!safeUrl(supabaseUrl) || !safeUrl(apiBaseUrl) || supabaseUrl.origin !== apiBaseUrl.origin
      || supabaseUrl.pathname !== '/supabase' || apiBaseUrl.pathname !== '/'
      || expectedApiHost !== apiBaseUrl.hostname || expectedSupabaseProjectRef !== 'local'
      || !localPublicKey(publishableKey)) {
      throw new Error('Local Phase1 requires one explicit private HTTPS test endpoint and public client key');
    }
  }
  const localSupabase = profile === 'development' && supabaseUrl.protocol === 'http:'
    && loopbackHosts.has(supabaseUrl.hostname);
  const localApi = profile === 'development' && apiBaseUrl.protocol === 'http:'
    && loopbackHosts.has(apiBaseUrl.hostname);
  if ((!localSupabase && supabaseUrl.protocol !== 'https:') || (!localApi && apiBaseUrl.protocol !== 'https:')) {
    throw new Error('RailCommand mobile services must use HTTPS');
  }
  if (!localPhase1 && (localSupabase ? expectedSupabaseProjectRef !== 'local' : supabaseUrl.hostname !== `${expectedSupabaseProjectRef}.supabase.co`)) {
    throw new Error('RailCommand mobile Supabase host does not match the approved inventory');
  }
  if (apiBaseUrl.hostname !== expectedApiHost) {
    throw new Error('RailCommand mobile API host does not match the approved inventory');
  }
  const approvedLinkHost = profile === 'production'
    ? 'railcommand.io'
    : 'mobile-staging.railcommand.io';
  if (!localPhase1 && linkHost !== approvedLinkHost) {
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
    linkHost: localPhase1 ? expectedApiHost : linkHost!,
    easProjectId: localPhase1 ? null : raw.easProjectId?.trim() || null,
    localPhase1,
    authScheme: localPhase1 ? 'railcommandphase1' : 'railcommand',
  };
}
