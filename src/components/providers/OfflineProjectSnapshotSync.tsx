'use client';

import { useEffect, useRef } from 'react';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePWA } from '@/components/providers/ServiceWorkerProvider';
import { getOfflineProjectSnapshot } from '@/lib/actions/offline';
import {
  cacheOfflineProjectSnapshot,
  readCachedProjectSnapshot,
  snapshotNeedsRefresh,
} from '@/lib/offline/project-cache';
import { writeOfflineMetadata } from '@/lib/offline/storage';

/**
 * Keeps the active project's Day 2 read-only snapshot warm. This component is
 * mounted inside ProjectProvider and renders no UI; the normal connectivity and
 * last-synchronized indicators remain the user-facing status surface.
 */
export default function OfflineProjectSnapshotSync() {
  const {
    currentProjectId,
    currentUserId,
    isDemo,
    projects,
    setCurrentProjectId,
  } = useProject();
  const { connectivityStatus, markSynced } = usePWA();
  const inFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isDemo && currentUserId && !currentProjectId && projects.length > 0) {
      setCurrentProjectId(projects[0].id);
    }
  }, [currentProjectId, currentUserId, isDemo, projects, setCurrentProjectId]);

  useEffect(() => {
    if (isDemo || !currentUserId || !currentProjectId) return;

    let cancelled = false;
    const syncKey = `${currentUserId}:${currentProjectId}`;

    // The scope pointer is user-scoped metadata; project records remain in the
    // records store and are never written to global localStorage or Cache Storage.
    void writeOfflineMetadata(currentUserId, 'active_project_id', currentProjectId);

    if (connectivityStatus !== 'online') return;

    void readCachedProjectSnapshot(currentUserId, currentProjectId)
      .then(async (cachedSnapshot) => {
        if (cancelled || !snapshotNeedsRefresh(cachedSnapshot)) return;
        if (inFlightRef.current === syncKey) return;
        inFlightRef.current = syncKey;

        try {
          const result = await getOfflineProjectSnapshot(currentProjectId);
          if (cancelled || !result.data) return;
          await cacheOfflineProjectSnapshot(currentUserId, result.data);
          if (!cancelled) await markSynced(currentUserId);
        } finally {
          if (inFlightRef.current === syncKey) inFlightRef.current = null;
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [connectivityStatus, currentProjectId, currentUserId, isDemo, markSynced]);

  return null;
}
