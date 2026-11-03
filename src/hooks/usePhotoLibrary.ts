'use client';

import { useEffect, useRef, useState } from 'react';
import { useProject } from '@/components/providers/ProjectProvider';
import { pageDemoPhotos, type PhotoCursor } from '@/lib/project-photo-page';
import { PhotoPageRequestError, readProjectPhotoPage } from '@/lib/project-photo-page-client';
import type { Attachment } from '@/lib/types';

/** Accumulate only explicitly requested pages. No records or signed URLs persist here. */
export function usePhotoLibrary(projectId: string, offline: boolean) {
  const { isDemo, currentUserId } = useProject();
  const scope = JSON.stringify([isDemo, currentUserId, projectId]);
  const [result, setResult] = useState<{ revision: number; scope: string; data: Attachment[]; cursor: PhotoCursor | null; ready: boolean; loading: boolean; error: string | null }>({
    revision: -1, scope: '', data: [], cursor: null, ready: false, loading: false, error: null,
  });
  const [revision, setRevision] = useState(0);
  const current = result.scope === scope ? result : null;
  const latest = useRef(current);
  useEffect(() => { latest.current = current; }, [current]);

  useEffect(() => {
    if (offline || (!isDemo && !currentUserId)) return;
    const controller = new AbortController();
    let cancelled = false;
    const previous = latest.current;
    // Reconnection retains loaded pages and checked selections; retry only an unfinished page.
    if (previous?.ready && !previous.loading && !previous.error && previous.revision === revision) return;
    const cursor = previous?.cursor ?? null;
    setResult({ revision, scope, data: previous?.data ?? [], cursor, ready: previous?.ready ?? false, loading: true, error: null });
    const timeout = setTimeout(() => controller.abort(), 15000);
    void (async () => {
      try {
        const options = { category: 'all' as const, cursor };
        const page = isDemo
          ? pageDemoPhotos((await import('@/lib/store')).getAllProjectPhotos(projectId), options)
          : await readProjectPhotoPage(projectId, options, controller.signal);
        if (cancelled) return;
        const data = new Map((previous?.data ?? []).map(photo => [photo.id, photo]));
        page.data.forEach(photo => data.set(photo.id, photo));
        setResult({ revision, scope, data: [...data.values()], cursor: page.nextCursor, ready: true, loading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        const denied = error instanceof PhotoPageRequestError && [401, 403].includes(error.status);
        setResult({ revision, scope, data: denied ? [] : previous?.data ?? [], cursor: denied ? null : cursor, ready: denied ? false : previous?.ready ?? false, loading: false,
          error: error instanceof Error ? error.message : 'Could not load photos. Please retry.' });
      } finally { clearTimeout(timeout); }
    })();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
    // A revision requests the next page (or retries the same cursor). Scope changes discard old reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, offline, revision]);

  return {
    scope, data: current?.data ?? [], loading: !offline && (!current || current.loading), error: current?.error,
    hasMore: !!current?.cursor,
    loadMore: () => { if (!offline && !current?.loading) setRevision(value => value + 1); },
  };
}
