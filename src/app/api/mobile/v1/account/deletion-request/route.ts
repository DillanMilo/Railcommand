import type { MobileAccountDeletionRequest, MobileAccountDeletionResult } from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const body = await request.json().catch(() => null) as Partial<MobileAccountDeletionRequest> | null;
  if (!body?.clientRequestId || !/^[0-9a-f-]{36}$/i.test(body.clientRequestId)) {
    return mobileJson({ error: 'Invalid deletion request identifier' }, 400);
  }

  const { data: existing } = await context.supabase.from('account_deletion_requests')
    .select('id, status, requested_at, scheduled_for')
    .eq('profile_id', context.user.id).in('status', ['pending', 'reviewing']).maybeSingle();
  if (existing) {
    const result: MobileAccountDeletionResult = { id: existing.id, status: existing.status,
      requestedAt: existing.requested_at, scheduledFor: existing.scheduled_for, duplicate: true };
    return mobileJson(result);
  }

  const { data, error } = await context.supabase.from('account_deletion_requests').insert({
    profile_id: context.user.id,
    client_request_id: body.clientRequestId,
    status: 'pending',
  }).select('id, status, requested_at, scheduled_for').single();
  if (error || !data) return mobileJson({ error: 'Could not create the account deletion request' }, 500);
  const result: MobileAccountDeletionResult = { id: data.id, status: data.status,
    requestedAt: data.requested_at, scheduledFor: data.scheduled_for, duplicate: false };
  return mobileJson(result, 201);
}
