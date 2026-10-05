import type { MobileAccountDeletionRequest } from '@railcommand/domain';
import { accountDeletionHttpStatus, getActiveAccountDeletion, submitAccountDeletion } from '@/lib/account-deletion';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function GET(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  try {
    return mobileJson(await getActiveAccountDeletion(context.supabase, context.user.id));
  } catch {
    return mobileJson({ error: 'Could not load the account deletion request' }, 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const body = await request.json().catch(() => null) as Partial<MobileAccountDeletionRequest> | null;
  if (!body?.clientRequestId || !/^[0-9a-f-]{36}$/i.test(body.clientRequestId)) {
    return mobileJson({ error: 'Invalid deletion request identifier' }, 400);
  }
  const counts = body.localWork;
  if (!counts || ![counts.drafts, counts.outbox, counts.photos]
    .every((count) => Number.isSafeInteger(count) && count >= 0)) {
    return mobileJson({ error: 'Invalid device-work attestation' }, 400);
  }
  try {
    return mobileJson(await submitAccountDeletion(
      context.supabase,
      context.accessToken,
      body as MobileAccountDeletionRequest,
      'mobile',
    ), 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not process the account deletion request';
    return mobileJson({ error: message }, accountDeletionHttpStatus(message));
  }
}
