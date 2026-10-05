'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import PhotoGallery from '@/components/shared/PhotoGallery';
import { Button } from '@/components/ui/button';
import { getAttachmentsWithSignedUrls, removeDailyLogPhoto } from '@/lib/actions/attachments';
import { getAttachments as getDemoAttachments } from '@/lib/store';
import { usePWA } from '@/components/providers/ServiceWorkerProvider';
import type { Attachment } from '@/lib/types';

export default function SavedDailyLogPhotos({ projectId, logId, isDemo, canRemove = false, onPhotosChanged }: {
  projectId: string; logId: string; isDemo: boolean; canRemove?: boolean; onPhotosChanged?: () => void;
}) {
  const { isOffline } = usePWA();
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const result = isDemo ? { data: getDemoAttachments('daily_log', logId) } : await getAttachmentsWithSignedUrls('daily_log', logId);
      if (request !== generation.current) return;
      if ('error' in result && result.error) setError(result.error);
      else if (result.data) setPhotos(result.data);
    } catch { if (request === generation.current) setError('Could not load saved photos. Reconnect and refresh photos before adding them again.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [isDemo, logId]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);
  const remove = async (photo: Attachment) => {
    if (isOffline || removing || isDemo) return;
    if (!window.confirm(`Remove "${photo.file_name}" from this DFR? The stored file and other reports will not be deleted. Downloaded PDFs will not change; export this DFR again afterwards.`)) return;
    setRemoving(photo.id); setError(null);
    try {
      const result = await removeDailyLogPhoto(photo.id, projectId, logId);
      if (result.error) setError(result.error);
      else { setPhotos(current => current.filter(item => item.id !== photo.id)); onPhotosChanged?.(); await refresh(); }
    } catch { setError('Removal could not be confirmed. Refresh photos to check before retrying.'); }
    finally { setRemoving(null); }
  };
  return <section className="space-y-3" aria-label="Saved DFR photos">
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" disabled={isOffline || loading || !!removing} onClick={() => void refresh()}>{loading ? 'Loading saved photos…' : 'Refresh photos'}</Button>
      <p className="text-sm text-muted-foreground">Saved photos stay attached when you edit the report.</p>
    </div>
    {isOffline && <p role="status" className="text-sm text-amber-700">Reconnect to refresh or remove saved photos. Your open form is preserved.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {(!loading || photos.length > 0) && <PhotoGallery attachments={photos} title="Saved DFR photos" onRemove={canRemove && !isDemo ? remove : undefined} removalDisabled={isOffline || !!removing} />}
  </section>;
}
