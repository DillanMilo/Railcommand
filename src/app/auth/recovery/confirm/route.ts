import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prepareAuthenticatedResponse, privateAuthResponse } from '@/lib/auth/callback-response';
import { isRecoveryConfirmationNonce, recoveryConfirmationCookieName } from '@/lib/auth/recovery-confirmation';

export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url);
  const requestOrigin = request.headers.get('origin');
  // no-referrer can legitimately serialize an HTML form's Origin as "null".
  // A matching first-party cookie + form nonce is mandatory for EVERY request;
  // explicit foreign origins and cross-site fetch metadata are still denied.
  if ((requestOrigin && requestOrigin !== 'null' && requestOrigin !== origin) ||
      request.headers.get('sec-fetch-site') === 'cross-site') {
    return privateAuthResponse(NextResponse.redirect(`${origin}/login?error=recovery_confirmation_required`, 303));
  }

  let token: FormDataEntryValue | null;
  let confirmation: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    token = form.get('token_hash');
    confirmation = form.get('confirmation');
  } catch {
    return privateAuthResponse(NextResponse.redirect(`${origin}/login?error=recovery_confirmation_required`, 303));
  }
  if (typeof token !== 'string' || !token || token.length > 1024) {
    return privateAuthResponse(NextResponse.redirect(`${origin}/login?error=recovery_link_invalid`, 303));
  }

  const retry = (error: string) => {
    const url = new URL('/auth/recovery', origin);
    url.searchParams.set('token_hash', token);
    url.searchParams.set('error', error);
    return privateAuthResponse(NextResponse.redirect(url, 303));
  };

  const nonce = request.cookies.get(recoveryConfirmationCookieName())?.value;
  if (!isRecoveryConfirmationNonce(nonce) || !isRecoveryConfirmationNonce(confirmation) ||
      !timingSafeEqual(Buffer.from(nonce), Buffer.from(confirmation))) {
    return retry('confirmation_required');
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' });
    if (error) {
      if (!error.status || error.status >= 500 || error.status === 429) return retry('temporarily_unavailable');
      return privateAuthResponse(NextResponse.redirect(`${origin}/login?error=recovery_link_invalid`, 303));
    }
    if (!data.session || !data.user) return retry('temporarily_unavailable');
    const response = prepareAuthenticatedResponse(
      NextResponse.redirect(`${origin}/reset-password`, 303), true, data.user.id
    );
    response.cookies.set(recoveryConfirmationCookieName(), '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch {
    return retry('temporarily_unavailable');
  }
}
