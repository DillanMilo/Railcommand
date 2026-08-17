'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  CLIENT_DASHBOARD_COOKIE,
  getDashboardPassword,
  getGateSignature,
  safeCompare,
} from './gate';

const UNLOCK_WINDOW_MS = 15 * 60 * 1000;
const UNLOCK_ATTEMPT_LIMIT = 12;

const unlockAttempts = new Map<string, { count: number; resetAt: number }>();

function checkUnlockRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = unlockAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    unlockAttempts.set(key, { count: 1, resetAt: now + UNLOCK_WINDOW_MS });
    return true;
  }

  if (entry.count >= UNLOCK_ATTEMPT_LIMIT) return false;
  entry.count += 1;
  return true;
}

async function getRequestKey(): Promise<string> {
  const headerStore = await headers();
  return (
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export async function unlockClientDashboard(formData: FormData) {
  const password = getDashboardPassword();
  if (!password) redirect('/client?error=config');

  if (!checkUnlockRateLimit(await getRequestKey())) {
    redirect('/client?error=rate');
  }

  const entered = String(formData.get('password') ?? '');
  if (!safeCompare(entered, password)) {
    redirect('/client?error=invalid');
  }

  const signature = getGateSignature();
  if (!signature) redirect('/client?error=config');

  (await cookies()).set(CLIENT_DASHBOARD_COOKIE, signature, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/client',
    maxAge: 60 * 60 * 8,
  });

  redirect('/client');
}

export async function lockClientDashboard() {
  (await cookies()).set(CLIENT_DASHBOARD_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/client',
    maxAge: 0,
  });

  redirect('/client');
}
