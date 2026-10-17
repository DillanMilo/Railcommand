import { NextResponse } from 'next/server';
import { DEMO_SESSION_COOKIE, DEMO_SLUG_COOKIE } from '@/lib/demo/session-cookie';
import {
  createPasswordRecoveryToken,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_TTL_SECONDS,
} from '@/lib/auth/password-recovery';

export function privateAuthResponse(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

export function prepareAuthenticatedResponse(
  response: NextResponse,
  isRecovery: boolean,
  userId?: string
): NextResponse {
  response.cookies.set('rc-remember', 'true', {
    path: '/',
    maxAge: isRecovery ? PASSWORD_RECOVERY_TTL_SECONDS : 60 * 60 * 24 * 7,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  if (isRecovery && userId) {
    response.cookies.set(PASSWORD_RECOVERY_COOKIE, createPasswordRecoveryToken(userId), {
      httpOnly: true,
      path: '/',
      maxAge: PASSWORD_RECOVERY_TTL_SECONDS,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  } else {
    response.cookies.delete(PASSWORD_RECOVERY_COOKIE);
  }

  response.cookies.delete('rc-mode');
  response.cookies.delete(DEMO_SESSION_COOKIE);
  response.cookies.set(DEMO_SLUG_COOKIE, '', {
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
  return privateAuthResponse(response);
}
