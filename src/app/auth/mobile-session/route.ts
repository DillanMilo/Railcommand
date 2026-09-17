import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { openWorkspaceTicket, workspacePostAllowed } from '@/lib/mobile-api/workspace-ticket';
import { evaluateMobilePilotAccess } from '@/lib/mobile-api/pilot-gate';
import { fetchWithTimeout } from '@/lib/supabase/connectivity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store, max-age=0', 'Referrer-Policy': 'no-referrer', Pragma: 'no-cache' };
function denied() { return new Response('The workspace sign-in expired. Return to the app and try again.', { status: 403, headers }); }
export async function POST(request: Request) {
  try {
    if (process.env.MOBILE_WORKSPACE_ENABLED !== 'true' || !workspacePostAllowed(request)) return denied();
    const raw = await request.text();
    if (raw.length > 5000) return denied();
    const ticket = openWorkspaceTicket(new URLSearchParams(raw).get('ticket'), process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
    const cookies: { name: string; value: string; options: CookieOptions }[] = [];
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { fetch: fetchWithTimeout },
      // Deliberately ignore any existing page session. This creates an independent
      // session and writes its cookies only after identity and pilot verification.
      cookies: { getAll: () => [], setAll: (values) => { cookies.push(...values); } },
    });
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: ticket.tokenHash, type: 'email' });
    if (error || data.user?.id !== ticket.sub || !data.session || data.user.factors?.some((factor) => factor.status === 'verified')) return denied();
    const decision = evaluateMobilePilotAccess({ authorization: `Bearer ${data.session.access_token}`, env: { MOBILE_BACKEND_ENV: process.env.MOBILE_BACKEND_ENV, MOBILE_PILOT_MODE: process.env.MOBILE_PILOT_MODE, MOBILE_PILOT_USER_IDS: process.env.MOBILE_PILOT_USER_IDS, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL }, method: 'POST', pathname: '/api/mobile/v1/web-session' });
    if (!decision.allowed) return denied();
    const response = NextResponse.redirect(new URL(ticket.next, request.url), { status: 303, headers });
    for (const { name, value, options } of cookies) response.cookies.set(name, value, { ...options, secure: true, sameSite: 'lax' });
    response.cookies.set('rc-remember', 'true', { path: '/', secure: true, sameSite: 'lax', httpOnly: true });
    return response;
  } catch { return denied(); }
}
