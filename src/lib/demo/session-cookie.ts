export const DEMO_SESSION_COOKIE = 'rc-demo-session';
export const DEMO_SLUG_COOKIE = 'rc-demo-slug';
export const DEMO_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type DemoSession = {
  mode: 'demo';
  projectId: string;
  profileId: string;
  issuedAt: number;
  expiresAt: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getDemoSessionSecret(): string {
  return process.env.DEMO_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    Math.ceil(value.length / 4) * 4,
    '=',
  );
  const binary = atob(base64);
  return new Uint8Array(Array.from(binary, (char) => char.charCodeAt(0)));
}

async function getSigningKey(): Promise<CryptoKey> {
  const secret = getDemoSessionSecret();
  if (!secret) {
    throw new Error('DEMO_SESSION_SECRET is required to issue demo sessions');
  }

  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function isDemoSession(value: unknown): value is DemoSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<DemoSession>;
  return (
    session.mode === 'demo' &&
    typeof session.projectId === 'string' &&
    typeof session.profileId === 'string' &&
    typeof session.issuedAt === 'number' &&
    typeof session.expiresAt === 'number'
  );
}

export async function createDemoSessionToken(session: DemoSession): Promise<string> {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(session)));
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function readDemoSessionToken(token?: string | null): Promise<DemoSession | null> {
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  try {
    const key = await getSigningKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlToBytes(signature),
      encoder.encode(payload),
    );
    if (!valid) return null;

    const parsed = JSON.parse(decoder.decode(base64UrlToBytes(payload))) as unknown;
    if (!isDemoSession(parsed)) return null;
    if (parsed.expiresAt <= Date.now()) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function getDemoSessionCookieOptions(maxAge = DEMO_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
  };
}
