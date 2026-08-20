import type {
  MobileBootstrap,
  MobileDailyLogDraft,
  MobileDailyLogSyncOperation,
  MobilePhotoRecord,
} from '@railcommand/domain';

const DB_PREFIX = 'railcommand-mobile';
const DB_VERSION = 1;

const STORES = {
  cache: 'cache',
  drafts: 'drafts',
  outbox: 'outbox',
  photos: 'photos',
} as const;

type CachedBootstrap = MobileBootstrap & {
  cacheKey: 'bootstrap';
  refreshAfter: string;
  discardAfter: string;
};

export interface CachedBootstrapResult {
  value: MobileBootstrap;
  stale: boolean;
}

function requireUserId(userId: string): string {
  const normalized = userId.trim();
  if (!normalized) throw new Error('A user ID is required for mobile offline storage');
  return normalized;
}

export function mobileDatabaseName(userId: string): string {
  return `${DB_PREFIX}:${encodeURIComponent(requireUserId(userId))}`;
}

function openDatabase(userId: string): Promise<IDBDatabase> {
  const request = indexedDB.open(mobileDatabaseName(userId), DB_VERSION);
  return new Promise((resolve, reject) => {
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORES.cache)) {
        database.createObjectStore(STORES.cache, { keyPath: 'cacheKey' });
      }
      if (!database.objectStoreNames.contains(STORES.drafts)) {
        database.createObjectStore(STORES.drafts, { keyPath: 'draftId' });
      }
      if (!database.objectStoreNames.contains(STORES.outbox)) {
        const store = database.createObjectStore(STORES.outbox, { keyPath: 'operationId' });
        store.createIndex('by_next_attempt', 'nextAttemptAt', { unique: false });
      }
      if (!database.objectStoreNames.contains(STORES.photos)) {
        const store = database.createObjectStore(STORES.photos, { keyPath: 'photoId' });
        store.createIndex('by_draft', 'draftId', { unique: false });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open mobile storage'));
    request.onblocked = () => reject(new Error('Mobile storage upgrade is blocked'));
  });
}

async function requestResult<T>(
  userId: string,
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = run(transaction.objectStore(storeName));
    let result: T;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error ?? new Error('Mobile storage request failed'));
    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Mobile storage transaction was aborted'));
    };
  });
}

export async function initializeMobileOfflineStorage(userId: string): Promise<void> {
  const database = await openDatabase(userId);
  database.close();
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    await navigator.storage.persist().catch(() => false);
  }
}

export async function cacheMobileBootstrap(
  userId: string,
  bootstrap: MobileBootstrap,
  now = new Date(),
): Promise<void> {
  if (bootstrap.userId !== requireUserId(userId)) {
    throw new Error('Cannot cache bootstrap data in another user’s database');
  }
  const timestamp = now.getTime();
  const record: CachedBootstrap = {
    ...bootstrap,
    cacheKey: 'bootstrap',
    refreshAfter: new Date(timestamp + 15 * 60_000).toISOString(),
    discardAfter: new Date(timestamp + 30 * 24 * 60 * 60_000).toISOString(),
  };
  await requestResult(userId, STORES.cache, 'readwrite', (store) => store.put(record));
}

export async function readCachedMobileBootstrap(
  userId: string,
  now = Date.now(),
): Promise<CachedBootstrapResult | null> {
  const record = await requestResult<CachedBootstrap | undefined>(
    userId, STORES.cache, 'readonly', (store) => store.get('bootstrap'),
  );
  if (!record || Date.parse(record.discardAfter) <= now) return null;
  const { cacheKey: _cacheKey, refreshAfter, discardAfter: _discardAfter, ...value } = record;
  return { value, stale: Date.parse(refreshAfter) <= now };
}

export async function saveMobileDraft(userId: string, draft: MobileDailyLogDraft): Promise<void> {
  await requestResult(userId, STORES.drafts, 'readwrite', (store) => store.put(draft));
}

export async function readMobileDraft(
  userId: string,
  projectId: string,
): Promise<MobileDailyLogDraft | null> {
  const result = await requestResult<MobileDailyLogDraft | undefined>(
    userId, STORES.drafts, 'readonly', (store) => store.get(`daily-log:${projectId}`),
  );
  return result ?? null;
}

export async function persistMobilePhoto(
  userId: string,
  photo: MobilePhotoRecord,
): Promise<void> {
  if (photo.size <= 0 || photo.size > 25 * 1024 * 1024) {
    throw new Error('Photo must be between 1 byte and 25 MB');
  }
  await requestResult(userId, STORES.photos, 'readwrite', (store) => store.put(photo));
}

export async function listMobilePhotos(
  userId: string,
  draftId: string,
): Promise<MobilePhotoRecord[]> {
  return requestResult<MobilePhotoRecord[]>(
    userId,
    STORES.photos,
    'readonly',
    (store) => store.index('by_draft').getAll(draftId),
  );
}

export async function queueMobileDraft(
  userId: string,
  operation: MobileDailyLogSyncOperation,
): Promise<void> {
  if (operation.userId !== requireUserId(userId)) {
    throw new Error('Cannot queue another user’s operation');
  }
  const database = await openDatabase(userId);
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction([STORES.drafts, STORES.outbox], 'readwrite');
    transaction.objectStore(STORES.outbox).put(operation);
    transaction.objectStore(STORES.drafts).delete(`daily-log:${operation.projectId}`);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

export async function listMobileOutbox(
  userId: string,
  now = Date.now(),
): Promise<MobileDailyLogSyncOperation[]> {
  const operations = await requestResult<MobileDailyLogSyncOperation[]>(
    userId, STORES.outbox, 'readonly', (store) => store.getAll(),
  );
  return operations
    .filter((operation) => operation.status !== 'failed' && Date.parse(operation.nextAttemptAt) <= now)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateMobileOutbox(
  userId: string,
  operation: MobileDailyLogSyncOperation,
): Promise<void> {
  await requestResult(userId, STORES.outbox, 'readwrite', (store) => store.put(operation));
}

export async function completeMobileOutbox(userId: string, operationId: string): Promise<void> {
  await requestResult(userId, STORES.outbox, 'readwrite', (store) => store.delete(operationId));
}

export async function inspectUnsyncedMobileWork(
  userId: string,
): Promise<{ drafts: number; operations: number; photos: number }> {
  const database = await openDatabase(userId);
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(
      [STORES.drafts, STORES.outbox, STORES.photos], 'readonly',
    );
    const draftRequest = transaction.objectStore(STORES.drafts).count();
    const operationRequest = transaction.objectStore(STORES.outbox).count();
    const photoRequest = transaction.objectStore(STORES.photos).count();
    transaction.oncomplete = () => {
      database.close();
      resolve({
        drafts: draftRequest.result,
        operations: operationRequest.result,
        photos: photoRequest.result,
      });
    };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error); };
  });
}

export async function clearMobileUserData(userId: string): Promise<void> {
  const request = indexedDB.deleteDatabase(mobileDatabaseName(userId));
  await new Promise<void>((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Could not clear mobile user data'));
    request.onblocked = () => reject(new Error('Mobile user data cleanup is blocked'));
  });
}
