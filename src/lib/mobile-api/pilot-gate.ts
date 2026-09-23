export type MobilePilotMode = 'disabled' | 'read-only' | 'read-write';

type PilotEnvironment = {
  MOBILE_BACKEND_ENV?: string;
  MOBILE_PILOT_MODE?: string;
  MOBILE_PILOT_USER_IDS?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
};

export type MobilePilotDecision =
  | { allowed: true }
  | { allowed: false; reason: 'disabled' | 'configuration' | 'user' | 'read-only' };

const PRODUCTION_SUPABASE_PROJECT_REFS = new Set(['gwvftrrknusdfdgiwuij']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function supabaseProjectRef(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(new URL(value).hostname);
    return match?.[1]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export function isProductionMobileBackend(env: PilotEnvironment): boolean {
  if (env.MOBILE_BACKEND_ENV?.trim().toLowerCase() === 'production') return true;
  const projectRef = supabaseProjectRef(env.NEXT_PUBLIC_SUPABASE_URL);
  return projectRef ? PRODUCTION_SUPABASE_PROJECT_REFS.has(projectRef) : false;
}

function pilotMode(value: string | undefined): MobilePilotMode | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'disabled' || normalized === 'read-only' || normalized === 'read-write'
    ? normalized
    : null;
}

function pilotUsers(value: string | undefined): Set<string> | null {
  const entries = value?.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? [];
  if (entries.length === 0 || entries.some((entry) => !UUID.test(entry))) return null;
  return new Set(entries);
}

/**
 * Reads only the subject used by the restrictive pilot prefilter. This is not
 * authentication: each mobile route still verifies the bearer token with
 * Supabase before reading or writing anything.
 */
export function readUnverifiedBearerSubject(value: string | null): string | null {
  const token = /^Bearer ([^\s]+)$/i.exec(value?.trim() ?? '')?.[1];
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown };
    return typeof decoded.sub === 'string' && UUID.test(decoded.sub)
      ? decoded.sub.toLowerCase()
      : null;
  } catch {
    return null;
  }
}

export function isMobileMutation(pathname: string, method: string): boolean {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD' || normalizedMethod === 'OPTIONS') return false;
  // PDF generation reads selected records but does not mutate application data.
  if (pathname === '/api/mobile/v1/reports/pdf' && normalizedMethod === 'POST') return false;
  // New non-read methods fail closed as mutations until deliberately classified.
  return true;
}

export function evaluateMobilePilotAccess(input: {
  authorization: string | null;
  env: PilotEnvironment;
  method: string;
  pathname: string;
}): MobilePilotDecision {
  if (!isProductionMobileBackend(input.env) || input.method.toUpperCase() === 'OPTIONS') {
    return { allowed: true };
  }

  const mode = pilotMode(input.env.MOBILE_PILOT_MODE);
  if (!mode || mode === 'disabled') return { allowed: false, reason: mode ? 'disabled' : 'configuration' };

  const users = pilotUsers(input.env.MOBILE_PILOT_USER_IDS);
  if (!users) return { allowed: false, reason: 'configuration' };

  const subject = readUnverifiedBearerSubject(input.authorization);
  // Missing or malformed credentials continue to the route's real authentication
  // boundary so they receive the existing 401 response. This prefilter never grants
  // access; it can only reject an otherwise valid request early.
  if (!subject) return { allowed: true };
  if (!users.has(subject)) return { allowed: false, reason: 'user' };
  if (mode === 'read-only' && isMobileMutation(input.pathname, input.method)) {
    return { allowed: false, reason: 'read-only' };
  }
  return { allowed: true };
}
