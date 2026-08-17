import { createHmac, timingSafeEqual } from 'crypto';

export const CLIENT_DASHBOARD_COOKIE = 'rc-client-dashboard-unlocked';
export const GATE_PURPOSE = 'client-dashboard';

export function getDashboardPassword(): string | null {
  const password = process.env.ADMIN_DASHBOARD_PASSWORD?.trim();
  return password && password.length >= 8 ? password : null;
}

export function getGateSignature(): string | null {
  const password = getDashboardPassword();
  if (!password) return null;
  return createHmac('sha256', password).update(GATE_PURPOSE).digest('hex');
}

export function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}
