import type { MobileDailyLogSyncOperation } from '@railcommand/domain';
import {
  completeMobileOutbox,
  listMobileOutbox,
  updateMobileOutbox,
} from '@railcommand/offline';
import { MobileApiClient, MobileApiError } from '@railcommand/api-client';

export function retryOperation(
  operation: MobileDailyLogSyncOperation,
  error: string,
  now = new Date(),
): MobileDailyLogSyncOperation {
  const attemptCount = operation.attemptCount + 1;
  const failed = attemptCount >= 5;
  const delay = Math.min(2_000 * 2 ** Math.max(attemptCount - 1, 0), 60_000);
  return {
    ...operation,
    attemptCount,
    status: failed ? 'failed' : 'retry',
    lastError: error,
    updatedAt: now.toISOString(),
    nextAttemptAt: failed ? operation.nextAttemptAt : new Date(now.getTime() + delay).toISOString(),
  };
}

export async function synchronizeMobileOutbox(
  userId: string,
  api: MobileApiClient,
): Promise<{ synchronized: number; failed: number }> {
  const operations = await listMobileOutbox(userId);
  let synchronized = 0;
  let failed = 0;
  for (const operation of operations) {
    try {
      await api.syncDailyLog(operation);
      await completeMobileOutbox(userId, operation.operationId);
      synchronized += 1;
    } catch (error) {
      const retryable = !(error instanceof MobileApiError) || error.retryable;
      const next = retryable
        ? retryOperation(operation, error instanceof Error ? error.message : 'Synchronization failed')
        : { ...operation, status: 'failed' as const, lastError: error instanceof Error ? error.message : 'Synchronization failed' };
      await updateMobileOutbox(userId, next);
      failed += 1;
    }
  }
  return { synchronized, failed };
}
