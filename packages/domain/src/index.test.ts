import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  createMobileDraft,
  draftToSyncOperation,
  isValidPhotoSyncOperation,
  parseMobileDeepLink,
  photoToSyncOperation,
} from './index';

describe('mobile domain contracts', () => {
  it('parses custom and verified project links but rejects foreign hosts', () => {
    assert.deepEqual(parseMobileDeepLink('railcommand://projects/project-1'), {
      kind: 'project', projectId: 'project-1',
    });
    assert.deepEqual(
      parseMobileDeepLink('https://railcommand.io/projects/project-1/daily-logs/log-2'),
      { kind: 'daily_log', projectId: 'project-1', dailyLogId: 'log-2' },
    );
    assert.deepEqual(parseMobileDeepLink('https://example.com/projects/project-1'), {
      kind: 'unsupported',
    });
    assert.deepEqual(
      parseMobileDeepLink(
        'https://mobile-staging.railcommand.io/projects/project-1',
        ['mobile-staging.railcommand.io'],
      ),
      { kind: 'project', projectId: 'project-1' },
    );
    assert.deepEqual(
      parseMobileDeepLink('https://mobile-staging.railcommand.io/projects/project-1'),
      { kind: 'unsupported' },
    );
    assert.deepEqual(parseMobileDeepLink(`https://railcommand.io/invite/${'a'.repeat(64)}`), {
      kind: 'invitation', token: 'a'.repeat(64),
    });
  });

  it('preserves the client id and idempotency key across draft edits', () => {
    const first = createMobileDraft('project-1', {
      logDate: '2026-08-20', weatherConditions: 'Clear', workSummary: 'Track work', safetyNotes: '',
    }, null, new Date('2026-08-20T12:00:00Z'), () => 'client-1');
    const edited = createMobileDraft('project-1', {
      ...first, workSummary: 'Updated track work',
    }, first, new Date('2026-08-20T12:05:00Z'));
    const operation = draftToSyncOperation('user-a', edited);
    assert.equal(edited.clientId, 'client-1');
    assert.equal(edited.idempotencyKey, 'daily-log-create:client-1');
    assert.equal(operation.operationId, 'client-1');
    assert.equal(operation.payload.work_summary, 'Updated track work');
  });

  it('preserves optional device location in the draft and queued payload', () => {
    const geoTag = {
      lat: 41.8781,
      lng: -87.6298,
      accuracy: 12,
      timestamp: '2026-08-24T12:00:00.000Z',
    };
    const draft = createMobileDraft('project-1', {
      logDate: '2026-08-24',
      weatherConditions: 'Clear',
      workSummary: 'Track inspection',
      safetyNotes: '',
      geoTag,
    });

    assert.deepEqual(draft.geoTag, geoTag);
    assert.deepEqual(draftToSyncOperation('user-1', draft).payload.geo_tag, geoTag);
  });

  it('allows a user to remove an optional location from an existing draft', () => {
    const located = createMobileDraft('project-a', {
      logDate: '2026-08-24',
      weatherConditions: '',
      workSummary: 'Located work',
      safetyNotes: '',
      geoTag: { lat: 41.88, lng: -87.63, timestamp: '2026-08-24T12:00:00.000Z' },
    }, null, new Date('2026-08-24T12:00:00.000Z'), () => 'client-a');
    const cleared = createMobileDraft('project-a', {
      logDate: located.logDate,
      weatherConditions: located.weatherConditions,
      workSummary: located.workSummary,
      safetyNotes: located.safetyNotes,
      geoTag: null,
    }, located, new Date('2026-08-24T12:01:00.000Z'));

    assert.equal(cleared.geoTag, null);
  });

  it('creates an idempotent child-photo operation after the server assigns the parent ID', () => {
    const blob = new Blob(['photo'], { type: 'image/jpeg' });
    const operation = photoToSyncOperation('user-a', {
      photoId: 'photo-a',
      draftId: 'daily-log:project-a',
      projectId: 'project-a',
      parentClientId: 'client-a',
      fileName: 'track.jpg',
      fileType: blob.type,
      size: blob.size,
      capturedAt: '2026-08-24T12:00:00.000Z',
      geoTag: { lat: 41.88, lng: -87.63, timestamp: '2026-08-24T12:00:00.000Z' },
      blob,
    }, 'server-daily-log-a');

    assert.equal(operation.parentEntityId, 'server-daily-log-a');
    assert.equal(operation.idempotencyKey, 'daily-log-photo:photo-a');
    assert.equal(operation.payload.geoLat, 41.88);
    assert.equal(isValidPhotoSyncOperation(operation), true);
  });
});
