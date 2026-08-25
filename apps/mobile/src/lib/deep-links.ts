import type { EmailOtpType } from '@supabase/supabase-js';
import { parseMobileDeepLink } from '@railcommand/domain';
import { supabase } from './supabase';

export async function consumeAuthCallback(rawUrl: string): Promise<'authenticated' | 'password-reset' | 'ignored'> {
  const url = new URL(rawUrl);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) throw error;
  } else if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  } else if (parseMobileDeepLink(rawUrl).kind !== 'auth_callback') {
    return 'ignored';
  }
  return type === 'recovery' || url.searchParams.get('next') === '/reset-password'
    ? 'password-reset'
    : 'authenticated';
}
