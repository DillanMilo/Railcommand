const OFFLINE_DB_PREFIX = 'railcommand-offline';
const OFFLINE_DB_VERSION = 1;
const RAILCOMMAND_CACHE_PREFIX = 'railcommand-';
const PUBLIC_STATIC_CACHE_NAME = 'railcommand-static-v5';
export const OFFLINE_SCOPE_STORAGE_KEY = 'rc-offline-database-scope';

export const OFFLINE_STORES = {
  blobs: 'blobs',
  metadata: 'metadata',
  outbox: 'outbox',
  records: 'records',
} as const;

export type OfflineMetadataKey =
  | 'active_project_id'
  | 'last_connected_at'
  | 'last_synced_at'
  | 'schema_version';

export type OfflineEntityType = 'project' | 'project_members' | 'daily_logs';

export interface OfflineRecord<T = unknown> {
  key: string;
  entityType: OfflineEntityType;
  projectId: string;
  value: T;
  cachedAt: string;
  refreshAfter: string;
  discardAfter: string;
}

export interface OfflineRecordResult<T> {
  value: T;
  cachedAt: string;
  refreshAfter: string;
  discardAfter: string;
  isStale: boolean;
}

type OfflineMetadataRecord<T = unknown> = {
  key: OfflineMetadataKey;
  value: T;
};

export function getOfflineDatabaseName(userId: string): string {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) throw new Error('A user ID is required for offline storage');
  return `${OFFLINE_DB_PREFIX}:${encodeURIComponent(normalizedUserId)}`;
}

export function getOfflineUserIdFromDatabaseName(databaseName: string): string | null {
  const prefix = `${OFFLINE_DB_PREFIX}:`;
  if (!databaseName.startsWith(prefix)) return null;
  try {
    const userId = decodeURIComponent(databaseName.slice(prefix.length)).trim();
    return userId || null;
  } catch {
    return null;
  }
}

export function getActiveOfflineUserId(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const databaseName = localStorage.getItem(OFFLINE_SCOPE_STORAGE_KEY);
    return databaseName ? getOfflineUserIdFromDatabaseName(databaseName) : null;
  } catch {
    return null;
  }
}

export function isRailCommandCacheName(cacheName: string): boolean {
  return cacheName.startsWith(RAILCOMMAND_CACHE_PREFIX);
}

export function getOfflineRecordKey(
  entityType: OfflineEntityType,
  projectId: string
): string {
  const normalizedProjectId = projectId.trim();
  if (!normalizedProjectId) throw new Error('A project ID is required for offline records');
  return `${entityType}:${normalizedProjectId}`;
}

export function isOfflineRecordStale(
  record: Pick<OfflineRecord, 'refreshAfter'>,
  now = Date.now()
): boolean {
  return Date.parse(record.refreshAfter) <= now;
}

export function isOfflineRecordDiscarded(
  record: Pick<OfflineRecord, 'discardAfter'>,
  now = Date.now()
): boolean {
  return Date.parse(record.discardAfter) <= now;
}

function requireIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new Error('Offline storage is not supported by this browser');
  }
  return indexedDB;
}

export function openOfflineDatabase(userId: string): Promise<IDBDatabase> {
  const factory = requireIndexedDb();

  return new Promise((resolve, reject) => {
    const request = factory.open(getOfflineDatabaseName(userId), OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(OFFLINE_STORES.metadata)) {
        database.createObjectStore(OFFLINE_STORES.metadata, { keyPath: 'key' });
      }

      if (!database.objectStoreNames.contains(OFFLINE_STORES.records)) {
        const records = database.createObjectStore(OFFLINE_STORES.records, { keyPath: 'key' });
        records.createIndex('by_project', 'projectId', { unique: false });
        records.createIndex('by_entity_type', 'entityType', { unique: false });
      }

      if (!database.objectStoreNames.contains(OFFLINE_STORES.outbox)) {
        const outbox = database.createObjectStore(OFFLINE_STORES.outbox, {
          keyPath: 'operationId',
        });
        outbox.createIndex('by_status', 'status', { unique: false });
        outbox.createIndex('by_created_at', 'createdAt', { unique: false });
      }

      if (!database.objectStoreNames.contains(OFFLINE_STORES.blobs)) {
        database.createObjectStore(OFFLINE_STORES.blobs, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open offline storage'));
    request.onblocked = () => reject(new Error('Offline storage upgrade is blocked by another tab'));
  });
}

export async function initializeOfflineStorage(userId: string): Promise<void> {
  const database = await openOfflineDatabase(userId);
  database.close();
  try {
    localStorage.setItem(OFFLINE_SCOPE_STORAGE_KEY, getOfflineDatabaseName(userId));
  } catch {
    // The public offline reader can fall back to indexedDB.databases() where supported.
  }
  await writeOfflineMetadata(userId, 'schema_version', OFFLINE_DB_VERSION);
}

export async function readOfflineMetadata<T>(
  userId: string,
  key: OfflineMetadataKey
): Promise<T | null> {
  const database = await openOfflineDatabase(userId);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.metadata, 'readonly');
    const request = transaction.objectStore(OFFLINE_STORES.metadata).get(key);

    request.onsuccess = () => {
      const record = request.result as OfflineMetadataRecord<T> | undefined;
      resolve(record?.value ?? null);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not read offline metadata'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function writeOfflineMetadata<T>(
  userId: string,
  key: OfflineMetadataKey,
  value: T
): Promise<void> {
  const database = await openOfflineDatabase(userId);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.metadata, 'readwrite');
    transaction.objectStore(OFFLINE_STORES.metadata).put({ key, value });
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not write offline metadata'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Offline metadata transaction was aborted'));
    };
  });
}

export async function readOfflineRecord<T>(
  userId: string,
  entityType: OfflineEntityType,
  projectId: string,
  now = Date.now()
): Promise<OfflineRecordResult<T> | null> {
  const database = await openOfflineDatabase(userId);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.records, 'readonly');
    const request = transaction
      .objectStore(OFFLINE_STORES.records)
      .get(getOfflineRecordKey(entityType, projectId));

    request.onsuccess = () => {
      const record = request.result as OfflineRecord<T> | undefined;
      if (!record || isOfflineRecordDiscarded(record, now)) {
        resolve(null);
        return;
      }
      resolve({
        value: record.value,
        cachedAt: record.cachedAt,
        refreshAfter: record.refreshAfter,
        discardAfter: record.discardAfter,
        isStale: isOfflineRecordStale(record, now),
      });
    };
    request.onerror = () => reject(request.error ?? new Error('Could not read offline record'));
    transaction.oncomplete = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function writeOfflineRecord<T>(
  userId: string,
  record: OfflineRecord<T>
): Promise<void> {
  await writeOfflineRecords(userId, [record]);
}

export async function writeOfflineRecords(
  userId: string,
  records: OfflineRecord[]
): Promise<void> {
  if (records.length === 0) return;
  const database = await openOfflineDatabase(userId);

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OFFLINE_STORES.records, 'readwrite');
    const store = transaction.objectStore(OFFLINE_STORES.records);
    records.forEach((record) => store.put(record));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not write offline record'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Offline record transaction was aborted'));
    };
  });
}

export async function deleteDiscardedOfflineRecords(
  userId: string,
  now = Date.now()
): Promise<number> {
  const database = await openOfflineDatabase(userId);

  return new Promise((resolve, reject) => {
    let deleted = 0;
    const transaction = database.transaction(OFFLINE_STORES.records, 'readwrite');
    const store = transaction.objectStore(OFFLINE_STORES.records);
    const request = store.openCursor();

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = cursor.value as OfflineRecord;
      if (isOfflineRecordDiscarded(record, now)) {
        cursor.delete();
        deleted += 1;
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('Could not inspect offline records'));
    transaction.oncomplete = () => {
      database.close();
      resolve(deleted);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error('Could not remove expired offline records'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error('Offline record cleanup was aborted'));
    };
  });
}

export function deleteOfflineDatabase(userId: string): Promise<void> {
  const factory = requireIndexedDb();

  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(getOfflineDatabaseName(userId));
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Could not delete offline data'));
    request.onblocked = () => reject(new Error('Close other RailCommand tabs to remove offline data'));
  });
}

export async function clearRailCommandCaches(): Promise<void> {
  if (typeof caches === 'undefined') return;
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(
        (cacheName) =>
          isRailCommandCacheName(cacheName) && cacheName !== PUBLIC_STATIC_CACHE_NAME
      )
      .map((cacheName) => caches.delete(cacheName))
  );
}

export async function clearOfflineDataForUser(userId: string): Promise<void> {
  await Promise.allSettled([
    deleteOfflineDatabase(userId),
    clearRailCommandCaches(),
  ]);

  try {
    if (localStorage.getItem(OFFLINE_SCOPE_STORAGE_KEY) === getOfflineDatabaseName(userId)) {
      localStorage.removeItem(OFFLINE_SCOPE_STORAGE_KEY);
    }
  } catch {
    // Storage may be unavailable during browser privacy-mode cleanup.
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_PRIVATE_DATA' });
  }
}

export async function requestPersistentOfflineStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
