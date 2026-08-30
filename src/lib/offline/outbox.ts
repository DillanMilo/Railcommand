import type { GeoTag } from '@/lib/types';
import {
  assertDailyLogDraftBaseline,
  createDailyLogDraftRecord,
  getDailyLogDraftId,
  type DailyLogDraftRecord,
  type DailyLogDraftValues,
} from './daily-log-draft';
import { OFFLINE_STORES, openOfflineDatabase } from './storage';

export const DAILY_LOG_CREATE_OPERATION = 'daily_log_create' as const;
export const DAILY_LOG_PHOTO_UPLOAD_OPERATION = 'daily_log_photo_upload' as const;
export const OUTBOX_CHANGED_EVENT = 'railcommand:outbox-changed';

export type OutboxStatus = 'pending' | 'syncing' | 'retry' | 'failed';

interface OutboxOperationBase {
  operationId: string;
  projectId: string;
  idempotencyKey: string;
  status: OutboxStatus;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt: string;
  lastError: string | null;
}

export interface DailyLogSyncPayload {
  log_date: string;
  weather_temp: number;
  weather_conditions: string;
  weather_wind: string;
  work_summary: string;
  safety_notes: string;
  geo_tag: GeoTag | null;
  personnel: { role: string; headcount: number; company: string }[];
  equipment: { equipment_type: string; count: number; notes: string }[];
  work_items: { description: string; quantity: number; unit: string; location: string }[];
}

export interface DailyLogCreateOperation extends OutboxOperationBase {
  kind: typeof DAILY_LOG_CREATE_OPERATION;
  clientId: string;
  payload: DailyLogSyncPayload;
}

export interface DailyLogPhotoUploadOperation extends OutboxOperationBase {
  kind: typeof DAILY_LOG_PHOTO_UPLOAD_OPERATION;
  parentOperationId: string;
  parentEntityId: string;
  blobId: string;
  payload: {
    fileName: string;
    fileType: string;
    fileSize: number;
    originalSize: number;
    photoCategory: string;
    geoLat: number | null;
    geoLng: number | null;
    capturedAt: string;
  };
}

export type OutboxOperation = DailyLogCreateOperation | DailyLogPhotoUploadOperation;

export interface OfflinePhotoInput {
  id: string;
  file: File;
  category: string;
  geo_lat: number | null;
  geo_lng: number | null;
  originalSize?: number;
  capturedAt?: string;
}

export interface OfflineBlobRecord {
  id: string;
  operationId: string;
  blob: Blob;
  createdAt: string;
}

export interface SyncHistoryItem {
  operationId: string;
  kind: OutboxOperation['kind'];
  projectId: string;
  label: string;
  completedAt: string;
}

export const MAX_SYNC_ATTEMPTS = 8;
export const BASE_RETRY_DELAY_MS = 2_000;
export const MAX_RETRY_DELAY_MS = 5 * 60_000;
const MAX_SYNC_HISTORY_ITEMS = 50;

export function dailyLogDraftToSyncPayload(values: DailyLogDraftValues): DailyLogSyncPayload {
  return {
    log_date: values.date,
    weather_temp: typeof values.temp === 'number' ? values.temp : 0,
    weather_conditions: values.conditions,
    weather_wind: values.wind,
    work_summary: values.workSummary,
    safety_notes: values.safetyNotes,
    geo_tag: values.geoTag,
    personnel: values.personnel,
    equipment: values.equipment.map((row) => ({
      equipment_type: row.type,
      count: row.count,
      notes: row.notes,
    })),
    work_items: values.workItems,
  };
}

export function createDailyLogOutboxOperation(
  draft: DailyLogDraftRecord,
  now = new Date()
): DailyLogCreateOperation {
  const timestamp = now.toISOString();
  return {
    operationId: draft.clientId,
    kind: DAILY_LOG_CREATE_OPERATION,
    projectId: draft.projectId,
    clientId: draft.clientId,
    idempotencyKey: draft.idempotencyKey,
    payload: dailyLogDraftToSyncPayload(draft.values),
    status: 'pending',
    attemptCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    nextAttemptAt: timestamp,
    lastError: null,
  };
}

export function createDailyLogPhotoOperation(
  parent: DailyLogCreateOperation,
  photo: OfflinePhotoInput,
  now = new Date()
): DailyLogPhotoUploadOperation {
  const timestamp = now.toISOString();
  return {
    operationId: photo.id,
    kind: DAILY_LOG_PHOTO_UPLOAD_OPERATION,
    projectId: parent.projectId,
    parentOperationId: parent.operationId,
    parentEntityId: parent.clientId,
    blobId: photo.id,
    idempotencyKey: `daily-log-photo:${photo.id}`,
    payload: {
      fileName: photo.file.name,
      fileType: photo.file.type || 'image/jpeg',
      fileSize: photo.file.size,
      originalSize: photo.originalSize ?? photo.file.size,
      photoCategory: photo.category,
      geoLat: photo.geo_lat,
      geoLng: photo.geo_lng,
      capturedAt: photo.capturedAt ?? timestamp,
    },
    status: 'pending',
    attemptCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    nextAttemptAt: timestamp,
    lastError: null,
  };
}

function notifyOutboxChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
}

export async function enqueueDailyLogCreate(
  userId: string,
  projectId: string,
  values: DailyLogDraftValues,
  existingDraft: DailyLogDraftRecord | null = null,
  photos: OfflinePhotoInput[] = []
): Promise<DailyLogCreateOperation> {
  const draft = createDailyLogDraftRecord(projectId, values, existingDraft);
  const operation = createDailyLogOutboxOperation(draft);
  const photoOperations = photos.map((photo) => createDailyLogPhotoOperation(operation, photo));
  const database = await openOfflineDatabase(userId);

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(
      [OFFLINE_STORES.outbox, OFFLINE_STORES.drafts, OFFLINE_STORES.blobs],
      'readwrite'
    );
    let writeError: unknown;
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(writeError ?? transaction.error ?? new Error('Could not queue the daily log and photos'));
    };
    transaction.onabort = () => {
      database.close();
      reject(writeError ?? transaction.error ?? new Error('Daily-log queue transaction was interrupted'));
    };

    const draftStore = transaction.objectStore(OFFLINE_STORES.drafts);
    const request = draftStore.get(getDailyLogDraftId(projectId));
    request.onsuccess = () => {
      try {
        assertDailyLogDraftBaseline(request.result as DailyLogDraftRecord | undefined, existingDraft);
        const outboxStore = transaction.objectStore(OFFLINE_STORES.outbox);
        const blobStore = transaction.objectStore(OFFLINE_STORES.blobs);
        outboxStore.add(operation);
        photoOperations.forEach((photoOperation, index) => {
          outboxStore.add(photoOperation);
          const blobRecord: OfflineBlobRecord = {
            id: photoOperation.blobId,
            operationId: photoOperation.operationId,
            blob: photos[index].file,
            createdAt: photoOperation.createdAt,
          };
          blobStore.add(blobRecord);
        });
        draftStore.delete(getDailyLogDraftId(projectId));
      } catch (error) {
        // Stale baselines and synchronous quota/clone failures must roll back
        // the entire move, retaining the latest draft and every queued item.
        writeError = error;
        transaction.abort();
      }
    };
  });

  notifyOutboxChanged();
  return operation;
}

function operationSort(a: OutboxOperation, b: OutboxOperation): number {
  const created = a.createdAt.localeCompare(b.createdAt);
  if (created !== 0) return created;
  if (a.kind === b.kind) return a.operationId.localeCompare(b.operationId);
  return a.kind === DAILY_LOG_CREATE_OPERATION ? -1 : 1;
}

export async function listOutboxOperations(userId: string): Promise<OutboxOperation[]> {
  const database = await openOfflineDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.outbox, 'readonly');
    const request = transaction.objectStore(OFFLINE_STORES.outbox).getAll();
    request.onsuccess = () => resolve(
      ((request.result as OutboxOperation[]) ?? []).sort(operationSort)
    );
    request.onerror = () => reject(request.error ?? new Error('Could not read pending operations'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function readOfflineBlob(
  userId: string,
  blobId: string
): Promise<OfflineBlobRecord | null> {
  const database = await openOfflineDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.blobs, 'readonly');
    const request = transaction.objectStore(OFFLINE_STORES.blobs).get(blobId);
    request.onsuccess = () => resolve((request.result as OfflineBlobRecord | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('Could not read the queued photo'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function listSyncHistory(userId: string): Promise<SyncHistoryItem[]> {
  const database = await openOfflineDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.syncHistory, 'readonly');
    const request = transaction.objectStore(OFFLINE_STORES.syncHistory).getAll();
    request.onsuccess = () => resolve(
      ((request.result as SyncHistoryItem[]) ?? [])
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
        .slice(0, MAX_SYNC_HISTORY_ITEMS)
    );
    request.onerror = () => reject(request.error ?? new Error('Could not read synchronization history'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function updateOutboxOperation(
  userId: string,
  operation: OutboxOperation
): Promise<void> {
  const database = await openOfflineDatabase(userId);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.outbox, 'readwrite');
    transaction.objectStore(OFFLINE_STORES.outbox).put(operation);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not update a pending operation'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Pending-operation update was interrupted'));
    };
  });
  notifyOutboxChanged();
}

export async function completeOutboxOperation(
  userId: string,
  operation: OutboxOperation,
  now = new Date()
): Promise<void> {
  const database = await openOfflineDatabase(userId);
  await new Promise<void>((resolve, reject) => {
    const stores: string[] = [OFFLINE_STORES.outbox, OFFLINE_STORES.syncHistory];
    if (operation.kind === DAILY_LOG_PHOTO_UPLOAD_OPERATION) stores.push(OFFLINE_STORES.blobs);
    const transaction = database.transaction(stores, 'readwrite');
    transaction.objectStore(OFFLINE_STORES.outbox).delete(operation.operationId);
    if (operation.kind === DAILY_LOG_PHOTO_UPLOAD_OPERATION) {
      transaction.objectStore(OFFLINE_STORES.blobs).delete(operation.blobId);
    }
    const history: SyncHistoryItem = {
      operationId: operation.operationId,
      kind: operation.kind,
      projectId: operation.projectId,
      label: operation.kind === DAILY_LOG_CREATE_OPERATION
        ? `Daily log ${operation.payload.log_date}`
        : operation.payload.fileName,
      completedAt: now.toISOString(),
    };
    transaction.objectStore(OFFLINE_STORES.syncHistory).put(history);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not complete a synchronized operation'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Synchronization completion was interrupted'));
    };
  });
  notifyOutboxChanged();
}

export function getRetryDelayMs(attemptCount: number): number {
  const exponent = Math.max(attemptCount - 1, 0);
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** exponent, MAX_RETRY_DELAY_MS);
}

export function scheduleOutboxRetry<T extends OutboxOperation>(
  operation: T,
  error: string,
  now = new Date()
): T {
  const attemptCount = operation.attemptCount + 1;
  const terminal = attemptCount >= MAX_SYNC_ATTEMPTS;
  return {
    ...operation,
    status: terminal ? 'failed' : 'retry',
    attemptCount,
    updatedAt: now.toISOString(),
    nextAttemptAt: terminal
      ? operation.nextAttemptAt
      : new Date(now.getTime() + getRetryDelayMs(attemptCount)).toISOString(),
    lastError: error,
  };
}

export function failOutboxOperation<T extends OutboxOperation>(
  operation: T,
  error: string,
  now = new Date()
): T {
  return {
    ...operation,
    status: 'failed',
    attemptCount: operation.attemptCount + 1,
    updatedAt: now.toISOString(),
    lastError: error,
  };
}

export function resetOutboxOperationForRetry<T extends OutboxOperation>(
  operation: T,
  now = new Date()
): T {
  const timestamp = now.toISOString();
  return {
    ...operation,
    status: 'pending',
    updatedAt: timestamp,
    nextAttemptAt: timestamp,
    lastError: null,
  };
}
