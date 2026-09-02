import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { MobileApiError } from '@railcommand/api-client';
import type { MobileDailyLogPhotoSyncOperation } from '@railcommand/domain';
import type { ExpoDailyLogSyncOperation, ExpoStoredPhoto } from './offline-store';

const ownerA = '11111111-1111-4111-8111-111111111111';
const ownerB = '22222222-2222-4222-8222-222222222222';
const projectId = '33333333-3333-4333-8333-333333333333';
type Current = () => boolean;
type State = 'retrying' | 'failed' | 'conflicted';
type Phase = 'listOutbox' | 'listPhotos' | 'parent' | 'markPhoto:retrying' | 'prepare' | 'upload' | 'finalize' | 'completion';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function operation(index: number): ExpoDailyLogSyncOperation {
  return {
    operationId: `log-${index}`, userId: ownerA, projectId, clientId: `client-${index}`,
    idempotencyKey: `daily-log:client-${index}`, photoManifestVersion: 1, photoIds: [`photo-${index}`],
    payload: { log_date: '2026-08-30', weather_temp: 70, weather_conditions: 'Clear', weather_wind: '',
      work_summary: `Preserved field work ${index}`, safety_notes: '', geo_tag: null, personnel: [], equipment: [], work_items: [] },
    status: 'pending', attemptCount: 0, createdAt: '2026-08-30T12:00:00Z', updatedAt: '2026-08-30T12:00:00Z',
    nextAttemptAt: '2026-08-30T12:00:00Z', lastError: null,
  };
}

function photo(index: number): ExpoStoredPhoto {
  return { photoId: `photo-${index}`, projectId, parentClientId: `client-${index}`,
    uri: `file:///owned/${ownerA}/photo-${index}.jpg`, fileName: `photo-${index}.jpg`, fileType: 'image/jpeg',
    size: 100, capturedAt: '2026-08-30T12:00:00Z', geoTag: null, status: 'pending', lastError: null };
}

// Execute the real worker, replacing only its native/auth/API/storage boundaries.
// Deferred calls model already-dispatched work: cancellation cannot roll it back,
// but must prevent all later dispatches, failure writes, and owned-file deletion.
function syncHarness(options: {
  owner?: string | null;
  pauseAt?: Phase;
  failAt?: Phase;
  error?: Error;
  sessionFailure?: 'throw' | 'returned';
} = {}) {
  let owner = options.owner === undefined ? ownerA : options.owner;
  let storageGeneration = 0;
  let providerCurrent = true;
  let unsubscribeCount = 0;
  let paused = false;
  let failureEnabled = true;
  const reached = deferred();
  const released = deferred();
  const calls: string[] = [];
  const mutations: string[] = [];
  const failureMessages: string[] = [];
  const parentRequests: string[] = [];
  const photoRequests: string[] = [];
  const guards: Current[] = [];
  const pending = new Set(['log-1', 'log-2']);
  const operations = [operation(1), operation(2)];
  const photos = [photo(1), photo(2)];
  type Session = { user: { id: string }; access_token: string } | null;
  const listeners = new Set<(event: string, session: Session) => void>();
  const session = (): Session => owner ? { user: { id: owner }, access_token: `token:${owner}` } : null;

  async function phase(name: string, detail?: string) {
    calls.push(detail ? `${name}:${detail}` : name);
    if (name === options.pauseAt && !paused) {
      paused = true;
      reached.resolve();
      await released.promise;
    }
    if (failureEnabled && name === options.failAt) throw options.error ?? new Error('Temporary connection loss');
  }

  function captureGuard(userId: string, current: Current): Current {
    assert.equal(userId, ownerA, 'every local operation retains its captured owner');
    assert.equal(typeof current, 'function', 'storage operations receive a current-scope guard');
    guards.push(current);
    assert.equal(current(), true, 'no local operation is dispatched after cancellation');
    return current;
  }

  const offlineStore = {
    async listExpoOutbox(userId: string, current: Current) {
      captureGuard(userId, current);
      await phase('listOutbox');
      // Return the original rows even after invalidation to exercise worker checks.
      return operations;
    },
    async listExpoPhotos(userId: string, clientId: string, current: Current) {
      captureGuard(userId, current);
      await phase('listPhotos', clientId);
      return photos.filter((item) => item.parentClientId === clientId);
    },
    async markExpoOutbox(userId: string, item: ExpoDailyLogSyncOperation, state: State, message: string, current: Current) {
      captureGuard(userId, current);
      await phase(`markOutbox:${state}`, item.operationId);
      if (current()) { mutations.push(`outbox:${item.operationId}:${state}`); failureMessages.push(message); }
    },
    async markExpoPhoto(userId: string, item: ExpoStoredPhoto, state: State, message: string | null, current: Current) {
      captureGuard(userId, current);
      await phase(`markPhoto:${state}`, item.photoId);
      if (current()) {
        mutations.push(`photo:${item.photoId}:${state}`);
        if (message) failureMessages.push(message);
      }
    },
    async completeExpoSync(userId: string, item: ExpoDailyLogSyncOperation, children: ExpoStoredPhoto[], current: Current) {
      captureGuard(userId, current);
      await phase('completion', item.operationId);
      if (!current()) return;
      assert.deepEqual(Array.from(children, (child) => child.photoId), item.photoIds);
      mutations.push(`complete:${item.operationId}`);
      pending.delete(item.operationId);
    },
  };

  function mobileApiForUser(userId: string, current: Current) {
    assert.equal(userId, ownerA);
    assert.equal(typeof current, 'function', 'the API is bound to this run’s current-scope predicate');
    guards.push(current);
    async function dispatch(name: Phase, id: string) {
      if (owner !== userId || !current()) throw new Error('API owner changed');
      await phase(name, id);
    }
    return {
      async syncDailyLog(item: ExpoDailyLogSyncOperation) {
        assert.equal(item.userId, userId);
        parentRequests.push(JSON.stringify(item));
        await dispatch('parent', item.operationId);
        return { id: `server:${item.clientId}`, projectId, duplicate: false };
      },
      async prepareDailyLogPhoto(item: MobileDailyLogPhotoSyncOperation) {
        assert.equal(item.userId, userId);
        assert.equal(item.parentEntityId, `server:${item.operationId.replace('photo-', 'client-')}`);
        assert.equal(item.idempotencyKey, `daily-log-photo:${item.operationId}`);
        photoRequests.push(JSON.stringify(item));
        await dispatch('prepare', item.operationId);
        return { bucket: 'private-photos', path: `${userId}/${item.operationId}`, token: 'signed-token' };
      },
      async finalizeDailyLogPhoto(item: MobileDailyLogPhotoSyncOperation) {
        photoRequests.push(JSON.stringify(item));
        await dispatch('finalize', item.operationId);
        return { id: `server:${item.operationId}`, duplicate: false };
      },
    };
  }

  const { outputText } = ts.transpileModule(readFileSync(new URL('./sync.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const compiledModule = { exports: {} as { synchronizeExpoOutbox?: (userId: string, isCurrent?: Current) => Promise<number> } };
  runInNewContext(outputText, {
    module: compiledModule, exports: compiledModule.exports, Error, console,
    require(name: string) {
      if (name === 'expo-file-system') return { File: class { constructor(public uri: string) {} } };
      if (name === '@railcommand/api-client') return { MobileApiError };
      if (name === './api') return { mobileApiForUser };
      if (name === './offline-store') return offlineStore;
      if (name === './storage-scope') return {
        captureOfflineScope(userId: string) {
          assert.equal(userId, ownerA);
          const generation = storageGeneration;
          return () => generation === storageGeneration;
        },
      };
      if (name === './device') return {
        deleteOwnedFieldPhoto(userId: string, item: ExpoStoredPhoto) {
          assert.equal(userId, ownerA);
          calls.push(`delete:${item.photoId}`);
          mutations.push(`delete:${item.photoId}`);
        },
      };
      if (name === './supabase') return { supabase: {
        auth: {
          async getSession() {
            if (options.sessionFailure === 'throw') throw new Error('Session storage unavailable');
            return { data: { session: session() }, error: options.sessionFailure === 'returned' ? new Error('Session unavailable') : null };
          },
          onAuthStateChange(listener: (event: string, value: Session) => void) {
            listeners.add(listener);
            return { data: { subscription: { unsubscribe() { listeners.delete(listener); unsubscribeCount += 1; } } } };
          },
        },
        storage: { from(bucket: string) {
          assert.equal(bucket, 'private-photos');
          return { async uploadToSignedUrl(path: string, token: string, file: { uri: string }) {
            assert.equal(token, 'signed-token');
            assert.match(file.uri, new RegExp(ownerA));
            await phase('upload', path);
            return { error: null };
          } };
        } },
      } };
      throw new Error(`Unexpected sync test dependency: ${name}`);
    },
  });
  const synchronize = compiledModule.exports.synchronizeExpoOutbox!;
  return {
    calls, mutations, pending, guards, failureMessages, parentRequests, photoRequests,
    reached: reached.promise, release: released.resolve,
    savedInputSnapshot: () => JSON.stringify({ operations, photos }),
    allowRequests() { failureEnabled = false; },
    run: (useProviderGuard = false) => useProviderGuard ? synchronize(ownerA, () => providerCurrent) : synchronize(ownerA),
    switchOwner(nextOwner: string | null) {
      owner = nextOwner;
      for (const listener of listeners) listener(nextOwner ? 'SIGNED_IN' : 'SIGNED_OUT', session());
    },
    purge() { storageGeneration += 1; },
    cancelProvider() { providerCurrent = false; },
    get unsubscribeCount() { return unsubscribeCount; },
    get listenerCount() { return listeners.size; },
  };
}

describe('mobile outbox session and purge cancellation', () => {
  it('synchronizes two logs and their photos for an unchanged owner, then releases its auth listener', async () => {
    const worker = syncHarness();
    assert.equal(await worker.run(), 4);
    assert.deepEqual(worker.calls, [
      'listOutbox', 'listPhotos:client-1', 'parent:log-1', 'markPhoto:retrying:photo-1', 'prepare:photo-1',
      `upload:${ownerA}/photo-1`, 'finalize:photo-1', 'completion:log-1', 'delete:photo-1',
      'listPhotos:client-2', 'parent:log-2', 'markPhoto:retrying:photo-2', 'prepare:photo-2',
      `upload:${ownerA}/photo-2`, 'finalize:photo-2', 'completion:log-2', 'delete:photo-2',
    ]);
    assert.equal(worker.pending.size, 0);
    assert.equal(worker.listenerCount, 0);
    assert.equal(worker.unsubscribeCount, 1);
  });

  for (const owner of [ownerB, null]) {
    it(`does not read or send A’s outbox when the initial session is ${owner ? 'B' : 'signed out'}`, async () => {
      const worker = syncHarness({ owner });
      assert.equal(await worker.run(), 0);
      assert.deepEqual(worker.calls, []);
      assert.deepEqual(worker.mutations, []);
      assert.equal(worker.pending.size, 2);
      assert.equal(worker.listenerCount, 0);
    });
  }

  for (const sessionFailure of ['throw', 'returned'] as const) {
    it(`preserves the queue when session verification fails via ${sessionFailure}`, async () => {
      const worker = syncHarness({ sessionFailure });
      assert.equal(await worker.run(), 0);
      assert.deepEqual(worker.calls, []);
      assert.deepEqual(worker.mutations, []);
      assert.equal(worker.pending.size, 2);
      assert.equal(worker.listenerCount, 0);
      assert.equal(worker.unsubscribeCount, 1);
    });
  }

  it('does not start work when the caller’s scope was already invalidated', async () => {
    const worker = syncHarness();
    worker.cancelProvider();
    assert.equal(await worker.run(true), 0);
    assert.deepEqual(worker.calls, []);
    assert.deepEqual(worker.mutations, []);
    assert.equal(worker.pending.size, 2);
    assert.equal(worker.listenerCount, 0);
  });

  const phases: Phase[] = ['listOutbox', 'listPhotos', 'parent', 'markPhoto:retrying', 'prepare', 'upload', 'finalize', 'completion'];
  for (const pauseAt of phases) {
    for (const reason of ['account switch', 'sign-out', 'A→B→A', 'purge', 'provider cancellation'] as const) {
      it(`stops after awaited ${pauseAt} on ${reason}, preserving queued work without false failure`, async () => {
        const worker = syncHarness({ pauseAt });
        const running = worker.run(reason === 'provider cancellation');
        await worker.reached;
        const dispatched = worker.calls.slice();
        const existingMutations = worker.mutations.slice();
        if (reason === 'account switch') worker.switchOwner(ownerB);
        if (reason === 'sign-out') worker.switchOwner(null);
        if (reason === 'A→B→A') { worker.switchOwner(ownerB); worker.switchOwner(ownerA); }
        if (reason === 'purge') worker.purge();
        if (reason === 'provider cancellation') worker.cancelProvider();
        worker.release();
        assert.equal(await running, 0);
        assert.deepEqual(worker.calls, dispatched, 'no API, local status/completion, next operation, or file deletion follows cancellation');
        assert.deepEqual(worker.mutations, existingMutations, 'guarded in-flight storage work does not write after invalidation');
        assert.equal(worker.pending.size, 2, 'no queued log is removed');
        assert.equal(worker.mutations.some((value) => /:failed$|:conflicted$/.test(value)), false);
        assert.equal(worker.listenerCount, 0);
        assert.equal(worker.unsubscribeCount, 1);
        assert.equal(worker.guards.every((current) => !current()), true, 'captured guards stay invalid, including after A returns');
      });
    }
  }

  for (const [label, error, state] of [
    ['transient', new MobileApiError('Service unavailable', 503, true), 'retrying'],
    ['permanent', new MobileApiError('Permission denied', 403, false), 'failed'],
    ['conflict', new MobileApiError('Server conflict', 409, false), 'conflicted'],
  ] as const) {
    it(`retains ordinary ${label} failure handling while A remains signed in`, async () => {
      const worker = syncHarness({ failAt: 'parent', error });
      assert.equal(await worker.run(), 0);
      assert.deepEqual(worker.mutations, [
        `outbox:log-1:${state}`, `photo:photo-1:${state}`,
        `outbox:log-2:${state}`, `photo:photo-2:${state}`,
      ]);
      assert.equal(worker.pending.size, 2);
      assert.equal(worker.calls.some((value) => value.startsWith('delete:') || value.startsWith('completion:')), false);
      assert.equal(worker.listenerCount, 0);
    });
  }

  for (const failAt of ['parent', 'prepare', 'finalize'] as const) {
    it(`pauses after an unrecovered ${failAt} 401, retains identities/input/photos, and resumes on a fresh run`, async () => {
      const worker = syncHarness({ failAt, error: new MobileApiError('Private backend session diagnostic', 401, false) });
      const originalInputs = worker.savedInputSnapshot();
      assert.equal(await worker.run(), 0);
      assert.deepEqual(worker.mutations, [
        ...(failAt === 'parent' ? [] : ['photo:photo-1:retrying']),
        'outbox:log-1:retrying', 'photo:photo-1:retrying',
      ]);
      assert.deepEqual(worker.failureMessages, Array(2).fill(
        'Session could not be verified. Work remains on this device; sign in or retry online.',
      ));
      assert.equal(worker.pending.size, 2);
      assert.equal(worker.savedInputSnapshot(), originalInputs, 'Worker leaves payload, UUID/key, manifest and photo URI unchanged');
      assert.equal(worker.calls.some((value) => /log-2|client-2|photo-2|^completion:|^delete:/.test(value)), false,
        'The current failure cannot dispatch the next row, remove outbox data, or delete a photo file');
      assert.equal(worker.guards.every((current) => !current()), true, 'The paused batch cannot be revived');
      assert.equal(worker.listenerCount, 0);
      const originalParentRequest = worker.parentRequests[0];
      const originalPhotoRequest = worker.photoRequests[0];
      worker.allowRequests();
      assert.equal(await worker.run(), 4, 'A later foreground run gets its own valid lifetime');
      const before = JSON.parse(originalParentRequest);
      const resumed = JSON.parse(worker.parentRequests[1]);
      for (const key of ['operationId', 'clientId', 'idempotencyKey', 'payload', 'photoManifestVersion', 'photoIds']) {
        assert.deepEqual(resumed[key], before[key], `Resume retains parent ${key}; attempt/status metadata may change`);
      }
      if (originalPhotoRequest) {
        assert.ok(worker.photoRequests.filter((value) => value === originalPhotoRequest).length >= 2,
          'Resume retains the photo operation ID and key');
      }
      assert.equal(worker.pending.size, 0);
      assert.equal(worker.listenerCount, 0);
      assert.equal(worker.unsubscribeCount, 2);
    });
  }

  for (const [failAt, reason] of [
    ['parent', 'A→B→A'], ['prepare', 'purge'], ['finalize', 'account switch'],
  ] as const) {
    it(`does not write a ${failAt} 401 status after ${reason}`, async () => {
      const worker = syncHarness({ pauseAt: failAt, failAt, error: new MobileApiError('Private session detail', 401, false) });
      const originalInputs = worker.savedInputSnapshot();
      const running = worker.run();
      await worker.reached;
      const dispatched = worker.calls.slice();
      const mutations = worker.mutations.slice();
      if (reason === 'purge') worker.purge();
      else {
        worker.switchOwner(ownerB);
        if (reason === 'A→B→A') worker.switchOwner(ownerA);
      }
      worker.release();
      assert.equal(await running, 0);
      assert.deepEqual(worker.calls, dispatched, 'No dispatch can use a replacement account session');
      assert.deepEqual(worker.mutations, mutations);
      assert.deepEqual(worker.failureMessages, []);
      assert.equal(worker.savedInputSnapshot(), originalInputs);
      assert.equal(worker.pending.size, 2);
      assert.equal(worker.listenerCount, 0);
    });
  }

  it('does not turn an in-flight API failure into a permanent error after the owner changes', async () => {
    const worker = syncHarness({ pauseAt: 'parent', failAt: 'parent', error: new MobileApiError('Wrong session', 403, false) });
    const running = worker.run();
    await worker.reached;
    const dispatched = worker.calls.slice();
    worker.switchOwner(ownerB);
    worker.release();
    assert.equal(await running, 0);
    assert.deepEqual(worker.calls, dispatched);
    assert.deepEqual(worker.mutations, []);
    assert.equal(worker.pending.size, 2);
    assert.equal(worker.listenerCount, 0);
  });
});
