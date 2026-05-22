import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

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
  const next = getSafeRedirectPath(searchParams.get('next')) ?? '/dashboard';

  // Email confirmation via token_hash (e.g. signup confirmation)
  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType });
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next === '/dashboard' ? '/onboarding' : next}`);
      response.cookies.set('rc-remember', 'true', {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
      });
      response.cookies.delete('rc-mode');
      return response;
    }
  }

  // PKCE code exchange (Google OAuth)
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(`${origin}${next}`);
      // Set rc-remember cookie so middleware doesn't sign the user out.
      // Users arriving via email confirmation or OAuth should stay logged in.
      response.cookies.set('rc-remember', 'true', {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
      });
      response.cookies.delete('rc-mode');
      return response;
    }
  }

  // Auth code exchange failed — send back to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
