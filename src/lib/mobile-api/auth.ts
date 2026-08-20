import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

export type MobileAuthenticatedContext = {
  accessToken: string;
  supabase: SupabaseClient;
  user: User;
};

export function parseBearerAuthorization(value: string | null): string | null {
  if (!value) return null;
  const match = /^Bearer ([^\s]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

export async function authenticateMobileRequest(
  request: Request,
): Promise<MobileAuthenticatedContext | null> {
  const accessToken = parseBearerAuthorization(request.headers.get('authorization'));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken || !supabaseUrl || !publishableKey) return null;

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) return null;
  return { accessToken, supabase, user };
}

export function mobileJson(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      Vary: 'Authorization',
    },
  });
}
