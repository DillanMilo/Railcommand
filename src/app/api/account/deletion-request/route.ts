import type { MobileAccountDeletionRequest } from '@railcommand/domain';
import { accountDeletionHttpStatus, getActiveAccountDeletion, submitAccountDeletion } from '@/lib/account-deletion';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function authenticatedContext() {
  const supabase = await createClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  const user = userData.user;
  const accessToken = sessionData.session?.access_token;
  return user && accessToken ? { supabase, user, accessToken } : null;
}

export async function GET(): Promise<Response> {
  const context = await authenticatedContext();
  if (!context) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  try {
    return Response.json(await getActiveAccountDeletion(context.supabase, context.user.id));
  } catch {
    return Response.json({ error: 'Could not load the account deletion request' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const context = await authenticatedContext();
  if (!context) return Response.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await request.json().catch(() => null) as Partial<MobileAccountDeletionRequest> | null;
  if (!body?.clientRequestId || !/^[0-9a-f-]{36}$/i.test(body.clientRequestId)) {
    return Response.json({ error: 'Invalid deletion request identifier' }, { status: 400 });
  }
  const counts = body.localWork;
  if (!counts || ![counts.drafts, counts.outbox, counts.photos]
    .every((count) => Number.isSafeInteger(count) && count >= 0)) {
    return Response.json({ error: 'Invalid device-work attestation' }, { status: 400 });
  }
  try {
    return Response.json(await submitAccountDeletion(
      context.supabase,
      context.accessToken,
      body as MobileAccountDeletionRequest,
      'web',
    ), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not process the account deletion request';
    return Response.json({ error: message }, { status: accountDeletionHttpStatus(message) });
  }
}
