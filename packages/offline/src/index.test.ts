import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'mocha';
import { createMobileDraft, draftToSyncOperation, type MobileBootstrap } from '@railcommand/domain';
import {
  cacheMobileBootstrap,
  clearMobileUserData,
  coalesceMobileOutbox,
  inspectUnsyncedMobileWork,
  listMobileOutbox,
  listMobilePhotos,
  listMobilePhotosForOperation,
  mobileDatabaseName,
  persistMobilePhoto,
  queueMobileDraft,
  readCachedMobileBootstrap,
  readMobileDraft,
  saveMobileDraft,
} from './index';

const users = ['user-a', 'user-b'];

afterEach(async () => {
  await Promise.all(users.map((user) => clearMobileUserData(user).catch(() => undefined)));
});

function bootstrap(userId: string, projectId: string): MobileBootstrap {
  return {
    userId,
    projects: [{
      id: projectId, name: projectId, status: 'active', location: 'Synthetic', client: 'QA',
      role: 'manager', canEdit: true, updatedAt: '2026-08-20T12:00:00.000Z',
    }],
    activeProjectId: projectId,
    dailyLogs: [],
    synchronizedAt: '2026-08-20T12:00:00.000Z',
  };
}

describe('mobile offline storage', () => {
  it('partitions cached data A → B → A without cross-user reads', async () => {
    await cacheMobileBootstrap('user-a', bootstrap('user-a', 'project-a'));
    await cacheMobileBootstrap('user-b', bootstrap('user-b', 'project-b'));
    assert.equal((await readCachedMobileBootstrap('user-a'))?.value.activeProjectId, 'project-a');
    assert.equal((await readCachedMobileBootstrap('user-b'))?.value.activeProjectId, 'project-b');
    assert.notEqual(mobileDatabaseName('user-a'), mobileDatabaseName('user-b'));
    assert.equal((await readCachedMobileBootstrap('user-a'))?.value.activeProjectId, 'project-a');
  });

  it('atomically moves a draft to an idempotent outbox operation', async () => {
    const draft = createMobileDraft('project-a', {
      logDate: '2026-08-20', weatherConditions: 'Clear', workSummary: 'Work', safetyNotes: '',
    }, null, new Date('2026-08-20T12:00:00Z'), () => 'client-a');
    await saveMobileDraft('user-a', draft);
    await queueMobileDraft('user-a', draftToSyncOperation('user-a', draft));
    assert.equal(await readMobileDraft('user-a', 'project-a'), null);
    const operations = await listMobileOutbox('user-a', Date.parse('2026-08-20T12:01:00Z'));
    assert.equal(operations.length, 1);
    assert.equal(operations[0].idempotencyKey, 'daily-log-create:client-a');
  });

  it('coalesces repeat submissions for one project day onto the first idempotency key', async () => {
    const first = createMobileDraft('project-a', {
      logDate: '2026-08-20', weatherConditions: 'Clear', workSummary: 'First', safetyNotes: '',
    }, null, new Date('2026-08-20T12:00:00Z'), () => 'client-a');
    const repeated = createMobileDraft('project-a', {
      logDate: '2026-08-20', weatherConditions: 'Clear', workSummary: 'Latest', safetyNotes: '',
    }, null, new Date('2026-08-20T12:00:07Z'), () => 'client-b');
    await saveMobileDraft('user-a', first);
    await queueMobileDraft('user-a', draftToSyncOperation('user-a', first));
    await saveMobileDraft('user-a', repeated);
    await queueMobileDraft('user-a', draftToSyncOperation('user-a', repeated));

    assert.equal(await coalesceMobileOutbox('user-a'), 1);
    const operations = await listMobileOutbox('user-a', Date.parse('2026-08-20T12:01:00Z'));
    assert.equal(operations.length, 1);
    assert.equal(operations[0].operationId, 'client-a');
    assert.equal(operations[0].idempotencyKey, 'daily-log-create:client-a');
    assert.equal(operations[0].payload.work_summary, 'Latest');
  });

  it('persists a photo blob with its draft and reports it before safe sign-out', async () => {
    const blob = new Blob(['photo-bytes'], { type: 'image/jpeg' });
    await persistMobilePhoto('user-a', {
      photoId: 'photo-a', draftId: 'daily-log:project-a', projectId: 'project-a',
      parentClientId: 'client-a',
      fileName: 'track.jpg', fileType: blob.type, size: blob.size,
      capturedAt: '2026-08-20T12:00:00Z', geoTag: null, blob,
    });
    const photos = await listMobilePhotos('user-a', 'daily-log:project-a');
    assert.equal(photos.length, 1);
    assert.equal(await photos[0].blob.text(), 'photo-bytes');
    assert.deepEqual(await inspectUnsyncedMobileWork('user-a'), {
      drafts: 0, operations: 0, photos: 1,
    });
  });

  it('keeps child photos attached to the first idempotent parent during coalescing', async () => {
    const first = createMobileDraft('project-a', {
      logDate: '2026-08-20', weatherConditions: '', workSummary: 'First', safetyNotes: '',
    }, null, new Date('2026-08-20T12:00:00Z'), () => 'client-a');
    const repeated = createMobileDraft('project-a', {
      logDate: '2026-08-20', weatherConditions: '', workSummary: 'Latest', safetyNotes: '',
    }, null, new Date('2026-08-20T12:01:00Z'), () => 'client-b');
    await saveMobileDraft('user-a', first);
    await queueMobileDraft('user-a', draftToSyncOperation('user-a', first));
    await saveMobileDraft('user-a', repeated);
    await persistMobilePhoto('user-a', {
      photoId: 'photo-b', draftId: repeated.draftId, projectId: repeated.projectId,
      parentClientId: repeated.clientId, fileName: 'track.jpg', fileType: 'image/jpeg',
      size: 5, capturedAt: repeated.updatedAt, geoTag: null, blob: new Blob(['photo']),
    });
    await queueMobileDraft('user-a', draftToSyncOperation('user-a', repeated));

    await coalesceMobileOutbox('user-a');
    assert.equal((await listMobilePhotosForOperation('user-a', 'client-a')).length, 1);
    assert.equal((await listMobilePhotosForOperation('user-a', 'client-b')).length, 0);
  });
});
