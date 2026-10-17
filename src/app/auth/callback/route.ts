import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import {
  prepareAuthenticatedResponse,
  privateAuthResponse,
} from '@/lib/auth/callback-response';

function getSafeRedirectPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  return value;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const code = searchParams.get('code');
  const defaultNext = type === 'recovery' ? '/reset-password' : '/dashboard';
  const next = getSafeRedirectPath(searchParams.get('next')) ?? defaultNext;
  const isRecovery = type === 'recovery' || next === '/reset-password';

  // Keep the callback URL understood by installed native clients. Browsers must
  // confirm with a POST so email security scanners cannot spend the token on GET.
  if (token_hash && type === 'recovery') {
    const confirmation = new URL('/auth/recovery', origin);
    confirmation.searchParams.set('token_hash', token_hash);
    return privateAuthResponse(NextResponse.redirect(confirmation));
  }

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
    if (isRecovery && error?.code === 'pkce_code_verifier_not_found') {
      return privateAuthResponse(NextResponse.redirect(
        `${origin}/login?error=recovery_browser_mismatch`
      ));
    }
  }

  // Auth code exchange failed. Recovery links are one-time use, so give the
  // login page enough context to explain how to request a fresh link.
  const error = isRecovery ? 'recovery_link_invalid' : 'auth_callback_error';
  return privateAuthResponse(NextResponse.redirect(`${origin}/login?error=${error}`));
}
