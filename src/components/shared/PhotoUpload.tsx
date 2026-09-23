'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Thermometer, X, MapPin, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { uploadPhotoAttachment } from '@/lib/uploadPhotosAfterCreate';
import { resolvePhotoGeoBatch, type PhotoGeoSource } from '@/lib/photoGeotag';
import type { PhotoCategory, Attachment } from '@/lib/types';

export interface PhotoFile {
  id: string;
  file: File;
  preview: string;
  category: PhotoCategory;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_source?: PhotoGeoSource | null;
  uploading?: boolean;
  preparing?: boolean;
  uploadError?: string;
  originalSize?: number;
  capturedAt?: string;
  sourceAttachmentId?: string;
}

interface PhotoUploadProps {
  photos: PhotoFile[];
  onPhotosChange: (photos: PhotoFile[]) => void;
  onPhotoRemove?: (photo: PhotoFile) => void;
  maxFiles?: number;
  showGeoCapture?: boolean;
  entityType?: string;
  entityId?: string;
  projectId?: string;
  onUploadComplete?: (attachment: Attachment) => void;
}

const ACCEPTED_IMAGE_TYPES = '.jpg,.jpeg,.png,.webp,.heic,.heif';
const THERMAL_TYPES = '.jpg,.jpeg,.png,.is2,.seq,.csq,.radiometric';
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export default function PhotoUpload({
  photos,
  onPhotosChange,
  onPhotoRemove,
  maxFiles = 20,
  showGeoCapture = true,
  entityType,
  entityId,
  projectId,
  onUploadComplete,
}: PhotoUploadProps) {
  const [category, setCategory] = useState<PhotoCategory>('standard');
  const [geoLoading, setGeoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef(photos);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const publishPhotos = useCallback((next: PhotoFile[]) => {
    photosRef.current = next;
    onPhotosChange(next);
  }, [onPhotosChange]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;

    const remaining = maxFiles - photosRef.current.length;
    if (remaining <= 0) return;

    const files = Array.from(fileList)
      .slice(0, remaining)
      .filter((file) => file.size <= MAX_FILE_SIZE);
    if (files.length === 0) return;

    const newPhotos: PhotoFile[] = files.map(file => ({
      id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), category,
      geo_lat: null, geo_lng: null, geo_source: null, preparing: true,
      uploading: !!(entityType && entityId && projectId), originalSize: file.size,
    }));
    publishPhotos([...photosRef.current, ...newPhotos]);
    setGeoLoading(showGeoCapture);
    const geos = showGeoCapture
      ? await resolvePhotoGeoBatch(files, { allowDeviceGeo: true }).catch(() => files.map(() => null)).finally(() => setGeoLoading(false))
      : files.map(() => null);
    const ready = new Map(newPhotos.map((photo, index) => [photo.id, {
      ...photo, preparing: false, geo_lat: geos[index]?.lat ?? null,
      geo_lng: geos[index]?.lng ?? null, geo_source: geos[index]?.source ?? null,
    }]));
    publishPhotos(photosRef.current.map(photo => ready.get(photo.id) ?? photo));

    // Only do server upload if entity context is provided
    if (!entityType || !entityId || !projectId) return;

    // Upload each photo
    for (const photo of ready.values()) {
      if (!photosRef.current.some(current => current.id === photo.id)) continue;
      try {
        const result = await uploadPhotoAttachment({
          file: photo.file,
          category: photo.category,
          entityType,
          entityId,
          projectId,
          geoLat: photo.geo_lat,
          geoLng: photo.geo_lng,
        });

        if (result.error) {
          publishPhotos(photosRef.current.map((p) => p.id === photo.id ? { ...p, uploading: false, uploadError: result.error } : p));
          alert(`Upload failed: ${result.error}`);
        } else {
          publishPhotos(
            photosRef.current.map((p) =>
              p.id === photo.id
                ? { ...p, uploading: false, uploadError: undefined, file: result.data?.file ?? p.file }
                : p
            )
          );
          if (result.data) onUploadComplete?.(result.data.attachment);
        }
      } catch {
        publishPhotos(photosRef.current.map((p) => p.id === photo.id ? { ...p, uploading: false, uploadError: 'Upload could not be confirmed. Retry while this page is open.' } : p));
        alert(`Upload failed for ${photo.file.name}`);
      }
    }
  }, [publishPhotos, maxFiles, category, showGeoCapture, entityType, entityId, projectId, onUploadComplete]);

  const removePhoto = useCallback((id: string) => {
    const photo = photosRef.current.find((p) => p.id === id);
    if (photo) {
      URL.revokeObjectURL(photo.preview);
      onPhotoRemove?.(photo);
    }
    publishPhotos(photosRef.current.filter((p) => p.id !== id));
  }, [publishPhotos, onPhotoRemove]);

  const acceptTypes = category === 'thermal'
    ? THERMAL_TYPES
    : ACCEPTED_IMAGE_TYPES;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="size-5" />
          Photos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Category selector */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={category === 'standard' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory('standard')}
            className={category === 'standard' ? 'bg-rc-blue hover:bg-rc-blue/90 text-white' : ''}
          >
            <Camera className="mr-1.5 size-3.5" />
            Standard Photo
          </Button>
          <Button
            type="button"
            variant={category === 'thermal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory('thermal')}
            className={category === 'thermal' ? 'bg-rc-orange hover:bg-rc-orange/90 text-white' : ''}
          >
            <Thermometer className="mr-1.5 size-3.5" />
            Thermal Photo
          </Button>
        </div>

        {/* Upload area */}
        <div
          className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-rc-border py-8 px-4 cursor-pointer transition-colors hover:border-rc-blue/50 hover:bg-rc-blue/5"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleFiles(e.dataTransfer.files);
          }}
        >
          {geoLoading ? (
            <>
              <Loader2 className="size-8 animate-spin text-rc-blue" />
              <p className="text-sm text-muted-foreground">Reading photo location...</p>
            </>
          ) : (
            <>
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {category === 'thermal' ? 'Upload thermal images' : 'Upload photos'}
              </p>
              <p className="text-xs text-muted-foreground">
                Drag & drop or click to browse. Max {MAX_FILE_SIZE / (1024 * 1024)}MB per file.
              </p>
              {showGeoCapture && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="size-3" />
                  Uses readable photo GPS first, then device location when permitted
                </p>
              )}
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptTypes}
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              // Reset input so the same files or new files can be selected again on mobile
              e.target.value = '';
            }}
          />
        </div>

        {/* Photo previews */}
        {photos.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-rc-border bg-muted">
                {photo.file.type.startsWith('image/') ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={photo.preview}
                    alt={photo.file.name}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center">
                    <ImageIcon className="size-8 text-muted-foreground" />
                  </div>
                )}
                {/* Upload spinner overlay */}
                {(photo.uploading || photo.preparing) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="size-8 animate-spin text-white" />
                  </div>
                )}
                {photo.uploadError && <div className="absolute inset-x-0 top-0 bg-red-50 p-2 text-xs text-red-800">
                  <p>{photo.uploadError}</p>
                  {entityType && entityId && projectId && <Button type="button" size="sm" variant="outline" onClick={async () => {
                    publishPhotos(photosRef.current.map(p => p.id === photo.id ? { ...p, uploading: true } : p));
                    try {
                      const result = await uploadPhotoAttachment({ file: photo.file, category: photo.category, entityType, entityId, projectId, geoLat: photo.geo_lat, geoLng: photo.geo_lng });
                      publishPhotos(photosRef.current.map(p => p.id === photo.id ? { ...p, uploading: false, uploadError: result.error, file: result.data?.file ?? p.file } : p));
                      if (result.data) onUploadComplete?.(result.data.attachment);
                    } catch { publishPhotos(photosRef.current.map(p => p.id === photo.id ? { ...p, uploading: false, uploadError: 'Could not upload. Keep this page open and retry.' } : p)); }
                  }}>Retry photo</Button>}
                </div>}
                {/* Overlay badges */}
                <div className="absolute bottom-1 left-1 flex flex-wrap gap-1">
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 ${
                      photo.category === 'thermal'
                        ? 'bg-rc-orange/90 text-white'
                        : 'bg-black/60 text-white'
                    }`}
                  >
                    {photo.category === 'thermal' ? 'Thermal' : 'Photo'}
                  </Badge>
                  {photo.geo_lat !== null && photo.geo_lng !== null ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-rc-emerald/90 text-white">
                      <MapPin className="mr-0.5 size-2.5" />
                      {photo.geo_source === 'exif' ? 'EXIF GPS' : 'GPS'}
                    </Badge>
                  ) : showGeoCapture ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/90 text-white">
                      <MapPin className="mr-0.5 size-2.5" />
                      No GPS
                    </Badge>
                  ) : null}
                  {photo.originalSize && photo.file.size < photo.originalSize * 0.8 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-600 text-white">
                      Optimised
                    </Badge>
                  )}
                </div>
                {/* Remove button */}
                <button
                  type="button"
                  className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }}
                >
                  <X className="size-3.5" />
                </button>
                {/* File name */}
                <p className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">{photo.file.name}</p>
              </div>
            ))}
          </div>
        )}

        {photos.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {photos.length} / {maxFiles} photos attached
            {showGeoCapture &&
              ` - ${
                photos.filter((photo) => photo.geo_lat !== null && photo.geo_lng !== null)
                  .length
              } with GPS`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
