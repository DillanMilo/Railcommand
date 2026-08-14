'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  finalizeOfflineDailyLogPhotoUpload,
  prepareOfflineDailyLogPhotoUpload,
  syncOfflineDailyLogOperation,
} from '@/lib/actions/offline-sync';
import {
  completeOutboxOperation,
  DAILY_LOG_CREATE_OPERATION,
  DAILY_LOG_PHOTO_UPLOAD_OPERATION,
  failOutboxOperation,
  listOutboxOperations,
  listSyncHistory,
  OUTBOX_CHANGED_EVENT,
  readOfflineBlob,
  resetOutboxOperationForRetry,
  scheduleOutboxRetry,
  updateOutboxOperation,
  type OutboxOperation,
  type SyncHistoryItem,
} from '@/lib/offline/outbox';
import { createClient } from '@/lib/supabase/client';
import { OFFLINE_DATA_CLEARING_EVENT } from '@/lib/offline/storage';
import { usePWA } from './ServiceWorkerProvider';
import SyncCenter from '@/components/offline/SyncCenter';

export const OFFLINE_SYNC_COMPLETE_EVENT = 'railcommand:sync-complete';
const FOREGROUND_SYNC_INTERVAL_MS = 5_000;

interface OfflineSyncContextValue {
  operations: OutboxOperation[];
  history: SyncHistoryItem[];
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  operations: [],
  history: [],
  pendingCount: 0,
  failedCount: 0,
  isSyncing: false,
  syncNow: async () => {},
  retryFailed: async () => {},
});

export const useOfflineSync = () => useContext(OfflineSyncContext);

export default function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const { connectivityStatus, markSynced } = usePWA();
  const [userId, setUserId] = useState<string | null>(null);
  const [operations, setOperations] = useState<OutboxOperation[]>([]);
  const [history, setHistory] = useState<SyncHistoryItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  const connectivityRef = useRef(connectivityStatus);

  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { connectivityRef.current = connectivityStatus; }, [connectivityStatus]);

  const refreshOperations = useCallback(async () => {
    const activeUserId = userIdRef.current;
    if (!activeUserId) {
      setOperations([]);
      setHistory([]);
      return [];
    }
    const [next, recentHistory] = await Promise.all([
      listOutboxOperations(activeUserId),
      listSyncHistory(activeUserId),
    ]);
    setOperations(next);
    setHistory(recentHistory);
    return next;
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setUserId(session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOfflineDataClearing = (event: Event) => {
      const clearingUserId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (!clearingUserId || clearingUserId !== userIdRef.current) return;
      userIdRef.current = null;
      setUserId(null);
      setOperations([]);
      setHistory([]);
    };
    window.addEventListener(OFFLINE_DATA_CLEARING_EVENT, handleOfflineDataClearing);
    return () => window.removeEventListener(OFFLINE_DATA_CLEARING_EVENT, handleOfflineDataClearing);
  }, []);

  useEffect(() => {
    void refreshOperations();
  }, [refreshOperations, userId]);

  const syncNow = useCallback(async () => {
    const activeUserId = userIdRef.current;
    if (!activeUserId || connectivityRef.current !== 'online' || syncingRef.current) return;

    syncingRef.current = true;
    setIsSyncing(true);
    let synchronizedAny = false;
    try {
      const queued = await listOutboxOperations(activeUserId);
      const remainingOperationIds = new Set(queued.map((operation) => operation.operationId));
      const now = Date.now();
      for (const original of queued) {
        if (connectivityRef.current !== 'online') break;
        if (original.status === 'failed') continue;
        if (original.status === 'retry' && Date.parse(original.nextAttemptAt) > now) continue;
        if (
          original.kind === DAILY_LOG_PHOTO_UPLOAD_OPERATION
          && remainingOperationIds.has(original.parentOperationId)
        ) continue;

        const operation = original.status === 'syncing'
          ? resetOutboxOperationForRetry(original)
          : original;
        const syncingOperation: OutboxOperation = {
          ...operation,
          status: 'syncing',
          updatedAt: new Date().toISOString(),
        };
        await updateOutboxOperation(activeUserId, syncingOperation);

        let result: { success: true } | { success?: never; error: string; retryable: boolean };
        if (syncingOperation.kind === DAILY_LOG_CREATE_OPERATION) {
          result = await syncOfflineDailyLogOperation(syncingOperation);
        } else {
          const blobRecord = await readOfflineBlob(activeUserId, syncingOperation.blobId);
          if (!blobRecord) {
            result = {
              error: 'The locally saved photo is missing. Remove this failed item after confirming the original photo is available.',
              retryable: false,
            };
          } else {
            const prepared = await prepareOfflineDailyLogPhotoUpload(syncingOperation);
            if (!prepared.success) {
              result = prepared;
            } else {
              const supabase = createClient();
              const upload = await supabase.storage
                .from(prepared.data.bucket)
                .uploadToSignedUrl(
                  prepared.data.path,
                  prepared.data.token,
                  blobRecord.blob,
                  {
                    contentType: syncingOperation.payload.fileType,
                    cacheControl: '3600',
                  }
                );
              result = upload.error
                ? { error: upload.error.message, retryable: true }
                : await finalizeOfflineDailyLogPhotoUpload(syncingOperation, prepared.data);
            }
          }
        }
        if (userIdRef.current !== activeUserId) return;
        if (result.success) {
          await completeOutboxOperation(activeUserId, operation);
          remainingOperationIds.delete(operation.operationId);
          synchronizedAny = true;
          continue;
        }

        const next = result.retryable
          ? scheduleOutboxRetry(syncingOperation, result.error)
          : failOutboxOperation(syncingOperation, result.error);
        await updateOutboxOperation(activeUserId, next);
        // A log failure can block all of its child photos, but one photo upload
        // must never prevent another photo from making progress.
        if (result.retryable && syncingOperation.kind === DAILY_LOG_CREATE_OPERATION) break;
      }

      await refreshOperations();
      if (synchronizedAny) {
        await markSynced(activeUserId);
        window.dispatchEvent(new Event(OFFLINE_SYNC_COMPLETE_EVENT));
      }
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [markSynced, refreshOperations]);

  useEffect(() => {
    const handleOutboxChanged = () => {
      void refreshOperations().then(() => {
        if (connectivityRef.current === 'online') void syncNow();
      });
    };
    const handleFocus = () => void syncNow();
    window.addEventListener(OUTBOX_CHANGED_EVENT, handleOutboxChanged);
    window.addEventListener('focus', handleFocus);
    const interval = window.setInterval(() => void syncNow(), FOREGROUND_SYNC_INTERVAL_MS);
    return () => {
      window.removeEventListener(OUTBOX_CHANGED_EVENT, handleOutboxChanged);
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(interval);
    };
  }, [refreshOperations, syncNow]);

  useEffect(() => {
    if (connectivityStatus === 'online') void syncNow();
  }, [connectivityStatus, syncNow]);

  const retryFailed = useCallback(async () => {
    const activeUserId = userIdRef.current;
    if (!activeUserId) return;
    const queued = await listOutboxOperations(activeUserId);
    await Promise.all(
      queued
        .filter((operation) => operation.status === 'failed')
        .map((operation) => updateOutboxOperation(
          activeUserId,
          resetOutboxOperationForRetry(operation)
        ))
    );
    await refreshOperations();
    await syncNow();
  }, [refreshOperations, syncNow]);

  const failedCount = operations.filter((operation) => operation.status === 'failed').length;
  const pendingCount = operations.length;

  return (
    <OfflineSyncContext.Provider value={{
      operations,
      history,
      pendingCount,
      failedCount,
      isSyncing,
      syncNow,
      retryFailed,
    }}>
      {children}
      {userId && (
        <SyncCenter
          operations={operations}
          history={history}
          isSyncing={isSyncing}
          onRetry={() => void retryFailed()}
        />
      )}
    </OfflineSyncContext.Provider>
  );
}
