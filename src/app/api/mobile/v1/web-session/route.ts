import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import { evaluateMobilePilotAccess } from '@/lib/mobile-api/pilot-gate';
import { sealWorkspaceTicket, workspacePath } from '@/lib/mobile-api/workspace-ticket';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  try {
    const context = await authenticateMobileRequest(request);
    if (!context) return mobileJson({ error: 'Sign in to open the workspace.' }, 401);
    if (process.env.MOBILE_WORKSPACE_ENABLED !== 'true' || !evaluateMobilePilotAccess({ authorization: `Bearer ${context.accessToken}`, env: { MOBILE_BACKEND_ENV: process.env.MOBILE_BACKEND_ENV, MOBILE_PILOT_MODE: process.env.MOBILE_PILOT_MODE, MOBILE_PILOT_USER_IDS: process.env.MOBILE_PILOT_USER_IDS, NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL }, method: 'POST', pathname: '/api/mobile/v1/web-session' }).allowed) return mobileJson({ error: 'The workspace is not enabled for this account yet.' }, 403);
    const user = context.user;
    // Never manufacture a passwordless session for an unconfirmed identity or
    // downgrade an account with verified MFA. Native refresh tokens stay native.
    if (!user.email || !user.email_confirmed_at || user.is_anonymous || user.factors?.some((factor) => factor.status === 'verified')) return mobileJson({ error: 'This account requires browser sign-in. Please use the website for now.' }, 403);
    const raw = await request.text();
    if (raw.length > 2048) return mobileJson({ error: 'Invalid workspace request.' }, 400);
    let body: { path?: unknown };
    try { body = JSON.parse(raw || '{}'); } catch { return mobileJson({ error: 'Invalid workspace request.' }, 400); }
    if (!body || typeof body !== 'object') return mobileJson({ error: 'Invalid workspace request.' }, 400);
    // Generates a single-use OTP without sending email. It is sealed immediately;
    // no service key, native token or plaintext OTP is returned to the client.
    const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'magiclink', email: user.email });
    if (error || data.user?.id !== user.id || !data.properties?.hashed_token) return mobileJson({ error: 'Could not open the workspace. Please try again.' }, 503);
    const ticket = sealWorkspaceTicket({ sub: user.id, tokenHash: data.properties.hashed_token, next: workspacePath(body.path) }, process.env.SUPABASE_SERVICE_ROLE_KEY ?? '');
    return mobileJson({ ticket, userId: user.id });
  } catch {
    return mobileJson({ error: 'Could not open the workspace. Please try again.' }, 503);
  }
}
