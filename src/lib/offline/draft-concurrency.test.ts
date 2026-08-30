import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { IDBFactory } from 'fake-indexeddb';
import {
  createDailyLogDraftRecord,
  deleteDailyLogDraft,
  readDailyLogDraft,
  writeDailyLogDraft,
  type DailyLogDraftValues,
} from './daily-log-draft';
import { enqueueDailyLogCreate, listOutboxOperations, readOfflineBlob } from './outbox';

const userId = 'synthetic-draft-concurrency-user';
const projectId = 'synthetic-draft-concurrency-project';
const values: DailyLogDraftValues = {
  date: '2026-08-30', temp: '', conditions: '', wind: '',
  personnel: [], equipment: [], workItems: [],
  workSummary: 'Original field work', safetyNotes: '', geoTag: null,
};
const conflict = /draft changed or was queued in another tab/;

describe('daily-log draft concurrent-tab safety', () => {
  let originalIndexedDB: PropertyDescriptor | undefined;
  beforeEach(() => {
    originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  });
  afterEach(() => {
    if (originalIndexedDB) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
  });

  it('advances the baseline even for same-millisecond saves', () => {
    const now = new Date('2026-08-30T12:00:00.000Z');
    const first = createDailyLogDraftRecord(projectId, values, null, now);
    const second = createDailyLogDraftRecord(projectId, values, first, now);
    assert.equal(Date.parse(second.updatedAt), Date.parse(first.updatedAt) + 1);
  });

  it('rejects stale autosaves without overwriting the newer draft', async () => {
    const original = await writeDailyLogDraft(userId, projectId, values);
    const newer = await writeDailyLogDraft(userId, projectId, { ...values, workSummary: 'Newer tab work' }, original);
    await assert.rejects(writeDailyLogDraft(userId, projectId, { ...values, workSummary: 'Stale tab work' }, original), conflict);
    assert.deepEqual(await readDailyLogDraft(userId, projectId), newer);
    await assert.rejects(writeDailyLogDraft(userId, projectId, values), conflict);
    assert.deepEqual(await readDailyLogDraft(userId, projectId), newer);
  });

  it('does not recreate a removed draft from an old baseline', async () => {
    const original = await writeDailyLogDraft(userId, projectId, values);
    await deleteDailyLogDraft(userId, projectId);
    await assert.rejects(writeDailyLogDraft(userId, projectId, values, original), conflict);
    assert.equal(await readDailyLogDraft(userId, projectId), null);
  });

  it('atomically permits only one writer sharing a baseline', async () => {
    const original = await writeDailyLogDraft(userId, projectId, values);
    const results = await Promise.allSettled([
      writeDailyLogDraft(userId, projectId, { ...values, workSummary: 'Tab one' }, original),
      writeDailyLogDraft(userId, projectId, { ...values, workSummary: 'Tab two' }, original),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    const winner = results.find((result) => result.status === 'fulfilled');
    assert.ok(winner && winner.status === 'fulfilled');
    assert.deepEqual(await readDailyLogDraft(userId, projectId), winner.value);
  });

  it('rejects stale or null queue baselines without any outbox/blob side effects', async () => {
    const original = await writeDailyLogDraft(userId, projectId, values);
    const newer = await writeDailyLogDraft(userId, projectId, { ...values, workSummary: 'Newer work' }, original);
    const photo = { id: 'synthetic-conflict-photo', file: new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }), category: 'standard', geo_lat: null, geo_lng: null };
    await assert.rejects(enqueueDailyLogCreate(userId, projectId, values, original, [photo]), conflict);
    await assert.rejects(enqueueDailyLogCreate(userId, projectId, values, null, [photo]), conflict);
    assert.deepEqual(await readDailyLogDraft(userId, projectId), newer);
    assert.deepEqual(await listOutboxOperations(userId), []);
    assert.equal(await readOfflineBlob(userId, photo.id), null);
  });

  it('cannot overwrite or delete a new draft after the original was queued', async () => {
    const original = await writeDailyLogDraft(userId, projectId, values);
    const queued = await enqueueDailyLogCreate(userId, projectId, values, original);
    await assert.rejects(writeDailyLogDraft(userId, projectId, values, original), conflict);
    await assert.rejects(enqueueDailyLogCreate(userId, projectId, values, original), conflict);
    const next = await writeDailyLogDraft(userId, projectId, { ...values, workSummary: 'Next log' });
    await assert.rejects(writeDailyLogDraft(userId, projectId, values, original), conflict);
    await assert.rejects(enqueueDailyLogCreate(userId, projectId, values, original), conflict);
    assert.deepEqual(await readDailyLogDraft(userId, projectId), next);
    assert.deepEqual(await listOutboxOperations(userId), [queued]);
  });

  it('still queues an absent draft with the optional null baseline', async () => {
    const queued = await enqueueDailyLogCreate(userId, projectId, values);
    assert.deepEqual(await listOutboxOperations(userId), [queued]);
    assert.equal(await readDailyLogDraft(userId, projectId), null);
  });
});
