import { isValidSyncOperation, type MobileDailyLogSyncResult } from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson, mobileOptions } from '@/lib/mobile-api/auth';
import { canCreateMobileDailyLog } from '@/lib/mobile-api/authorization';
import { mobileQueryFailed, mobileQueryFailureStatus } from '@/lib/mobile-api/query-failure';

export const dynamic = 'force-dynamic';
export const OPTIONS = mobileOptions;

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 64 * 1024) return mobileJson({ error: 'Payload too large' }, 413);

  const operation: unknown = await request.json().catch(() => null);
  if (!isValidSyncOperation(operation) || operation.userId !== context.user.id) {
    return mobileJson({ error: 'Invalid synchronization operation' }, 400);
  }

  const [profileResult, membershipResult] = await Promise.all([
    context.supabase.from('profiles').select('role').eq('id', context.user.id).single(),
    context.supabase
      .from('project_members')
      .select('project_role, can_edit')
      .eq('project_id', operation.projectId)
      .eq('profile_id', context.user.id)
      .maybeSingle(),
  ]);
  const accessFailure = mobileQueryFailureStatus([profileResult, membershipResult]);
  if (accessFailure) {
    if (accessFailure === 401) return mobileJson({ error: 'Not authenticated', retryable: false }, 401);
    const denied = accessFailure === 403 || profileResult.error?.code === 'PGRST116';
    return mobileJson({ error: denied ? 'Permission denied' : 'Could not verify project access', retryable: !denied }, denied ? 403 : 503);
  }
  const { data: profile } = profileResult;
  const { data: membership } = membershipResult;
  if (!canCreateMobileDailyLog({
    organizationRole: profile?.role ?? null,
    projectRole: membership?.project_role ?? null,
    canEdit: membership?.can_edit ?? false,
  })) {
    return mobileJson({ error: 'Permission denied' }, 403);
  }

  const rpcResult = await context.supabase.rpc('sync_daily_log_create', {
    p_project_id: operation.projectId,
    p_client_id: operation.clientId,
    p_idempotency_key: operation.idempotencyKey,
    p_payload: operation.payload,
  });
  if (mobileQueryFailed(rpcResult)) {
    const status = mobileQueryFailureStatus([rpcResult]);
    if (status === 401) return mobileJson({ error: 'Not authenticated', retryable: false }, 401);
    if (status === 403) return mobileJson({ error: 'Permission denied', retryable: false }, 403);
    if (rpcResult.error?.code === '23505') {
      const sameDate = rpcResult.error.message?.includes('daily_logs_project_id_log_date_key');
      return mobileJson({
        error: sameDate
          ? 'A daily log already exists for this project and date. This queued log and its photos are still on your device; nothing was overwritten. Review the existing daily log before resolving this conflict.'
          : 'This queued log conflicts with an existing record. Your work remains on this device; nothing was overwritten.',
        retryable: false,
      }, 409);
    }
    const invalid = rpcResult.error?.code?.startsWith('22') || rpcResult.error?.code?.startsWith('23');
    return mobileJson({ error: invalid ? 'The daily log could not be accepted. Review the saved field values.' : 'Daily-log synchronization is temporarily unavailable', retryable: !invalid }, invalid ? 400 : 503);
  }

  const record = rpcResult.data as {
    id: string;
    project_id: string;
    duplicate: boolean;
  };
  if (!record || typeof record.id !== 'string' || typeof record.project_id !== 'string'
    || typeof operation.clientId !== 'string'
    || record.id.toLowerCase() !== operation.clientId.toLowerCase()
    || record.project_id.toLowerCase() !== operation.projectId.toLowerCase()
    || typeof record.duplicate !== 'boolean') {
    return mobileJson({ error: 'Daily-log synchronization returned an invalid receipt', retryable: true }, 503);
  }
  const result: MobileDailyLogSyncResult = {
    id: record.id,
    projectId: record.project_id,
    duplicate: record.duplicate,
  };
  return mobileJson(result);
}
