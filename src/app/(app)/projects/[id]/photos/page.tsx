'use client';

import { useState, useMemo, useRef, useCallback, use } from 'react';
import { format, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns';
import {
  Camera,
  Thermometer,
  MapPin,
  ImageOff,
  ExternalLink,
  X,
  Loader2,
  FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { useProjectPhotos } from '@/hooks/useData';
import * as store from '@/lib/store';
import { compressImage } from '@/lib/compressImage';
import type { Attachment, PhotoCategory } from '@/lib/types';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type PhotoFilter = 'all' | 'standard' | 'thermal';

const FILTER_TABS: { label: string; value: PhotoFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Standard', value: 'standard' },
  { label: 'Thermal', value: 'thermal' },
];

const ENTITY_LABELS: Record<string, string> = {
  submittal: 'Submittal',
  rfi: 'RFI',
  daily_log: 'Daily Log',
  punch_list: 'Punch List',
  safety_incident: 'Safety',
  project_photo: 'Project Photo',
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDateKey(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'This Week';
  return format(date, 'MMMM d, yyyy');
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: projectId } = use(params);
  use(searchParams);
  const { isDemo } = useProject();

  const { data: photos, loading, refetch } = useProjectPhotos(projectId);

  const [filter, setFilter] = useState<PhotoFilter>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<Attachment | null>(null);
  const [captureLoading, setCaptureLoading] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);

  /* ---- Filter ---- */
  const filtered = useMemo(() => {
    if (filter === 'all') return photos;
    return photos.filter((p) => p.photo_category === filter);
  }, [photos, filter]);

  /* ---- Group by date ---- */
  const grouped = useMemo(() => {
    const groups: { key: string; photos: Attachment[] }[] = [];
    const map = new Map<string, Attachment[]>();

    for (const photo of filtered) {
      const dateStr = photo.captured_at ?? photo.created_at;
      const key = getDateKey(dateStr);
      if (!map.has(key)) {
        map.set(key, []);
        groups.push({ key, photos: map.get(key)! });
      }
      map.get(key)!.push(photo);
    }

    return groups;
  }, [filtered]);

  /* ---- Camera capture handler ---- */
  const handleCapture = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setCaptureLoading(true);

      try {
        const file = fileList[0];
        const compressed = await compressImage(file, 'standard');

        // Try to capture GPS
        let geoLat: number | null = null;
        let geoLng: number | null = null;
        if (navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 60000,
              });
            });
            geoLat = pos.coords.latitude;
            geoLng = pos.coords.longitude;
          } catch {
            // GPS not available, that's fine
          }
        }

        if (isDemo) {
          const previewUrl = URL.createObjectURL(compressed);
          store.addProjectPhoto(projectId, {
            file_name: file.name,
            file_url: previewUrl,
            file_type: compressed.type,
            file_size: compressed.size,
            photo_category: 'standard' as PhotoCategory,
            geo_lat: geoLat,
            geo_lng: geoLng,
          });
          refetch();
        } else {
          // Server mode: use the upload attachment action
          const { uploadAttachment } = await import('@/lib/actions/attachments');
          const formData = new FormData();
          formData.append('file', compressed);
          formData.append('entity_type', 'project_photo');
          formData.append('entity_id', projectId);
          formData.append('project_id', projectId);
          formData.append('photo_category', 'standard');
          if (geoLat !== null) formData.append('geo_lat', String(geoLat));
          if (geoLng !== null) formData.append('geo_lng', String(geoLng));

          const result = await uploadAttachment(formData);
          if (result.error) {
            alert(`Upload failed: ${result.error}`);
          }
          refetch();
        }
      } catch {
        alert('Failed to capture photo');
      } finally {
        setCaptureLoading(false);
      }
    },
    [isDemo, projectId, refetch]
  );

  /* ---- Loading state ---- */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Photos & Media' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">Photos & Media</h1>
            <Badge variant="secondary" className="text-xs">
              {photos.length}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {photos.filter((p) => p.photo_category === 'standard').length} standard,{' '}
            {photos.filter((p) => p.photo_category === 'thermal').length} thermal
          </p>
        </div>
        <Button
          onClick={() => cameraInputRef.current?.click()}
          disabled={captureLoading}
          className="bg-rc-orange hover:bg-rc-orange-dark text-white"
        >
          {captureLoading ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Camera className="mr-2 size-4" />
          )}
          Take Photo
        </Button>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            handleCapture(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-rc-border pb-px">
        {FILTER_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value)}
            className={`whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px] ${
              filter === t.value
                ? 'border-rc-orange text-rc-orange'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.value === 'all' && (
              <span className="ml-1.5 text-xs text-muted-foreground">({photos.length})</span>
            )}
            {t.value === 'thermal' && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({photos.filter((p) => p.photo_category === 'thermal').length})
              </span>
            )}
            {t.value === 'standard' && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({photos.filter((p) => p.photo_category === 'standard').length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Photo grid grouped by date */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-rc-border py-16 text-muted-foreground">
          <ImageOff className="size-10 mb-3" />
          <p className="text-sm font-medium">No photos yet</p>
          <p className="text-xs mt-1">
            Take a photo or upload images from other modules
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.key}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group.key}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelectedPhoto(photo)}
                    className="group relative rounded-lg overflow-hidden border border-rc-border bg-muted text-left transition-shadow hover:shadow-md"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.signed_url ?? photo.file_url}
                      alt={photo.file_name}
                      className="aspect-square w-full object-cover"
                    />
                    {/* Overlay badges */}
                    <div className="absolute top-1.5 left-1.5 flex flex-wrap gap-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 bg-black/60 text-white"
                      >
                        <FileText className="mr-0.5 size-2.5" />
                        {ENTITY_LABELS[photo.entity_type] ?? photo.entity_type}
                      </Badge>
                    </div>
                    <div className="absolute bottom-1 left-1 flex flex-wrap gap-1">
                      {photo.photo_category === 'thermal' && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 bg-rc-orange/90 text-white"
                        >
                          <Thermometer className="mr-0.5 size-2.5" />
                          Thermal
                        </Badge>
                      )}
                      {photo.geo_lat !== null && photo.geo_lng !== null && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 bg-rc-emerald/90 text-white"
                        >
                          <MapPin className="mr-0.5 size-2.5" />
                          GPS
                        </Badge>
                      )}
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="truncate text-[11px] font-medium">
                        {photo.file_name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(
                          parseISO(photo.captured_at ?? photo.created_at),
                          'h:mm a'
                        )}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / detail dialog */}
      <Dialog
        open={!!selectedPhoto}
        onOpenChange={() => setSelectedPhoto(null)}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selectedPhoto && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.signed_url ?? selectedPhoto.file_url}
                alt={selectedPhoto.file_name}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{selectedPhoto.file_name}</p>
                  <button
                    type="button"
                    onClick={() => setSelectedPhoto(null)}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p className="font-medium">
                      {ENTITY_LABELS[selectedPhoto.entity_type] ??
                        selectedPhoto.entity_type}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">File Size</span>
                    <p className="font-medium">
                      {formatFileSize(selectedPhoto.file_size)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Captured</span>
                    <p className="font-medium">
                      {selectedPhoto.captured_at
                        ? format(
                            parseISO(selectedPhoto.captured_at),
                            'MMM d, yyyy h:mm a'
                          )
                        : '--'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uploaded</span>
                    <p className="font-medium">
                      {format(
                        parseISO(selectedPhoto.created_at),
                        'MMM d, yyyy h:mm a'
                      )}
                    </p>
                  </div>
                </div>

                {/* Badges row */}
                <div className="flex flex-wrap gap-2">
                  {selectedPhoto.photo_category === 'thermal' && (
                    <span className="flex items-center gap-1 text-xs text-rc-orange">
                      <Thermometer className="size-3" />
                      Thermal Image
                    </span>
                  )}
                  {selectedPhoto.geo_lat !== null &&
                    selectedPhoto.geo_lng !== null && (
                      <a
                        href={`https://www.google.com/maps?q=${selectedPhoto.geo_lat},${selectedPhoto.geo_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'flex items-center gap-1 text-xs text-rc-emerald hover:underline'
                        )}
                      >
                        <MapPin className="size-3" />
                        {selectedPhoto.geo_lat.toFixed(6)},{' '}
                        {selectedPhoto.geo_lng.toFixed(6)}
                        <ExternalLink className="size-2.5" />
                      </a>
                    )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
