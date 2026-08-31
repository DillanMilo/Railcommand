import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'mocha';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { enqueueProjectPhoto } from './project-photo';
import { listOutboxOperations, readOfflineBlob, completeOutboxOperation } from './outbox';
import { OFFLINE_STORES } from './storage';

describe('project photo durable queue', () => {
  const originals = new Map<string, PropertyDescriptor | undefined>();
  const photo = (id: string) => ({ id, file: new File(['photo'], 'IMG_QA.jpeg', { type: 'image/jpeg' }),
    category: 'standard', geo_lat: null, geo_lng: null });
  beforeEach(() => {
    for (const [key, value] of Object.entries({ indexedDB: new IDBFactory(), window: new EventTarget() })) {
      originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
  });
  afterEach(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });

  it('persists separately per user and removes the blob only after completion', async () => {
    await enqueueProjectPhoto('qa-a', 'qa-project', photo('qa-photo'));
    const operations = await listOutboxOperations('qa-a');
    assert.equal(operations.length, 1);
    assert.ok(await readOfflineBlob('qa-a', 'qa-photo'));
    assert.deepEqual(await listOutboxOperations('qa-b'), []);
    assert.equal(await readOfflineBlob('qa-b', 'qa-photo'), null);
    await completeOutboxOperation('qa-a', operations[0]);
    assert.deepEqual(await listOutboxOperations('qa-a'), []);
    assert.equal(await readOfflineBlob('qa-a', 'qa-photo'), null);
  });

  it('rolls back metadata if the blob write throws synchronously', async () => {
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...args) {
      if (this.name === OFFLINE_STORES.blobs) throw new DOMException('Storage full', 'QuotaExceededError');
      return originalAdd.apply(this, args);
    };
    try {
      await assert.rejects(enqueueProjectPhoto('qa-a', 'qa-project', photo('qa-photo')), { name: 'QuotaExceededError' });
    } finally {
      IDBObjectStore.prototype.add = originalAdd;
    }
    assert.deepEqual(await listOutboxOperations('qa-a'), []);
    assert.equal(await readOfflineBlob('qa-a', 'qa-photo'), null);
  });

  it('enforces the pending limit atomically across concurrent selections', async () => {
    const results = await Promise.allSettled(Array.from({ length: 21 }, (_, index) =>
      enqueueProjectPhoto('qa-a', 'qa-project', photo(`qa-photo-${index}`))));
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 20);
    assert.equal(results.filter((item) => item.status === 'rejected').length, 1);
    assert.equal((await listOutboxOperations('qa-a')).length, 20);
  });
});
