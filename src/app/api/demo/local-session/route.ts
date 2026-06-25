import { NextRequest, NextResponse } from 'next/server';
import {
  createDemoSessionToken,
  DEMO_SESSION_COOKIE,
  DEMO_SESSION_MAX_AGE_SECONDS,
  DEMO_SLUG_COOKIE,
  getDemoSessionCookieOptions,
} from '@/lib/demo/session-cookie';

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT = 20;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getRequestIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ip = getRequestIp(request);
  if (!checkRateLimit(`demo-session:${ip}`)) {
    return NextResponse.json({ error: 'Too many demo requests' }, { status: 429 });
  }

  const now = Date.now();
  const expiresAt = now + DEMO_SESSION_MAX_AGE_SECONDS * 1000;
  const token = await createDemoSessionToken({
    mode: 'demo',
    projectId: 'proj-001',
    profileId: 'prof-001',
    issuedAt: now,
    expiresAt,
  });

  const response = NextResponse.json({ ok: true, expiresAt: new Date(expiresAt).toISOString() });
  response.cookies.set(DEMO_SESSION_COOKIE, token, getDemoSessionCookieOptions());
  response.cookies.set('rc-mode', 'demo', {
    maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_SESSION_COOKIE, '', getDemoSessionCookieOptions(0));
  response.cookies.set('rc-mode', '', {
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  response.cookies.set(DEMO_SLUG_COOKIE, '', {
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
