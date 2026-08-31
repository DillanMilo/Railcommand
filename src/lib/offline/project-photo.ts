import { OFFLINE_STORES, openOfflineDatabase } from './storage';
import { OUTBOX_CHANGED_EVENT, PROJECT_PHOTO_UPLOAD_OPERATION, type OfflinePhotoInput, type ProjectPhotoUploadOperation } from './outbox';
import { PROJECT_PHOTO_MAX_PENDING, validateProjectPhoto } from '../project-photo-policy';

export function createProjectPhotoOperation(projectId: string, photo: OfflinePhotoInput): ProjectPhotoUploadOperation {
  const error = validateProjectPhoto(photo.file);
  if (error) throw new Error(error);
  if (!projectId || !photo.id || photo.category !== 'standard') throw new Error('Invalid project photo.');
  const timestamp = new Date().toISOString();
  return {
    operationId: photo.id, blobId: photo.id, projectId,
    kind: PROJECT_PHOTO_UPLOAD_OPERATION,
    idempotencyKey: `project-photo:${photo.id}`,
    status: 'pending', attemptCount: 0, createdAt: timestamp, updatedAt: timestamp,
    nextAttemptAt: timestamp, lastError: null,
    payload: {
      fileName: photo.file.name, fileType: photo.file.type, fileSize: photo.file.size,
      originalSize: photo.originalSize ?? photo.file.size, photoCategory: 'standard',
      geoLat: photo.geo_lat, geoLng: photo.geo_lng, capturedAt: photo.capturedAt ?? timestamp,
    },
  };
}

// Atomic metadata + blob persistence. A full disk never leaves a half-queued photo.
export async function enqueueProjectPhoto(userId: string, projectId: string, photo: OfflinePhotoInput): Promise<void> {
  const operation = createProjectPhotoOperation(projectId, photo);
  const database = await openOfflineDatabase(userId);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([OFFLINE_STORES.outbox, OFFLINE_STORES.blobs], 'readwrite');
    const outbox = transaction.objectStore(OFFLINE_STORES.outbox);
    let limitReached = false;
    let writeError: unknown;
    const request = outbox.getAll();
    request.onsuccess = () => {
      if (request.result.filter((item) => item.kind === PROJECT_PHOTO_UPLOAD_OPERATION).length >= PROJECT_PHOTO_MAX_PENDING) {
        limitReached = true;
        transaction.abort();
        return;
      }
      try {
        outbox.add(operation);
        transaction.objectStore(OFFLINE_STORES.blobs).add({
          id: operation.blobId, operationId: operation.operationId,
          blob: photo.file, createdAt: operation.createdAt,
        });
      } catch (error) {
        writeError = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onabort = transaction.onerror = () => {
      database.close();
      reject(limitReached
        ? new Error('20 project photos are already waiting on this device. Synchronize them before adding more.')
        : writeError ?? transaction.error ?? new Error('Could not save this photo on this device.'));
    };
  });
  window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
}
