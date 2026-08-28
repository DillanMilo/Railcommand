import { File } from 'expo-file-system';
import { MobileApiError } from '@railcommand/api-client';
import type { MobileDailyLogPhotoSyncOperation } from '@railcommand/domain';
import { mobileApi } from './api';
import { completeExpoSync, listExpoOutbox, listExpoPhotos, markExpoOutbox, markExpoPhoto, type ExpoDailyLogSyncOperation, type ExpoStoredPhoto } from './offline-store';
import { deleteOwnedFieldPhoto } from './device';
import { supabase } from './supabase';

function photoOperation(userId: string, photo: ExpoStoredPhoto, parentEntityId: string): MobileDailyLogPhotoSyncOperation {
  return { operationId: photo.photoId, userId, projectId: photo.projectId, parentEntityId,
    idempotencyKey: `daily-log-photo:${photo.photoId}`, payload: { fileName: photo.fileName,
      fileType: photo.fileType, fileSize: photo.size, photoCategory: 'standard',
      geoLat: photo.geoTag?.lat ?? null, geoLng: photo.geoTag?.lng ?? null, capturedAt: photo.capturedAt } };
}

function failureState(error: unknown): 'retrying' | 'failed' | 'conflicted' {
  if (error instanceof MobileApiError && error.status === 409) return 'conflicted';
  if (error instanceof MobileApiError && !error.retryable) return 'failed';
  return 'retrying';
}

async function synchronizeOne(userId: string, operation: ExpoDailyLogSyncOperation): Promise<number> {
  const photos = await listExpoPhotos(userId, operation.clientId);
  if (operation.photoManifestVersion !== 1) {
    const message = 'This queued log predates verified photo tracking. The daily log was not sent; review or discard it on this device.';
    await markExpoOutbox(userId, operation, 'failed', message);
    for (const photo of photos) await markExpoPhoto(userId, photo, 'failed', message);
    return 0;
  }
  const availablePhotoIds = new Set(photos.map((photo) => photo.photoId));
  const missingPhotoCount = operation.photoIds.filter((photoId) => !availablePhotoIds.has(photoId)).length;
  if (missingPhotoCount > 0) {
    const message = `${missingPhotoCount} queued photo${missingPhotoCount === 1 ? ' is' : 's are'} missing from this device. The daily log was not sent.`;
    await markExpoOutbox(userId, operation, 'failed', message);
    for (const photo of photos) await markExpoPhoto(userId, photo, 'failed', message);
    return 0;
  }
  try {
    const parent = await mobileApi.syncDailyLog(operation);
    for (const photo of photos) {
      await markExpoPhoto(userId, photo, 'retrying', null);
      const child = photoOperation(userId, photo, parent.id);
      const storage = await mobileApi.prepareDailyLogPhoto(child);
      const upload = await supabase.storage.from(storage.bucket)
        .uploadToSignedUrl(storage.path, storage.token, new File(photo.uri), { contentType: photo.fileType });
      if (upload.error) throw upload.error;
      await mobileApi.finalizeDailyLogPhoto(child, storage);
    }
    await completeExpoSync(userId, operation, photos);
    for (const photo of photos) deleteOwnedFieldPhoto(userId, photo);
    return 1 + photos.length;
  } catch (error) {
    const state = failureState(error);
    const message = error instanceof Error ? error.message : 'Synchronization failed';
    await markExpoOutbox(userId, operation, state, message);
    for (const photo of photos) await markExpoPhoto(userId, photo, state, message);
    return 0;
  }
}

export async function synchronizeExpoOutbox(userId: string): Promise<number> {
  let completed = 0;
  for (const operation of await listExpoOutbox(userId)) completed += await synchronizeOne(userId, operation);
  return completed;
}
