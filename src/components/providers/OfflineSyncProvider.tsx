'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
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
import {
  clearOfflineDataForUser,
  estimateOfflineStorage,
  OFFLINE_DATA_CLEARING_EVENT,
  type OfflineStorageEstimate,
} from '@/lib/offline/storage';
import { listDailyLogDrafts, type DailyLogDraftRecord } from '@/lib/offline/daily-log-draft';
import { usePWA } from './ServiceWorkerProvider';
import SyncCenter from '@/components/offline/SyncCenter';
import PendingWorkSignOutDialog from '@/components/offline/PendingWorkSignOutDialog';

export const OFFLINE_SYNC_COMPLETE_EVENT = 'railcommand:sync-complete';
const FOREGROUND_SYNC_INTERVAL_MS = 5_000;

function simulatePostUploadInterruptionOnce(operationId: string): boolean {
  if (
    process.env.NODE_ENV !== 'development'
    || typeof window === 'undefined'
    || new URLSearchParams(window.location.search).get('simulate-photo-finalize-interruption') !== '1'
  ) return false;
  const key = `rc-qa-photo-interruption:${operationId}`;
  if (sessionStorage.getItem(key)) return false;
  sessionStorage.setItem(key, '1');
  return true;
}

interface OfflineSyncContextValue {
  operations: OutboxOperation[];
  history: SyncHistoryItem[];
  pendingCount: number;
  failedCount: number;
  isSyncing: boolean;
  storageEstimate: OfflineStorageEstimate | null;
  syncNow: () => Promise<void>;
  retryFailed: () => Promise<void>;
  requestSignOut: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextValue>({
  operations: [],
  history: [],
  pendingCount: 0,
  failedCount: 0,
  isSyncing: false,
  storageEstimate: null,
  syncNow: async () => {},
  retryFailed: async () => {},
  requestSignOut: async () => {},
});

export const useOfflineSync = () => useContext(OfflineSyncContext);

export default function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { connectivityStatus, markSynced } = usePWA();
  const [userId, setUserId] = useState<string | null>(null);
  const [operations, setOperations] = useState<OutboxOperation[]>([]);
  const [history, setHistory] = useState<SyncHistoryItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageEstimate, setStorageEstimate] = useState<OfflineStorageEstimate | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signOutOperations, setSignOutOperations] = useState<OutboxOperation[]>([]);
  const [signOutDrafts, setSignOutDrafts] = useState<DailyLogDraftRecord[]>([]);
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
      setStorageEstimate(null);
      return [];
    }
    const [next, recentHistory, nextStorageEstimate] = await Promise.all([
      listOutboxOperations(activeUserId),
      listSyncHistory(activeUserId),
      estimateOfflineStorage(),
    ]);
    setOperations(next);
    setHistory(recentHistory);
    setStorageEstimate(nextStorageEstimate);
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
      setStorageEstimate(null);
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
                : simulatePostUploadInterruptionOnce(syncingOperation.operationId)
                  ? {
                      error: 'Acceptance test: connection dropped after upload and before finalization.',
                      retryable: true,
                    }
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

  const completeSignOut = useCallback(async () => {
    const activeUserId = userIdRef.current;
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;

    if (activeUserId) await clearOfflineDataForUser(activeUserId);
    await fetch('/api/demo/local-session', { method: 'DELETE' }).catch(() => {});
    try {
      localStorage.removeItem('rc-mode');
      localStorage.removeItem('rc-user-name');
      localStorage.removeItem('rc-user-email');
      localStorage.removeItem('rc-current-project');
      document.cookie = 'rc-mode=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'rc-demo-session=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'rc-demo-slug=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'rc-remember=; path=/; max-age=0; SameSite=Lax';
    } catch { /* Browser privacy mode may deny client storage access. */ }
    setSignOutOpen(false);
    router.replace('/login');
    router.refresh();
  }, [router]);

  const requestSignOut = useCallback(async () => {
    if (signOutBusy) return;
    setSignOutError(null);
    const activeUserId = userIdRef.current;
    if (!activeUserId) {
      setSignOutBusy(true);
      try {
        await completeSignOut();
      } catch (error) {
        setSignOutError(error instanceof Error ? error.message : 'Could not sign out safely');
      } finally {
        setSignOutBusy(false);
      }
      return;
    }

    try {
      const [queued, drafts] = await Promise.all([
        listOutboxOperations(activeUserId),
        listDailyLogDrafts(activeUserId),
      ]);
      if (queued.length === 0 && drafts.length === 0) {
        setSignOutBusy(true);
        await completeSignOut();
        return;
      }
      setSignOutOperations(queued);
      setSignOutDrafts(drafts);
      setSignOutOpen(true);
    } catch {
      // Fail closed: if local work cannot be inspected, never assume it is safe
      // to delete the user-scoped database.
      setSignOutOperations([]);
      setSignOutDrafts([]);
      setSignOutError(
        'RailCommand could not verify whether unsynchronized work is stored on this device. Keep working and try again before signing out.'
      );
      setSignOutOpen(true);
    } finally {
      setSignOutBusy(false);
    }
  }, [completeSignOut, signOutBusy]);

  const synchronizeAndSignOut = useCallback(async () => {
    const activeUserId = userIdRef.current;
    if (!activeUserId || connectivityRef.current !== 'online') return;
    setSignOutBusy(true);
    setSignOutError(null);
    try {
      const queued = await listOutboxOperations(activeUserId);
      await Promise.all(
        queued
          .filter((operation) => operation.status === 'failed')
          .map((operation) => updateOutboxOperation(
            activeUserId,
            resetOutboxOperationForRetry(operation)
          ))
      );
      await syncNow();
      const [remaining, drafts] = await Promise.all([
        listOutboxOperations(activeUserId),
        listDailyLogDrafts(activeUserId),
      ]);
      setSignOutOperations(remaining);
      setSignOutDrafts(drafts);
      if (remaining.length > 0 || drafts.length > 0) {
        setSignOutError(
          remaining.some((operation) => operation.status === 'failed')
            ? 'Some work could not synchronize. Review the failed items in Sync Center or keep working; RailCommand has not signed you out or deleted the local copy.'
            : 'Synchronization is still pending. RailCommand has not signed you out or deleted the local copy.'
        );
        return;
      }
      await completeSignOut();
    } catch (error) {
      setSignOutError(
        error instanceof Error
          ? error.message
          : 'Synchronization did not finish. Your offline work remains saved on this device.'
      );
    } finally {
      setSignOutBusy(false);
    }
  }, [completeSignOut, syncNow]);

  const discardAndSignOut = useCallback(async () => {
    setSignOutBusy(true);
    setSignOutError(null);
    try {
      await completeSignOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Could not sign out safely');
    } finally {
      setSignOutBusy(false);
    }
  }, [completeSignOut]);

  const reviewSavedDraft = useCallback(() => {
    const draft = signOutDrafts[0];
    if (!draft) return;
    setSignOutOpen(false);
    router.push(`/projects/${draft.projectId}/daily-logs/new`);
  }, [router, signOutDrafts]);

  const failedCount = operations.filter((operation) => operation.status === 'failed').length;
  const pendingCount = operations.length;

  return (
    <OfflineSyncContext.Provider value={{
      operations,
      history,
      pendingCount,
      failedCount,
      isSyncing,
      storageEstimate,
      syncNow,
      retryFailed,
      requestSignOut,
    }}>
      {children}
      {userId && (
        <SyncCenter
          operations={operations}
          history={history}
          isSyncing={isSyncing}
          storageEstimate={storageEstimate}
          onRetry={() => void retryFailed()}
        />
      )}
      <PendingWorkSignOutDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        operationCount={signOutOperations.length}
        draftCount={signOutDrafts.length}
        failedCount={signOutOperations.filter((operation) => operation.status === 'failed').length}
        isOnline={connectivityStatus === 'online'}
        isBusy={signOutBusy}
        error={signOutError}
        onSyncAndSignOut={() => void synchronizeAndSignOut()}
        onReviewDraft={reviewSavedDraft}
        onDiscardAndSignOut={() => void discardAndSignOut()}
      />
    </OfflineSyncContext.Provider>
  );
}
