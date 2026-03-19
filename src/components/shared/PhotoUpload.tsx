'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Thermometer, X, MapPin, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { compressImage } from '@/lib/compressImage';
import { uploadAttachment } from '@/lib/actions/attachments';
import type { PhotoCategory, Attachment } from '@/lib/types';

export interface PhotoFile {
  id: string;
  file: File;
  preview: string;
  category: PhotoCategory;
  geo_lat: number | null;
  geo_lng: number | null;
  uploading?: boolean;
  uploadError?: string;
  originalSize?: number;
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
  photosRef.current = photos;

  const captureGeoForPhoto = useCallback((): Promise<{ lat: number; lng: number } | null> => {
    if (!showGeoCapture || !navigator.geolocation) return Promise.resolve(null);

    return new Promise((resolve) => {
      setGeoLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoLoading(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setGeoLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
      );
    });
  }, [showGeoCapture]);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList) return;

    const remaining = maxFiles - photos.length;
    const files = Array.from(fileList).slice(0, remaining);
    const geo = await captureGeoForPhoto();

    const newPhotos: PhotoFile[] = files
      .filter((f) => f.size <= MAX_FILE_SIZE)
      .map((file) => ({
        id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
        category,
        geo_lat: geo?.lat ?? null,
        geo_lng: geo?.lng ?? null,
        uploading: !!(entityType && entityId && projectId),
        originalSize: file.size,
      }));

    // Show previews immediately
    const allPhotos = [...photos, ...newPhotos];
    onPhotosChange(allPhotos);

    // Only do server upload if entity context is provided
    if (!entityType || !entityId || !projectId) return;

    // Upload each photo
    for (const photo of newPhotos) {
      try {
        const compressed = await compressImage(photo.file, photo.category);

        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('entity_type', entityType);
        formData.append('entity_id', entityId);
        formData.append('project_id', projectId);
        formData.append('photo_category', photo.category);
        if (photo.geo_lat !== null) formData.append('geo_lat', String(photo.geo_lat));
        if (photo.geo_lng !== null) formData.append('geo_lng', String(photo.geo_lng));

        const result = await uploadAttachment(formData);

        if (result.error) {
          onPhotosChange(photosRef.current.filter((p) => p.id !== photo.id));
          alert(`Upload failed: ${result.error}`);
        } else {
          onPhotosChange(
            photosRef.current.map((p) =>
              p.id === photo.id
                ? { ...p, uploading: false, file: compressed }
                : p
            )
          );
          if (result.data) onUploadComplete?.(result.data);
        }
      } catch {
        onPhotosChange(photosRef.current.filter((p) => p.id !== photo.id));
        alert(`Upload failed for ${photo.file.name}`);
      }
    }
  }, [photos, onPhotosChange, maxFiles, category, captureGeoForPhoto, entityType, entityId, projectId, onUploadComplete]);

  const removePhoto = useCallback((id: string) => {
    const photo = photos.find((p) => p.id === id);
    if (photo) {
      URL.revokeObjectURL(photo.preview);
      onPhotoRemove?.(photo);
    }
    onPhotosChange(photos.filter((p) => p.id !== id));
  }, [photos, onPhotosChange, onPhotoRemove]);

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
              <p className="text-sm text-muted-foreground">Capturing location...</p>
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
                  GPS location will be attached when permitted
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
                {photo.uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="size-8 animate-spin text-white" />
                  </div>
                )}
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
                  {photo.geo_lat !== null && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-rc-emerald/90 text-white">
                      <MapPin className="mr-0.5 size-2.5" />GPS
                    </Badge>
                  )}
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
          </p>
        )}
      </CardContent>
    </Card>
  );
}
