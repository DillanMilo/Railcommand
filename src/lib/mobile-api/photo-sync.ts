import type { MobileDailyLogPhotoSyncOperation } from '@railcommand/domain';
import { isValidPhotoSyncOperation } from '@railcommand/domain';
import { getBucket, sanitizeFilename } from '@/lib/attachments-shared';
import type { MobileAuthenticatedContext } from './auth';
import { canCreateMobileDailyLog } from './authorization';

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

export async function authorizeMobilePhotoOperation(
  context: MobileAuthenticatedContext,
  operation: MobileDailyLogPhotoSyncOperation,
): Promise<AuthorizedMobilePhoto | RejectedMobilePhoto> {
  if (!isValidPhotoSyncOperation(operation) || operation.userId !== context.user.id) {
    return { ok: false, error: 'Invalid photo synchronization operation', status: 400, retryable: false };
  }

  const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] =
    await Promise.all([
      context.supabase.from('profiles').select('role').eq('id', context.user.id).single(),
      context.supabase
        .from('project_members')
        .select('project_role, can_edit')
        .eq('project_id', operation.projectId)
        .eq('profile_id', context.user.id)
        .maybeSingle(),
    ]);
  if (profileError || membershipError) {
    return { ok: false, error: 'Could not verify project access', status: 503, retryable: true };
  }
  if (!canCreateMobileDailyLog({
    organizationRole: profile?.role ?? null,
    projectRole: membership?.project_role ?? null,
    canEdit: membership?.can_edit ?? false,
  })) {
    return { ok: false, error: 'Permission denied', status: 403, retryable: false };
  }

  const { data: parent, error: parentError } = await context.supabase
    .from('daily_logs')
    .select('id')
    .eq('id', operation.parentEntityId)
    .eq('project_id', operation.projectId)
    .eq('created_by', context.user.id)
    .maybeSingle();
  if (parentError) {
    return { ok: false, error: 'Could not verify the parent daily log', status: 503, retryable: true };
  }
  if (!parent) {
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
