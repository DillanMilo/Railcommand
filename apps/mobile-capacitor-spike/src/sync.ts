import {
  photoToSyncOperation,
  type MobileDailyLogPhotoPrepareResult,
  type MobileDailyLogSyncOperation,
  type MobilePhotoRecord,
} from '@railcommand/domain';
import {
  coalesceMobileOutbox,
  completeMobilePhoto,
  completeMobileOutbox,
  listMobileOutbox,
  listMobilePhotosForOperation,
  updateMobileOutbox,
} from '@railcommand/offline';
import { MobileApiClient, MobileApiError } from '@railcommand/api-client';

export type SignedPhotoUploader = (
  prepared: MobileDailyLogPhotoPrepareResult,
  photo: MobilePhotoRecord,
) => Promise<void>;

export const uploadSignedPhoto: SignedPhotoUploader = async (prepared, photo) => {
  const { supabase } = await import('./supabase');
  const { error } = await supabase.storage
    .from(prepared.bucket)
    .uploadToSignedUrl(prepared.path, prepared.token, photo.blob, {
      contentType: photo.fileType,
      cacheControl: '3600',
    });
  if (error) throw error;
};

export function retryOperation(
  operation: MobileDailyLogSyncOperation,
  error: string,
  now = new Date(),
): MobileDailyLogSyncOperation {
  const attemptCount = operation.attemptCount + 1;
  const failed = attemptCount >= 5;
  const delay = Math.min(2_000 * 2 ** Math.max(attemptCount - 1, 0), 60_000);
  return {
    ...operation,
    attemptCount,
    status: failed ? 'failed' : 'retry',
    lastError: error,
    updatedAt: now.toISOString(),
    nextAttemptAt: failed ? operation.nextAttemptAt : new Date(now.getTime() + delay).toISOString(),
  };
}

export async function synchronizeMobileOutbox(
  userId: string,
  api: MobileApiClient,
  uploadPhoto: SignedPhotoUploader = uploadSignedPhoto,
): Promise<{ synchronized: number; failed: number }> {
  await coalesceMobileOutbox(userId);
  const operations = await listMobileOutbox(userId);
  let synchronized = 0;
  let failed = 0;
  for (const operation of operations) {
    try {
      const parent = await api.syncDailyLog(operation);
      const photos = await listMobilePhotosForOperation(userId, operation.clientId);
      for (const photo of photos) {
        const photoOperation = photoToSyncOperation(userId, photo, parent.id);
        const prepared = await api.prepareDailyLogPhoto(photoOperation);
        await uploadPhoto(prepared, photo);
        await api.finalizeDailyLogPhoto(photoOperation, prepared);
        await completeMobilePhoto(userId, photo.photoId);
      }
      await completeMobileOutbox(userId, operation.operationId);
      synchronized += 1 + photos.length;
    } catch (error) {
      const retryable = !(error instanceof MobileApiError) || error.retryable;
      const next = retryable
        ? retryOperation(operation, error instanceof Error ? error.message : 'Synchronization failed')
        : { ...operation, status: 'failed' as const, lastError: error instanceof Error ? error.message : 'Synchronization failed' };
      await updateMobileOutbox(userId, next);
      failed += 1;
    }
  }
  return { synchronized, failed };
}
