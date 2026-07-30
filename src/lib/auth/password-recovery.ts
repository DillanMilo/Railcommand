import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export const PASSWORD_RECOVERY_COOKIE = 'rc-password-recovery';
export const PASSWORD_RECOVERY_TTL_SECONDS = 15 * 60;

function getRecoverySecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for password recovery');
  }
  return secret;
}

function signPayload(payload: string): string {
  return createHmac('sha256', getRecoverySecret())
    .update(payload)
    .digest('base64url');
}

export function createPasswordRecoveryToken(userId: string): string {
  const expiresAt =
    Math.floor(Date.now() / 1000) + PASSWORD_RECOVERY_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  return `${expiresAt}.${signPayload(payload)}`;
}

export function isValidPasswordRecoveryToken(
  token: string | undefined,
  userId: string
): boolean {
  if (!token) return false;

  const [expiresAtValue, signature, ...rest] = token.split('.');
  if (!expiresAtValue || !signature || rest.length > 0) return false;

  const expiresAt = Number(expiresAtValue);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() / 1000) {
    return false;
  }

  const expected = Buffer.from(
    signPayload(`${userId}.${expiresAtValue}`),
    'utf8'
  );
  const actual = Buffer.from(signature, 'utf8');

  return (
    actual.length === expected.length &&
    timingSafeEqual(actual, expected)
  );
}
