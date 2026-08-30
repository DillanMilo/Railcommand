import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import {
  clearOfflineDataForUser,
  deleteDiscardedOfflineRecords,
  getOfflineDatabaseName,
  initializeOfflineStorage,
  OFFLINE_SCOPE_STORAGE_KEY,
  OFFLINE_STORES,
  openOfflineDatabase,
  readOfflineRecord,
  writeOfflineRecord,
} from './storage';
import {
  readDailyLogDraft,
  writeDailyLogDraft,
  type DailyLogDraftRecord,
  type DailyLogDraftValues,
} from './daily-log-draft';
import {
  completeOutboxOperation,
  DAILY_LOG_PHOTO_UPLOAD_OPERATION,
  enqueueDailyLogCreate,
  listOutboxOperations,
  listSyncHistory,
  MAX_SYNC_ATTEMPTS,
  readOfflineBlob,
  resetOutboxOperationForRetry,
  scheduleOutboxRetry,
  updateOutboxOperation,
  type DailyLogCreateOperation,
  type OfflinePhotoInput,
} from './outbox';
import { createOfflineRecord } from './project-cache';
import { isOfflineStorageQuotaError } from './errors';

const userA = 'synthetic-runtime-user-a';
const userB = 'synthetic-runtime-user-b';
const projectId = 'synthetic-runtime-project';
const values: DailyLogDraftValues = {
  date: '2026-08-30',
  temp: 72,
  conditions: 'Clear',
  wind: 'NW 8 mph',
  personnel: [{ role: 'Foreman', headcount: 2, company: 'Synthetic QA' }],
  equipment: [{ type: 'Excavator', count: 1, notes: 'Inspected' }],
  workItems: [{ description: 'Set rail', quantity: 100, unit: 'LF', location: 'MP 12' }],
  workSummary: 'Synthetic offline transaction test',
  safetyNotes: 'Toolbox talk completed',
  geoTag: { lat: 41.1, lng: -87.2, timestamp: '2026-08-30T12:00:00.000Z' },
};

function photo(id = 'synthetic-photo'): OfflinePhotoInput {
  return {
    id,
    file: new File(['synthetic-photo-bytes'], `${id}.jpg`, { type: 'image/jpeg' }),
    category: 'standard',
    geo_lat: 41.1,
    geo_lng: -87.2,
  };
}

// Actual storage functions run against a fresh, in-memory IndexedDB factory.
// These tests never use a browser profile, network, Supabase, or real user data.
// Closing/reopening connections tests persistence within the factory, not a
// physical device restart or the browser's real storage-quota implementation.
describe('offline IndexedDB runtime transactions', () => {
  const originalGlobals = new Map<string, PropertyDescriptor | undefined>();
  const originalAdd = IDBObjectStore.prototype.add;
  let localValues: Map<string, string>;
  let cacheNames: Set<string>;

  function replaceGlobal(name: string, value: unknown) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }

  beforeEach(() => {
    localValues = new Map();
    cacheNames = new Set(['railcommand-v2', 'railcommand-static-v9', 'unrelated-app-cache']);
    replaceGlobal('indexedDB', new IDBFactory());
    replaceGlobal('localStorage', {
      getItem: (key: string) => localValues.get(key) ?? null,
      setItem: (key: string, value: string) => localValues.set(key, value),
      removeItem: (key: string) => localValues.delete(key),
    });
    replaceGlobal('caches', {
      keys: async () => [...cacheNames],
      delete: async (name: string) => cacheNames.delete(name),
    });
  });

  afterEach(() => {
    IDBObjectStore.prototype.add = originalAdd;
    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
    originalGlobals.clear();
  });

  it('preserves every draft field and retry identity through autosave and reopened connections', async () => {
    const draft = await writeDailyLogDraft(userA, projectId, values);
    const reopened = await openOfflineDatabase(userA);
    assert.deepEqual([...reopened.objectStoreNames].sort(), Object.values(OFFLINE_STORES).sort());
    reopened.close();
    assert.deepEqual(await readDailyLogDraft(userA, projectId), draft);

    const updated = await writeDailyLogDraft(
      userA, projectId, { ...values, workSummary: 'Recovered and continued offline' }, draft
    );
    assert.equal(updated.clientId, draft.clientId);
    assert.equal(updated.idempotencyKey, draft.idempotencyKey);
    assert.equal(updated.createdAt, draft.createdAt);
    assert.deepEqual((await readDailyLogDraft(userA, projectId))?.values, updated.values);
    assert.equal(await readDailyLogDraft(userB, projectId), null);
  });

  it('keeps stale cache readable, expires only cached records, and preserves non-expiring drafts', async () => {
    const record = createOfflineRecord('daily_logs', projectId, [{ id: 'synthetic-log' }]);
    await writeOfflineRecord(userA, record);
    const draft = await writeDailyLogDraft(userA, projectId, values);
    assert.equal((await readOfflineRecord(userA, 'daily_logs', projectId, Date.parse(record.refreshAfter)))?.isStale, true);
    assert.equal(await readOfflineRecord(userB, 'daily_logs', projectId), null);
    assert.equal(await deleteDiscardedOfflineRecords(userA, Date.parse(record.discardAfter)), 1);
    assert.equal(await readOfflineRecord(userA, 'daily_logs', projectId), null);
    assert.deepEqual(await readDailyLogDraft(userA, projectId), draft);
  });

  it('atomically moves a draft and all photos into the outbox without duplicate delivery identities', async () => {
    const draft = await writeDailyLogDraft(userA, projectId, values);
    const photos = [photo('photo-one'), photo('photo-two')];
    const parent = await enqueueDailyLogCreate(userA, projectId, values, draft, photos);
    assert.equal(parent.operationId, draft.clientId);
    assert.equal(parent.idempotencyKey, draft.idempotencyKey);
    assert.equal(await readDailyLogDraft(userA, projectId), null);
    const operations = await listOutboxOperations(userA);
    assert.equal(operations.length, 3);
    assert.equal(operations[0].operationId, parent.operationId);
    for (const input of photos) {
      const child = operations.find((operation) => operation.operationId === input.id);
      assert.equal(child?.kind, DAILY_LOG_PHOTO_UPLOAD_OPERATION);
      assert.ok(child && child.kind === DAILY_LOG_PHOTO_UPLOAD_OPERATION);
      assert.equal(child.parentOperationId, parent.operationId);
      assert.equal(child.parentEntityId, parent.clientId);
      assert.equal(await (await readOfflineBlob(userA, input.id))?.blob.text(), 'synthetic-photo-bytes');
    }
    await assert.rejects(enqueueDailyLogCreate(userA, projectId, values, draft, photos));
    assert.deepEqual(await listOutboxOperations(userA), operations);
  });

  it('rolls back the entire queue transaction when a later photo violates a unique key', async () => {
    const draft = await writeDailyLogDraft(userA, projectId, values);
    await assert.rejects(enqueueDailyLogCreate(
      userA, projectId, values, draft, [photo('duplicate-photo'), photo('duplicate-photo')]
    ));
    assert.deepEqual(await readDailyLogDraft(userA, projectId), draft);
    assert.deepEqual(await listOutboxOperations(userA), []);
    assert.equal(await readOfflineBlob(userA, 'duplicate-photo'), null);
  });

  it('aborts already scheduled queue writes when a blob write throws a quota error', async () => {
    const draft = await writeDailyLogDraft(userA, projectId, values);
    // A deterministic fault tests our rollback behavior, not browser quota limits.
    IDBObjectStore.prototype.add = function (value, key) {
      if (this.name === OFFLINE_STORES.blobs) {
        throw new DOMException('Synthetic device storage is full', 'QuotaExceededError');
      }
      return originalAdd.call(this, value, key);
    };
    await assert.rejects(
      enqueueDailyLogCreate(userA, projectId, values, draft, [photo()]),
      isOfflineStorageQuotaError
    );
    IDBObjectStore.prototype.add = originalAdd;
    assert.deepEqual(await readDailyLogDraft(userA, projectId), draft);
    assert.deepEqual(await listOutboxOperations(userA), []);
    assert.equal(await readOfflineBlob(userA, 'synthetic-photo'), null);
  });

  it('queues a recovered draft through the actual public offline fallback without retaining the draft', async () => {
    const draft = await writeDailyLogDraft(userA, projectId, values);
    const source = readFileSync(new URL('../../../public/offline-data.js', import.meta.url), 'utf8');
    const bootstrap = source.lastIndexOf('\n  renderOfflineData().catch(');
    assert.ok(bootstrap > 0, 'Expected the public offline reader bootstrap');
    const sandbox = {
      indexedDB,
      queueDraftUnderTest: undefined as undefined | ((name: string, record: DailyLogDraftRecord) => Promise<DailyLogCreateOperation>),
    };
    // Expose the shipped helper; replace only DOM bootstrapping, not its logic.
    runInNewContext(
      source.slice(0, bootstrap) + '\n  globalThis.queueDraftUnderTest = queueDailyLogDraft;\n})();',
      sandbox,
      { timeout: 1000, filename: 'public/offline-data.js' }
    );
    assert.ok(sandbox.queueDraftUnderTest);
    const queued = await sandbox.queueDraftUnderTest(getOfflineDatabaseName(userA), draft);
    assert.equal(queued.operationId, draft.clientId);
    assert.equal(queued.idempotencyKey, draft.idempotencyKey);
    assert.equal(await readDailyLogDraft(userA, projectId), null);
    assert.equal((await listOutboxOperations(userA)).length, 1);
    await assert.rejects(sandbox.queueDraftUnderTest(getOfflineDatabaseName(userA), draft));
    assert.equal((await listOutboxOperations(userA)).length, 1);
  });

  it('retains the same payload and idempotency key through failed retries and manual recovery', async () => {
    const initial = await enqueueDailyLogCreate(userA, projectId, values);
    let operation = initial;
    for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt += 1) {
      operation = scheduleOutboxRetry(operation, 'Synthetic intermittent connection');
      await updateOutboxOperation(userA, operation);
      const stored = await listOutboxOperations(userA);
      assert.equal(stored.length, 1);
      assert.deepEqual(stored[0], operation);
      assert.equal(stored[0].operationId, initial.operationId);
      assert.equal(stored[0].idempotencyKey, initial.idempotencyKey);
    }
    assert.equal(operation.status, 'failed');
    const recovered = resetOutboxOperationForRetry(operation);
    await updateOutboxOperation(userA, recovered);
    assert.equal((await listOutboxOperations(userA))[0].status, 'pending');
    assert.deepEqual(recovered.payload, initial.payload);
  });

  it('retains child blobs until photo completion and removes only that operation atomically', async () => {
    const parent = await enqueueDailyLogCreate(userA, projectId, values, null, [photo()]);
    const child = (await listOutboxOperations(userA)).find((operation) => operation.kind === DAILY_LOG_PHOTO_UPLOAD_OPERATION);
    assert.ok(child);
    await completeOutboxOperation(userA, parent);
    assert.deepEqual(await listOutboxOperations(userA), [child]);
    assert.ok(await readOfflineBlob(userA, child.blobId));
    await completeOutboxOperation(userA, child);
    assert.deepEqual(await listOutboxOperations(userA), []);
    assert.equal(await readOfflineBlob(userA, child.blobId), null);
    const history = await listSyncHistory(userA);
    assert.equal(history.length, 2);
    assert.deepEqual(new Set(history.map((item) => item.operationId)), new Set([parent.operationId, child.operationId]));
    await completeOutboxOperation(userA, child);
    assert.equal((await listSyncHistory(userA)).length, 2);
  });

  it('clears only the requested synthetic user database and legacy private caches', async () => {
    const draftA = await writeDailyLogDraft(userA, projectId, values);
    const draftB = await writeDailyLogDraft(userB, projectId, { ...values, workSummary: 'User B private work' });
    await enqueueDailyLogCreate(userA, projectId, values, draftA, [photo()]);
    await enqueueDailyLogCreate(userB, projectId, draftB.values, draftB, [photo()]);
    await initializeOfflineStorage(userB);
    const operationsB = await listOutboxOperations(userB);

    await clearOfflineDataForUser(userA);
    assert.deepEqual(await listOutboxOperations(userA), []);
    assert.equal(await readOfflineBlob(userA, 'synthetic-photo'), null);
    assert.deepEqual(await listOutboxOperations(userB), operationsB);
    assert.ok(await readOfflineBlob(userB, 'synthetic-photo'));
    assert.equal(localValues.get(OFFLINE_SCOPE_STORAGE_KEY), getOfflineDatabaseName(userB));
    assert.deepEqual(cacheNames, new Set(['railcommand-static-v9', 'unrelated-app-cache']));
  });
});
