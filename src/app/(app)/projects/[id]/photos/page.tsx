'use client';

import { useState, useMemo, useCallback, use } from 'react';
import { format, parseISO, isToday, isYesterday, isThisWeek } from 'date-fns';
import {
  Thermometer,
  MapPin,
  ImageOff,
  ExternalLink,
  X,
  Loader2,
  FileText,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import QueryError from '@/components/shared/QueryError';
import { useProject } from '@/components/providers/ProjectProvider';
import { useProjectPhotoPage } from '@/hooks/useProjectPhotoPage';
import { usePermissions } from '@/hooks/usePermissions';
import * as store from '@/lib/store';
import ProjectPhotoUpload from '@/components/shared/ProjectPhotoUpload';
import type { ProjectPhotoFilter } from '@/lib/project-photo-page';
import { ACTIONS } from '@/lib/permissions';
import type { Attachment } from '@/lib/types';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FILTER_TABS: { label: string; value: ProjectPhotoFilter }[] = [
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

function getPhotoUrl(photo: Attachment, variant: 'thumbnail' | 'full'): string {
  if (variant === 'thumbnail' && photo.thumbnail_url) {
    return photo.thumbnail_url;
  }

  // No width parameter on an object URL: it does not resize the image and
  // makes the lightbox request a second URL for identical bytes.
  return photo.signed_url ?? photo.file_url;
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
  const { currentUserId, isDemo } = useProject();
  if (!currentUserId) return <p role="status">Opening project photos…</p>;
  return <ProjectPhotosGallery key={`${isDemo}:${currentUserId}:${projectId}`} projectId={projectId} />;
}

function ProjectPhotosGallery({ projectId }: { projectId: string }) {
  const { currentUserId, isDemo } = useProject();
  const { can } = usePermissions(projectId);

  const [filter, setFilter] = useState<ProjectPhotoFilter>('all');
  const { data: photos, loading, error, refetch, online, pageNumber, hasPrevious, hasNext, previous, next } = useProjectPhotoPage(projectId, filter);

  const [selectedPhoto, setSelectedPhoto] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDeletePhoto = useCallback(
    (photo: Attachment) =>
      isDemo || photo.uploaded_by === currentUserId || can(ACTIONS.PHOTO_DELETE),
    [can, currentUserId, isDemo]
  );

  /* ---- Group by date ---- */
  const grouped = useMemo(() => {
    const groups: { key: string; photos: Attachment[] }[] = [];
    const map = new Map<string, Attachment[]>();

    for (const photo of photos) {
      const dateStr = photo.captured_at ?? photo.created_at;
      const key = getDateKey(dateStr);
      if (!map.has(key)) {
        map.set(key, []);
        groups.push({ key, photos: map.get(key)! });
      }
      map.get(key)!.push(photo);
    }

    return groups;
  }, [photos]);

  /* ---- Delete handler ---- */
  const handleDelete = useCallback(
    async (photo: Attachment) => {
      if (!confirm('Delete this photo? This cannot be undone.')) return;
      setDeleting(true);
      try {
        if (isDemo) {
          store.removeAttachment(photo.id);
        } else {
          const { deleteAttachment } = await import('@/lib/actions/attachments');
          const result = await deleteAttachment(photo.id, projectId);
          if (result.error) {
            alert(`Delete failed: ${result.error}`);
            return;
          }
        }
        setSelectedPhoto(null);
        refetch();
      } catch {
        alert('Failed to delete photo');
      } finally {
        setDeleting(false);
      }
    },
    [isDemo, projectId, refetch]
  );

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
              {photos.length} on this page
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Browse project photos online. Refresh to see new uploads.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <Button variant="outline" disabled={!online || loading} onClick={refetch}>Refresh photos</Button>
          <ProjectPhotoUpload key={`${currentUserId}:${projectId}`} projectId={projectId} onUpload={refetch} />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-rc-border pb-px">
        {FILTER_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setFilter(t.value); setSelectedPhoto(null); }}
            disabled={!online}
            aria-pressed={filter === t.value}
            className={`whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px] ${
              filter === t.value
                ? 'border-rc-orange text-rc-orange'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Photo grid grouped by date */}
      {!online && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Photo browsing needs a connection. Your open page and pending upload stay here. Reconnect to continue; use Field tools for offline daily logs.</p>}
      {error ? (
        <QueryError message={error} onRetry={online ? refetch : undefined} />
      ) : loading ? (
        <div role="status" className="flex items-center justify-center gap-2 h-64"><Loader2 className="size-5 animate-spin" /> Loading photos…</div>
      ) : photos.length === 0 && online ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-rc-border py-16 text-muted-foreground">
          <ImageOff className="size-10 mb-3" />
          <p className="text-sm font-medium">{hasPrevious ? 'No more photos on this page' : 'No photos in this filter yet'}</p>
          <p className="text-xs mt-1">
            Take a photo or choose an existing photo saved on your device
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
                    {photo.signed_url_error ? <div className="aspect-square flex items-center justify-center p-3 text-center text-xs text-muted-foreground">Preview unavailable. Refresh to retry.</div> : <img
                      src={getPhotoUrl(photo, 'thumbnail')}
                      loading="lazy"
                      decoding="async"
                      alt={photo.file_name}
                      className="aspect-square w-full object-cover"
                    />}
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

      {(hasPrevious || hasNext) && (
        <nav aria-label="Photo gallery pages" className="flex items-center justify-center gap-3">
          <Button variant="outline" disabled={!online || loading || !hasPrevious} onClick={previous}>Previous</Button>
          <span className="text-sm" aria-live="polite">Page {pageNumber}</span>
          <Button variant="outline" disabled={!online || loading || !hasNext} onClick={next}>Next</Button>
        </nav>
      )}

      {/* Lightbox / detail dialog */}
      <Dialog
        open={!!selectedPhoto && !error}
        onOpenChange={() => setSelectedPhoto(null)}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">{selectedPhoto?.file_name ?? 'Photo details'}</DialogTitle>
          {selectedPhoto && !error && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {selectedPhoto.signed_url_error ? <p role="status" className="p-6 text-center">Preview unavailable. Close this photo and refresh to retry.</p> : <img
                src={getPhotoUrl(selectedPhoto, 'full')}
                alt={selectedPhoto.file_name}
                className="w-full max-h-[70vh] object-contain bg-black"
              />}
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

                {/* Badges row + delete */}
                <div className="flex items-center justify-between">
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
                  {canDeletePhoto(selectedPhoto) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleting || !online}
                      onClick={() => handleDelete(selectedPhoto)}
                      className="text-muted-foreground hover:text-red-500 hover:bg-red-50 h-8 px-2"
                    >
                      {deleting ? (
                        <Loader2 className="size-3.5 animate-spin mr-1" />
                      ) : (
                        <Trash2 className="size-3.5 mr-1" />
                      )}
                      Delete
                    </Button>
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
