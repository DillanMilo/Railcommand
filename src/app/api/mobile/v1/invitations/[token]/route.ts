import type { MobileInvitation } from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

function validToken(token: string) { return /^[a-f0-9]{32,128}$/i.test(token); }

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const { token } = await params;
  if (!validToken(token)) return mobileJson({ error: 'Invalid invitation' }, 400);
  const email = context.user.email?.toLowerCase();
  if (!email) return mobileJson({ error: 'Your account does not have an email address' }, 400);
  const { data, error } = await context.supabase.from('project_invitations')
    .select('token, project_id, email, project_role, expires_at, project:projects(name)')
    .eq('token', token).eq('email', email).eq('status', 'pending').gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error || !data) return mobileJson({ error: 'Invitation not found, expired, or intended for another account' }, 404);
  const project = data.project as unknown as { name: string } | null;
  const invitation: MobileInvitation = { token: data.token, projectId: data.project_id,
    projectName: project?.name ?? 'RailCommand project', email: data.email,
    role: data.project_role, expiresAt: data.expires_at };
  return mobileJson(invitation);
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const { token } = await params;
  if (!validToken(token)) return mobileJson({ error: 'Invalid invitation' }, 400);
  const { data, error } = await context.supabase.rpc('accept_mobile_project_invitation', { p_token: token });
  if (error || !data) return mobileJson({ error: error?.message ?? 'Could not accept invitation' }, 400);
  return mobileJson({ projectId: data });
}
