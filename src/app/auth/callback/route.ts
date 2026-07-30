import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { DEMO_SESSION_COOKIE, DEMO_SLUG_COOKIE } from '@/lib/demo/session-cookie';
import {
  createPasswordRecoveryToken,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_TTL_SECONDS,
} from '@/lib/auth/password-recovery';

function getSafeRedirectPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  return value;
}

function clearDemoSlugCookie(response: NextResponse): void {
  response.cookies.set(DEMO_SLUG_COOKIE, '', {
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });
}

function prepareAuthenticatedResponse(
  response: NextResponse,
  isRecovery: boolean,
  userId?: string
): NextResponse {
  response.cookies.set('rc-remember', 'true', {
    path: '/',
    maxAge: isRecovery ? 15 * 60 : 60 * 60 * 24 * 7,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  if (isRecovery && userId) {
    response.cookies.set(
      PASSWORD_RECOVERY_COOKIE,
      createPasswordRecoveryToken(userId),
      {
        httpOnly: true,
        path: '/',
        maxAge: PASSWORD_RECOVERY_TTL_SECONDS,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      }
    );
  } else {
    response.cookies.delete(PASSWORD_RECOVERY_COOKIE);
  }

  response.cookies.delete('rc-mode');
  response.cookies.delete(DEMO_SESSION_COOKIE);
  clearDemoSlugCookie(response);
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');
  const defaultNext = type === 'recovery' ? '/reset-password' : '/dashboard';
  const next = getSafeRedirectPath(searchParams.get('next')) ?? defaultNext;
  const isRecovery = type === 'recovery' || next === '/reset-password';

  // Email confirmation via token_hash (e.g. signup confirmation)
  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    });
    if (!error) {
      const target = type === 'recovery'
        ? '/reset-password'
        : next === '/dashboard'
          ? '/onboarding'
          : next;
      const response = NextResponse.redirect(`${origin}${target}`);
      return prepareAuthenticatedResponse(response, isRecovery, data.user?.id);
    }
  }

  // PKCE code exchange (OAuth and legacy email recovery links)
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const target = isRecovery ? '/reset-password' : next;
      const response = NextResponse.redirect(`${origin}${target}`);
      return prepareAuthenticatedResponse(
        response,
        isRecovery,
        data.session?.user.id
      );
    }
  }

  // Auth code exchange failed. Recovery links are one-time use, so give the
  // login page enough context to explain how to request a fresh link.
  const error = isRecovery ? 'recovery_link_invalid' : 'auth_callback_error';
  return NextResponse.redirect(`${origin}/login?error=${error}`);
}
