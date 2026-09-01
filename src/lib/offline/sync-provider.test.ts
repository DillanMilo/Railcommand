import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import {
  DAILY_LOG_CREATE_OPERATION,
  DAILY_LOG_PHOTO_UPLOAD_OPERATION,
  failOutboxOperation,
  MAX_SYNC_ATTEMPTS,
  resetOutboxOperationForRetry,
  scheduleOutboxRetry,
  type OutboxOperation,
} from './outbox';

// Execute the real callback without mounting React or contacting any backend.
// Only transport/storage are mocked; retry transitions use the real outbox code.
const source = ts.createSourceFile(
  'OfflineSyncProvider.tsx',
  readFileSync(new URL('../../components/providers/OfflineSyncProvider.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let callback: ts.Expression | undefined;
function findCallback(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'syncNow'
    && node.initializer && ts.isCallExpression(node.initializer)) {
    callback = node.initializer.arguments[0];
  }
  ts.forEachChild(node, findCallback);
}
findCallback(source);
assert.ok(callback, 'OfflineSyncProvider must define its syncNow callback');
const compiledCallback = ts.transpileModule(`const syncNow = ${callback.getText(source)}; syncNow;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function operation(photo = false): OutboxOperation {
  const base = {
    operationId: photo ? 'synthetic-photo' : 'synthetic-log',
    projectId: 'synthetic-project',
    idempotencyKey: 'synthetic-idempotency-key',
    status: 'pending' as const,
    attemptCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    nextAttemptAt: '2026-01-01T00:00:00.000Z',
    lastError: null,
  };
  return photo ? {
    ...base,
    kind: DAILY_LOG_PHOTO_UPLOAD_OPERATION,
    parentOperationId: 'already-synced-parent',
    parentEntityId: 'synthetic-parent',
    blobId: 'synthetic-blob',
    payload: {
      fileName: 'synthetic.jpg', fileType: 'image/jpeg', fileSize: 4, originalSize: 4,
      photoCategory: 'standard', geoLat: null, geoLng: null, capturedAt: base.createdAt,
    },
  } : {
    ...base,
    kind: DAILY_LOG_CREATE_OPERATION,
    clientId: 'synthetic-log',
    payload: {
      log_date: '2026-01-01', weather_temp: 72, weather_conditions: 'Clear', weather_wind: '',
      work_summary: 'Preserve this field work', safety_notes: '', geo_tag: null,
      personnel: [], equipment: [], work_items: [],
    },
  };
}

function harness(initial: OutboxOperation, overrides: Record<string, unknown> = {}) {
  let queued = initial;
  const updates: OutboxOperation[] = [];
  const completed: string[] = [];
  const userIdRef = { current: 'synthetic-user-a' };
  const syncingRef = { current: false };
  const syncStates: boolean[] = [];
  const context = {
    Date, Error, Event,
    userIdRef, syncingRef, connectivityRef: { current: 'online' },
    DAILY_LOG_CREATE_OPERATION, DAILY_LOG_PHOTO_UPLOAD_OPERATION,
    resetOutboxOperationForRetry, scheduleOutboxRetry, failOutboxOperation,
    setIsSyncing: (syncing: boolean) => syncStates.push(syncing),
    listOutboxOperations: async () => [queued],
    updateOutboxOperation: async (userId: string, next: OutboxOperation) => {
      assert.equal(userId, 'synthetic-user-a');
      updates.push(next);
      queued = next;
    },
    completeOutboxOperation: async (_userId: string, item: OutboxOperation) => completed.push(item.operationId),
    syncOfflineDailyLogOperation: async () => ({ success: true }),
    readOfflineBlob: async () => ({ blob: new Blob(['test']) }),
    prepareOfflineDailyLogPhotoUpload: async () => ({ success: true, data: { bucket: 'qa', path: 'qa', token: 'qa' } }),
    createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: async () => ({ error: null }) }) } }),
    finalizeOfflineDailyLogPhotoUpload: async () => ({ success: true }),
    simulatePostUploadInterruptionOnce: () => false,
    refreshOperations: async () => {},
    markSynced: async () => {},
    window: { dispatchEvent: () => {} },
    OFFLINE_SYNC_COMPLETE_EVENT: 'test:sync-complete',
    ...overrides,
  };
  return {
    syncNow: runInNewContext(compiledCallback, context) as () => Promise<void>,
    updates, completed, userIdRef, syncingRef, syncStates,
  };
}

describe('offline foreground synchronization transport failures', () => {
  const disconnect = async () => { throw new TypeError('Failed to fetch'); };
  const cases: [string, boolean, Record<string, unknown>][] = [
    ['daily-log create', false, { syncOfflineDailyLogOperation: disconnect }],
    ['photo authorization', true, { prepareOfflineDailyLogPhotoUpload: disconnect }],
    ['photo upload', true, { createClient: () => ({ storage: { from: () => ({ uploadToSignedUrl: disconnect }) } }) }],
    ['photo finalization', true, { finalizeOfflineDailyLogPhotoUpload: disconnect }],
  ];
  for (const [stage, photo, overrides] of cases) {
    it(`persists bounded retry state after a thrown ${stage} request`, async () => {
      const original = operation(photo);
      const test = harness(original, overrides);
      await test.syncNow();
      const next = test.updates.at(-1)!;
      assert.equal(next.status, 'retry');
      assert.equal(next.attemptCount, 1);
      assert.equal(next.lastError, 'Failed to fetch');
      assert.ok(Date.parse(next.nextAttemptAt) > Date.parse(next.updatedAt));
      assert.equal(next.idempotencyKey, original.idempotencyKey);
      assert.equal(next.payload, original.payload);
      assert.equal(test.completed.length, 0);
      assert.deepEqual(test.syncStates, [true, false]);
      assert.equal(test.syncingRef.current, false);
      await test.syncNow();
      assert.equal(test.updates.length, 2, 'must not retry before nextAttemptAt');
    });
  }

  it('stops automatic retries at the existing attempt limit without removing work', async () => {
    const test = harness({ ...operation(), attemptCount: MAX_SYNC_ATTEMPTS - 1 }, { syncOfflineDailyLogOperation: disconnect });
    await test.syncNow();
    assert.equal(test.updates.at(-1)?.status, 'failed');
    assert.equal(test.updates.at(-1)?.attemptCount, MAX_SYNC_ATTEMPTS);
    assert.equal(test.completed.length, 0);
  });

  it('preserves permanent server rejection behavior', async () => {
    const test = harness(operation(), {
      syncOfflineDailyLogOperation: async () => ({ error: 'Permission denied', retryable: false }),
    });
    await test.syncNow();
    assert.equal(test.updates.at(-1)?.status, 'failed');
    assert.equal(test.updates.at(-1)?.lastError, 'Permission denied');
    assert.equal(test.completed.length, 0);
  });

  it('does not update or complete another user’s queue after an account switch', async () => {
    const test = harness(operation(), {
      syncOfflineDailyLogOperation: async () => {
        test.userIdRef.current = 'synthetic-user-b';
        throw new TypeError('Failed to fetch');
      },
    });
    await test.syncNow();
    assert.equal(test.updates.length, 1, 'only the initial syncing transition should be persisted');
    assert.equal(test.completed.length, 0);
    assert.equal(test.syncingRef.current, false);
  });
});
