'use client';

import { useCallback, useEffect, useState } from 'react';
import { useProject } from '@/components/providers/ProjectProvider';
import { pageDemoPhotos, type PhotoCursor, type ProjectPhotoFilter, type ProjectPhotoPage } from '@/lib/project-photo-page';
import { readProjectPhotoPage } from '@/lib/project-photo-page-client';

const emptyPage: ProjectPhotoPage = { data: [], nextCursor: null };

export function useProjectPhotoPage(projectId: string, category: ProjectPhotoFilter) {
  const { isDemo, currentUserId } = useProject();
  const scope = JSON.stringify([isDemo, currentUserId, projectId, category]);
  const [navigation, setNavigation] = useState<{ scope: string; cursors: (PhotoCursor | null)[]; revision: number }>({ scope: '', cursors: [null], revision: 0 });
  const cursors = navigation.scope === scope ? navigation.cursors : [null];
  const cursor = cursors.at(-1) ?? null;
  const requestKey = JSON.stringify([scope, cursor, navigation.revision]);
  const [result, setResult] = useState<{ key: string; page: ProjectPhotoPage; loading: boolean; error: string | null }>({ key: '', page: emptyPage, loading: true, error: null });
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!online || (!isDemo && !currentUserId)) return;
    const timeout = setTimeout(() => controller.abort(), 15000);
    let cancelled = false;
    const load = async () => {
      try {
        const page = isDemo
          ? pageDemoPhotos((await import('@/lib/store')).getAllProjectPhotos(projectId), { category, cursor })
          : await readProjectPhotoPage(projectId, { category, cursor }, controller.signal);
        if (!cancelled) setResult({ key: requestKey, page, loading: false, error: null });
      } catch (error) {
        if (!cancelled) setResult({ key: requestKey, page: emptyPage, loading: false,
          error: error instanceof Error ? error.message : 'Could not load photos. Please retry.' });
      } finally { clearTimeout(timeout); }
    };
    void load();
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
    // requestKey encodes the full account/project/filter/cursor/revision request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, online]);

  const page = result.key === requestKey ? result.page : emptyPage;
  const refetch = useCallback(() => {
    setNavigation((previous) => ({ scope, cursors: [null], revision: previous.revision + 1 }));
  }, [scope, setNavigation]);

  return {
    data: page.data, loading: online && (result.key !== requestKey || result.loading),
    error: result.key === requestKey ? result.error : null, online, refetch,
    pageNumber: cursors.length, hasPrevious: cursors.length > 1, hasNext: page.nextCursor !== null,
    next: () => { if (online && page.nextCursor) setNavigation({ scope, cursors: [...cursors, page.nextCursor], revision: navigation.revision }); },
    previous: () => { if (online && cursors.length > 1) setNavigation({ scope, cursors: cursors.slice(0, -1), revision: navigation.revision }); },
  };
}
