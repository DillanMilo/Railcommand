import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prepareAuthenticatedResponse, privateAuthResponse } from '@/lib/auth/callback-response';

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  // A foreign page must not be able to switch the user's signed-in identity.
  if (request.headers.get('origin') !== origin) {
    return privateAuthResponse(NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 }));
  }

  let token: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    token = form.get('token_hash');
  } catch {
    return privateAuthResponse(NextResponse.json({ error: 'Invalid confirmation form.' }, { status: 400 }));
  }
  if (typeof token !== 'string' || !token || token.length > 1024) {
    return privateAuthResponse(NextResponse.redirect(`${origin}/login?error=recovery_link_invalid`, 303));
  }

  const retry = () => {
    const url = new URL('/auth/recovery', origin);
    url.searchParams.set('token_hash', token);
    url.searchParams.set('error', 'temporarily_unavailable');
    return privateAuthResponse(NextResponse.redirect(url, 303));
  };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: token, type: 'recovery' });
    if (error) {
      if (!error.status || error.status >= 500 || error.status === 429) return retry();
      return privateAuthResponse(NextResponse.redirect(`${origin}/login?error=recovery_link_invalid`, 303));
    }
    if (!data.session || !data.user) return retry();
    return prepareAuthenticatedResponse(
      NextResponse.redirect(`${origin}/reset-password`, 303), true, data.user.id
    );
  } catch {
    return retry();
  }
}
