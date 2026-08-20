import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import type { MobileDailyLogSyncOperation } from '@railcommand/domain';
import { retryOperation } from './sync';

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
});
