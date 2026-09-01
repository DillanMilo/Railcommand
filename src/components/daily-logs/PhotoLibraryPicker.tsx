'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImagePlus, Loader2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProjectPhotos } from '@/hooks/useData';
import { getAvailablePhotosForDailyLog, getPhotoLocalDate } from '@/lib/daily-log-photo-selection';
import type { PhotoFile } from '@/components/shared/PhotoUpload';
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
  const { data: libraryPhotos, loading, error } = useProjectPhotos(isOffline ? null : projectId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
  }, [logDate]);

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
    if (isOffline || selected.length === 0) return;
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
        return {
          id: crypto.randomUUID(),
          file,
          preview: URL.createObjectURL(blob),
          category: photo.photo_category,
          geo_lat: photo.geo_lat,
          geo_lng: photo.geo_lng,
          originalSize: photo.file_size,
          capturedAt: photo.captured_at ?? photo.created_at,
          sourceAttachmentId: photo.id,
        };
      }));
      onPhotosChange([...photos, ...downloaded]);
      setSelectedIds(new Set());
    } catch (caught) {
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
            <p>Photo-library selection needs a connection. Photos already added can be saved with this log in the offline queue before closing the form.</p>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading photos for this date…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">Could not load the photo library: {error}</p>
        ) : availablePhotos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No unused project photos are available yet.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Select any photo previously taken or uploaded in RailCommand. Photos from the report date are shown first, and the originals stay in Photos &amp; Media.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {availablePhotos.map((photo) => {
                const selected = selectedIds.has(photo.id);
                const photoDate = getPhotoLocalDate(photo);
                return (
                  <button
                    type="button"
                    key={photo.id}
                    onClick={() => toggle(photo.id)}
                    aria-pressed={selected}
                    className={`overflow-hidden rounded-lg border-2 text-left transition-colors ${selected ? 'border-rc-blue ring-2 ring-rc-blue/25' : 'border-rc-border'}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.thumbnail_url ?? photoUrl(photo)}
                      alt={photo.file_name}
                      className="aspect-square w-full bg-muted object-cover"
                    />
                    <span className="block truncate px-2 pt-1 text-xs">{photo.file_name}</span>
                    <span className="block px-2 pb-1 text-[10px] text-muted-foreground">
                      {photoDate === logDate ? 'Report date' : photoDate}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={addSelected}
              disabled={adding || activeSelected.length === 0 || remainingSlots === 0}
            >
              {adding && <Loader2 className="mr-2 size-4 animate-spin" />}
              Add {activeSelected.length || ''} selected photo{activeSelected.length === 1 ? '' : 's'}
            </Button>
          </>
        )}
        {remainingSlots === 0 && <p className="text-xs text-amber-700">This daily log already has the maximum of {maxFiles} photos.</p>}
        {addError && <p className="text-sm text-red-600">{addError}</p>}
      </CardContent>
    </Card>
  );
}
