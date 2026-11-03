'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ImagePlus, Loader2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePhotoLibrary } from '@/hooks/usePhotoLibrary';
import { getAvailablePhotosForDailyLog, getPhotoLocalDate } from '@/lib/daily-log-photo-selection';
import type { PhotoFile } from '@/components/shared/PhotoUpload';
import { formatDfrDate, dfrPhotoLabel } from '@/lib/dfr-presentation';
import type { Attachment } from '@/lib/types';

interface PhotoLibraryPickerProps {
  projectId: string;
  logDate: string;
  photos: PhotoFile[];
  onPhotosChange: (photos: PhotoFile[]) => void;
  isOffline: boolean;
  maxFiles?: number;
}

function photoUrl(photo: Attachment): string {
  return photo.signed_url ?? photo.file_url;
}

export default function PhotoLibraryPicker({
  projectId,
  logDate,
  photos,
  onPhotosChange,
  isOffline,
  maxFiles = 20,
}: PhotoLibraryPickerProps) {
  const { scope, data: libraryPhotos, loading, error, hasMore, loadMore } = usePhotoLibrary(projectId, isOffline);
  const currentPhotos = useRef(photos);
  useEffect(() => { currentPhotos.current = photos; }, [photos]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const requestScope = useRef(0);
  useEffect(() => { requestScope.current += 1; return () => { requestScope.current += 1; }; }, [scope, logDate]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const alreadyAddedIds = useMemo(
    () => new Set(photos.flatMap((photo) => photo.sourceAttachmentId ? [photo.sourceAttachmentId] : [])),
    [photos]
  );
  const availablePhotos = useMemo(
    () => getAvailablePhotosForDailyLog(libraryPhotos, logDate, alreadyAddedIds),
    [alreadyAddedIds, libraryPhotos, logDate]
  );
  const remainingSlots = Math.max(0, maxFiles - photos.length);
  const activeSelected = useMemo(
    () => availablePhotos.filter((photo) => selectedIds.has(photo.id)).slice(0, remainingSlots),
    [availablePhotos, remainingSlots, selectedIds]
  );

  useEffect(() => {
    setSelectedIds(new Set());
  }, [logDate, scope]);

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < remainingSlots) next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    const selected = activeSelected;
    const startedScope = requestScope.current;
    const previews: string[] = [];
    let failed = false;
    if (selected.length === 0) return;
    setAdding(true);
    setAddError(null);

    try {
      const downloaded = await Promise.all(selected.map(async (photo): Promise<PhotoFile> => {
        const response = await fetch(photoUrl(photo));
        if (!response.ok) throw new Error(`Could not download ${photo.file_name}`);
        const blob = await response.blob();
        const file = new File([blob], photo.file_name, {
          type: photo.file_type || blob.type || 'image/jpeg',
        });
        const preview = URL.createObjectURL(blob);
        previews.push(preview);
        if (failed) URL.revokeObjectURL(preview);
        return {
          id: crypto.randomUUID(),
          file,
          preview,
          category: photo.photo_category,
          geo_lat: photo.geo_lat,
          geo_lng: photo.geo_lng,
          originalSize: photo.file_size,
          capturedAt: photo.captured_at ?? photo.created_at,
          sourceAttachmentId: photo.id,
          caption: photo.caption ?? undefined,
        };
      }));
      if (requestScope.current !== startedScope) {
        previews.forEach(url => URL.revokeObjectURL(url));
        return;
      }
      if (currentPhotos.current.length + downloaded.length > maxFiles) {
        throw new Error('There is no longer enough room for these photos. Remove a photo or select fewer and retry.');
      }
      onPhotosChange([...currentPhotos.current, ...downloaded]);
      setSelectedIds(new Set());
    } catch (caught) {
      failed = true;
      previews.forEach(url => URL.revokeObjectURL(url));
      if (requestScope.current !== startedScope) return;
      setAddError(caught instanceof Error ? caught.message : 'Could not add the selected photos');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ImagePlus className="size-5" />
          Use photos already in RailCommand
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isOffline ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <WifiOff className="mt-0.5 size-4 shrink-0" />
            <p>Photo-library selection needs a connection. Photos already added remain selected while this form stays open; reconnect before submitting.</p>
          </div>
        ) : loading && libraryPhotos.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading recent photos…
          </div>
        ) : availablePhotos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No unused photos in the loaded pages.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Select any photo previously taken or uploaded in RailCommand. Among loaded photos, those from the report date are shown first. Load more to browse older photos. Originals stay in Photos &amp; Media.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={addSelected}
              disabled={adding || isOffline || activeSelected.length === 0 || remainingSlots === 0}
            >
              {adding && <Loader2 className="mr-2 size-4 animate-spin" />}
              Add {activeSelected.length || ''} selected photo{activeSelected.length === 1 ? '' : 's'}
            </Button>
            <div className="grid max-h-[60vh] overflow-y-auto grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {availablePhotos.map((photo) => {
                const selected = selectedIds.has(photo.id);
                const photoDate = getPhotoLocalDate(photo);
                return (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => toggle(photo.id)}
                    disabled={adding || (!selected && activeSelected.length >= remainingSlots)}
                    aria-pressed={selected}
                    className={`overflow-hidden rounded-lg border-2 text-left transition-colors ${selected ? 'border-rc-blue ring-2 ring-rc-blue/25' : 'border-rc-border'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnail_url ?? photoUrl(photo)}
                      alt={dfrPhotoLabel(logDate, photo.caption)}
                      loading="lazy"
                      className="aspect-square w-full bg-muted object-cover"
                    />
                    <span className="block truncate px-2 pt-1 text-xs">{dfrPhotoLabel(logDate, photo.caption)}</span>
                    <span className="block px-2 pb-1 text-[10px] text-muted-foreground">
                      {photoDate === logDate ? 'Report date' : `Taken ${formatDfrDate(photoDate)}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {!isOffline && error && <p role="alert" className="text-sm text-red-600">Could not load more photos: {error}</p>}
        {!isOffline && (hasMore || error) && (
          <Button type="button" variant="outline" onClick={loadMore} disabled={loading || adding}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {error ? 'Retry loading photos' : loading ? 'Loading photos…' : 'Load more photos'}
          </Button>
        )}
        {remainingSlots === 0 && <p className="text-xs text-amber-700">This daily log already has the maximum of {maxFiles} photos.</p>}
        {addError && <p className="text-sm text-red-600">{addError}</p>}
      </CardContent>
    </Card>
  );
}
