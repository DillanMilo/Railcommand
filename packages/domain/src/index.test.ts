import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createMobileDraft, draftToSyncOperation, parseMobileDeepLink } from './index';

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
});
