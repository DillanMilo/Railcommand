import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { describe, it } from 'mocha';
import type {
  MobileDailyLogPhotoSyncOperation,
  MobileDailyLogSyncOperation,
} from '@railcommand/domain';
import {
  inspectUnsyncedMobileWork,
  persistMobilePhoto,
  queueMobileDraft,
  saveMobileDraft,
} from '@railcommand/offline';
import { createMobileDraft, draftToSyncOperation } from '@railcommand/domain';
import { MobileApiClient } from '@railcommand/api-client';
import { retryOperation, synchronizeMobileOutbox } from './sync';

const operation: MobileDailyLogSyncOperation = {
  operationId: 'client-a', userId: 'user-a', projectId: 'project-a', clientId: 'client-a',
  idempotencyKey: 'daily-log-create:client-a',
  payload: {
    log_date: '2026-08-20', weather_temp: 0, weather_conditions: '', weather_wind: '',
    work_summary: 'Work', safety_notes: '', geo_tag: null, personnel: [], equipment: [], work_items: [],
  },
  status: 'pending', attemptCount: 0, createdAt: '2026-08-20T12:00:00Z',
  updatedAt: '2026-08-20T12:00:00Z', nextAttemptAt: '2026-08-20T12:00:00Z', lastError: null,
};

describe('mobile foreground synchronization', () => {
  it('uses bounded retry and preserves the operation idempotency key', () => {
    const retried = retryOperation(operation, 'offline', new Date('2026-08-20T12:00:00Z'));
    assert.equal(retried.status, 'retry');
    assert.equal(retried.nextAttemptAt, '2026-08-20T12:00:02.000Z');
    assert.equal(retried.idempotencyKey, operation.idempotencyKey);
  });

  it('synchronizes the parent before its photo and clears both only after finalization', async () => {
    const events: string[] = [];
    const draft = createMobileDraft('project-a', {
      logDate: '2026-08-24', weatherConditions: '', workSummary: 'Work', safetyNotes: '',
    }, null, new Date('2026-08-24T12:00:00Z'), () => 'client-a');
    await saveMobileDraft('user-a', draft);
    await persistMobilePhoto('user-a', {
      photoId: 'photo-a', draftId: draft.draftId, projectId: draft.projectId,
      parentClientId: draft.clientId, fileName: 'track.jpg', fileType: 'image/jpeg',
      size: 5, capturedAt: draft.updatedAt, geoTag: null, blob: new Blob(['photo']),
    });
    await queueMobileDraft('user-a', draftToSyncOperation('user-a', draft));

    const api = {
      syncDailyLog: async () => { events.push('parent'); return { id: 'server-log', projectId: 'project-a', duplicate: false }; },
      prepareDailyLogPhoto: async (photo: MobileDailyLogPhotoSyncOperation) => {
        events.push(`prepare:${photo.parentEntityId}`);
        return { bucket: 'project-photos', path: 'path', token: 'token' };
      },
      finalizeDailyLogPhoto: async () => { events.push('finalize'); return { id: 'photo-a', duplicate: false }; },
    } as unknown as MobileApiClient;
    const result = await synchronizeMobileOutbox('user-a', api, async () => { events.push('upload'); });

    assert.deepEqual(events, ['parent', 'prepare:server-log', 'upload', 'finalize']);
    assert.deepEqual(result, { synchronized: 2, failed: 0 });
    assert.deepEqual(await inspectUnsyncedMobileWork('user-a'), {
      drafts: 0, operations: 0, photos: 0,
    });
  });
});
