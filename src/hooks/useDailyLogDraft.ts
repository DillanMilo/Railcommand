'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  dailyLogDraftHasEnteredData,
  deleteDailyLogDraft,
  readDailyLogDraft,
  writeDailyLogDraft,
  type DailyLogDraftRecord,
  type DailyLogDraftValues,
} from '@/lib/offline/daily-log-draft';
import { getActiveOfflineUserId } from '@/lib/offline/storage';

export type DailyLogDraftSaveStatus = 'loading' | 'idle' | 'saving' | 'saved' | 'error';

interface UseDailyLogDraftOptions {
  userId: string;
  projectId: string;
  values: DailyLogDraftValues;
  enabled: boolean;
  onRestore: (values: DailyLogDraftValues) => void;
}

export function useDailyLogDraft({
  userId,
  projectId,
  values,
  enabled,
  onRestore,
}: UseDailyLogDraftOptions) {
  const offlineUserId = userId || getActiveOfflineUserId() || '';
  const [status, setStatus] = useState<DailyLogDraftSaveStatus>('loading');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);
  const hydratedRef = useRef(false);
  const draftRef = useRef<DailyLogDraftRecord | null>(null);
  const valuesRef = useRef(values);
  const onRestoreRef = useRef(onRestore);
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    hydratedRef.current = false;
    draftRef.current = null;
    setRecovered(false);
    setSavedAt(null);

    if (!enabled || !offlineUserId || !projectId) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    void readDailyLogDraft(offlineUserId, projectId)
      .then((draft) => {
        if (cancelled) return;
        draftRef.current = draft;
        if (draft) {
          onRestoreRef.current(draft.values);
          setRecovered(true);
          setSavedAt(draft.updatedAt);
          setStatus('saved');
        } else {
          setStatus('idle');
        }
        hydratedRef.current = true;
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
        hydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, offlineUserId, projectId]);

  const persistLatest = useCallback(async () => {
    if (!enabled || !offlineUserId || !projectId || !hydratedRef.current) return;
    if (!draftRef.current && !dailyLogDraftHasEnteredData(valuesRef.current)) return;
    setStatus('saving');
    const save = async () => {
      try {
        const saved = await writeDailyLogDraft(
          offlineUserId,
          projectId,
          valuesRef.current,
          draftRef.current
        );
        draftRef.current = saved;
        setSavedAt(saved.updatedAt);
        setStatus('saved');
      } catch {
        setStatus('error');
      }
    };
    const pendingSave = writeChainRef.current.then(save, save);
    writeChainRef.current = pendingSave;
    await pendingSave;
  }, [enabled, offlineUserId, projectId]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const timeout = window.setTimeout(() => void persistLatest(), 200);
    return () => window.clearTimeout(timeout);
  }, [persistLatest, values]);

  useEffect(() => {
    const handlePageHide = () => void persistLatest();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') void persistLatest();
    };
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [persistLatest]);

  const clearDraft = useCallback(async () => {
    if (!offlineUserId || !projectId) return;
    await deleteDailyLogDraft(offlineUserId, projectId);
    draftRef.current = null;
    setSavedAt(null);
    setRecovered(false);
    setStatus('idle');
  }, [offlineUserId, projectId]);

  return { status, savedAt, recovered, clearDraft, persistNow: persistLatest };
}
