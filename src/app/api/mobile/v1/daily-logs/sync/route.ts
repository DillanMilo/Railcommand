import { isValidSyncOperation, type MobileDailyLogSyncResult } from '@railcommand/domain';
import { authenticateMobileRequest, mobileJson } from '@/lib/mobile-api/auth';
import { canCreateMobileDailyLog } from '@/lib/mobile-api/authorization';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 64 * 1024) return mobileJson({ error: 'Payload too large' }, 413);

  const operation: unknown = await request.json().catch(() => null);
  if (!isValidSyncOperation(operation) || operation.userId !== context.user.id) {
    return mobileJson({ error: 'Invalid synchronization operation' }, 400);
  }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    context.supabase.from('profiles').select('role').eq('id', context.user.id).single(),
    context.supabase
      .from('project_members')
      .select('project_role, can_edit')
      .eq('project_id', operation.projectId)
      .eq('profile_id', context.user.id)
      .maybeSingle(),
  ]);
  if (!canCreateMobileDailyLog({
    organizationRole: profile?.role ?? null,
    projectRole: membership?.project_role ?? null,
    canEdit: membership?.can_edit ?? false,
  })) {
    return mobileJson({ error: 'Permission denied' }, 403);
  }

  const { data, error } = await context.supabase.rpc('sync_daily_log_create', {
    p_project_id: operation.projectId,
    p_client_id: operation.clientId,
    p_idempotency_key: operation.idempotencyKey,
    p_payload: operation.payload,
  });
  if (error) {
    const permanent = error.code === '42501'
      || error.code?.startsWith('22')
      || error.code?.startsWith('23');
    return mobileJson({ error: error.message, retryable: !permanent }, permanent ? 400 : 503);
  }

  const record = data as {
    id: string;
    project_id: string;
    duplicate: boolean;
  };
  const result: MobileDailyLogSyncResult = {
    id: record.id,
    projectId: record.project_id,
    duplicate: record.duplicate,
  };
  return mobileJson(result);
}
