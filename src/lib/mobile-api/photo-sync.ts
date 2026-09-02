import type { MobileDailyLogPhotoSyncOperation } from '@railcommand/domain';
import { isValidPhotoSyncOperation } from '@railcommand/domain';
import { getBucket, sanitizeFilename } from '@/lib/attachments-shared';
import type { MobileAuthenticatedContext } from './auth';
import { canCreateMobileDailyLog } from './authorization';
import { mobileQueryFailureStatus, type MobileQueryResult } from './query-failure';

export type AuthorizedMobilePhoto = {
  ok: true;
  bucket: string;
  path: string;
};

export type RejectedMobilePhoto = {
  ok: false;
  error: string;
  status: number;
  retryable: boolean;
};

function rejectQueryFailure(results: MobileQueryResult[], message: string, profileResult?: MobileQueryResult): RejectedMobilePhoto | null {
  let status = mobileQueryFailureStatus(results);
  if (!status) return null;
  if (status !== 401 && profileResult?.error?.code === 'PGRST116') status = 403;
  return {
    ok: false,
    error: status === 401 ? 'Not authenticated' : status === 403 ? 'Permission denied' : message,
    status: status === 500 ? 503 : status,
    retryable: status === 500,
  };
}

export async function authorizeMobilePhotoOperation(
  context: MobileAuthenticatedContext,
  operation: MobileDailyLogPhotoSyncOperation,
): Promise<AuthorizedMobilePhoto | RejectedMobilePhoto> {
  if (!isValidPhotoSyncOperation(operation) || operation.userId !== context.user.id) {
    return { ok: false, error: 'Invalid photo synchronization operation', status: 400, retryable: false };
  }

  const [profileResult, membershipResult] =
    await Promise.all([
      context.supabase.from('profiles').select('role').eq('id', context.user.id).single(),
      context.supabase
        .from('project_members')
        .select('project_role, can_edit')
        .eq('project_id', operation.projectId)
        .eq('profile_id', context.user.id)
        .maybeSingle(),
    ]);
  const accessFailure = rejectQueryFailure([profileResult, membershipResult], 'Could not verify project access', profileResult);
  if (accessFailure) return accessFailure;
  const { data: profile } = profileResult;
  const { data: membership } = membershipResult;
  if (!canCreateMobileDailyLog({
    organizationRole: profile?.role ?? null,
    projectRole: membership?.project_role ?? null,
    canEdit: membership?.can_edit ?? false,
  })) {
    return { ok: false, error: 'Permission denied', status: 403, retryable: false };
  }

  const parentResult = await context.supabase
    .from('daily_logs')
    .select('id')
    .eq('id', operation.parentEntityId)
    .eq('project_id', operation.projectId)
    .eq('created_by', context.user.id)
    .maybeSingle();
  const parentFailure = rejectQueryFailure([parentResult], 'Could not verify the parent daily log');
  if (parentFailure) return parentFailure;
  if (!parentResult.data) {
    return { ok: false, error: 'The parent daily log is unavailable', status: 409, retryable: true };
  }

  const bucket = getBucket(operation.payload.photoCategory);
  const path = `${operation.projectId}/daily_log/${operation.parentEntityId}/${operation.operationId}-${sanitizeFilename(operation.payload.fileName)}`;
  return { ok: true, bucket, path };
}

export function isRetryablePhotoDatabaseError(code: string | undefined): boolean {
  if (!code) return true;
  return code !== '42501' && !code.startsWith('22') && !code.startsWith('23');
}
