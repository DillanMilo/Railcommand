'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { provisionBetaAccount, type BetaAccountInput, type BetaAccountResult } from '@/lib/beta-accounts';
import { ZodError } from 'zod';
import {
  CLIENT_DASHBOARD_COOKIE,
  getDashboardPassword,
  getGateSignature,
  safeCompare,
  isDashboardSession,
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

export async function createBetaAccount(input: BetaAccountInput): Promise<
  { account: BetaAccountResult } | { error: string }
> {
  const cookie = (await cookies()).get(CLIENT_DASHBOARD_COOKIE)?.value;
  if (!isDashboardSession(cookie)) return { error: 'Unlock the owner console before creating an invitation.' };
  try {
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) return { error: 'The RailCommand invitation URL is not configured.' };
    const account = await provisionBetaAccount(createAdminClient(), input, siteUrl);
    revalidatePath('/client');
    return { account };
  } catch (error) {
    if (error instanceof ZodError) return { error: error.issues[0]?.message ?? 'Check the invitation fields.' };
    return { error: error instanceof Error ? error.message : 'Could not create the invitation. Retry with the same email.' };
  }
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
