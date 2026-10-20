import { File } from 'expo-file-system';
import { MobileApiError } from '@railcommand/api-client';
import type { MobileDailyLogPhotoSyncOperation } from '@railcommand/domain';
import { mobileApiForUser } from './api';
import { completeExpoSync, listExpoOutbox, listExpoPhotos, markExpoOutbox, markExpoPhoto, type ExpoDailyLogSyncOperation, type ExpoStoredPhoto } from './offline-store';
import { deleteOwnedFieldPhoto } from './device';
import { supabase } from './supabase';
import { captureOfflineScope } from './storage-scope';

type SyncLifetime = {
  isCurrent(): boolean;
  check(): Promise<boolean>;
  pause(): void;
};

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

async function markFailure(
  userId: string,
  operation: ExpoDailyLogSyncOperation,
  photos: ExpoStoredPhoto[],
  state: 'retrying' | 'failed' | 'conflicted',
  message: string,
  lifetime: SyncLifetime,
): Promise<number> {
  if (!await lifetime.check()) return 0;
  await markExpoOutbox(userId, operation, state, message, lifetime.isCurrent);
  for (const photo of photos) {
    if (!await lifetime.check()) return 0;
    await markExpoPhoto(userId, photo, state, message, lifetime.isCurrent);
  }
  return 0;
}

async function synchronizeOne(
  userId: string,
  operation: ExpoDailyLogSyncOperation,
  api: ReturnType<typeof mobileApiForUser>,
  lifetime: SyncLifetime,
): Promise<number> {
  if (!await lifetime.check()) return 0;
  const photos = await listExpoPhotos(userId, operation.clientId, lifetime.isCurrent);
  if (!await lifetime.check()) return 0;
  if (operation.photoManifestVersion !== 1) {
    const message = 'This queued log predates verified photo tracking. The daily log was not sent; review or discard it on this device.';
    return markFailure(userId, operation, photos, 'failed', message, lifetime);
  }
  const availablePhotoIds = new Set(photos.map((photo) => photo.photoId));
  const missingPhotoCount = operation.photoIds.filter((photoId) => !availablePhotoIds.has(photoId)).length;
  if (missingPhotoCount > 0) {
    const message = `${missingPhotoCount} queued photo${missingPhotoCount === 1 ? ' is' : 's are'} missing from this device. The daily log was not sent.`;
    return markFailure(userId, operation, photos, 'failed', message, lifetime);
  }
  try {
    if (!await lifetime.check()) return 0;
    const parent = await api.syncDailyLog(operation);
    for (const photo of photos) {
      if (!await lifetime.check()) return 0;
      await markExpoPhoto(userId, photo, 'retrying', null, lifetime.isCurrent);
      const child = photoOperation(userId, photo, parent.id);
      if (!await lifetime.check()) return 0;
      const storage = await api.prepareDailyLogPhoto(child);
      if (!await lifetime.check()) return 0;
      if (!lifetime.isCurrent()) return 0;
      const upload = await supabase.storage.from(storage.bucket)
        .uploadToSignedUrl(storage.path, storage.token, new File(photo.uri), { contentType: photo.fileType });
      if (!await lifetime.check()) return 0;
      if (upload.error) throw upload.error;
      await api.finalizeDailyLogPhoto(child, storage);
    }
    if (!await lifetime.check()) return 0;
    await completeExpoSync(userId, operation, photos, lifetime.isCurrent);
    for (const photo of photos) {
      if (!await lifetime.check()) return 0;
      if (!lifetime.isCurrent()) return 0;
      deleteOwnedFieldPhoto(userId, photo);
    }
    if (!await lifetime.check()) return 0;
    return 1 + photos.length;
  } catch (error) {
    // An account change or purge is cancellation, never a permanent sync failure.
    if (!await lifetime.check()) return 0;
    if (error instanceof MobileApiError && error.status === 401) {
      // The API already tried its single refresh. Retain this work for a fresh
      // foreground attempt without sending the rest of the batch unverified.
      await markFailure(userId, operation, photos, 'retrying',
        'Session could not be verified. Work remains on this device; sign in or retry online.', lifetime);
      lifetime.pause();
      return 0;
    }
    const state = failureState(error);
    const message = error instanceof Error ? error.message : 'Synchronization failed';
    return markFailure(userId, operation, photos, state, message, lifetime);
  }
}

export async function synchronizeExpoOutbox(userId: string, isCurrent: () => boolean = () => true): Promise<number> {
  const storageIsCurrent = captureOfflineScope(userId);
  let canceled = false;
  const stillCurrent = () => {
    if (canceled || !isCurrent() || !storageIsCurrent()) canceled = true;
    return !canceled;
  };
  if (!stillCurrent()) return 0;
  // Latch owner changes immediately, including A -> B -> A during an await.
  // The callback stays synchronous; session inspection happens outside auth events.
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user.id !== userId) canceled = true;
  });
  const lifetime: SyncLifetime = {
    isCurrent: stillCurrent,
    pause: () => { canceled = true; },
    check: async () => {
      if (!stillCurrent()) return false;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || data.session?.user.id !== userId) canceled = true;
      } catch {
        // An unverifiable session pauses this run without changing durable work.
        canceled = true;
      }
      return stillCurrent();
    },
  };
  let completed = 0;
  try {
    const api = mobileApiForUser(userId, stillCurrent);
    if (!await lifetime.check()) return 0;
    const operations = await listExpoOutbox(userId, stillCurrent);
    for (const operation of operations) {
      if (!await lifetime.check()) break;
      completed += await synchronizeOne(userId, operation, api, lifetime);
    }
    return completed;
  } catch (error) {
    if (!await lifetime.check()) return completed;
    throw error;
  } finally {
    subscription.unsubscribe();
  }
}
