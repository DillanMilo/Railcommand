'use client';

import { useState } from 'react';
import { Camera, Thermometer, MapPin, X, ImageOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { Attachment } from '@/lib/types';

interface PhotoGalleryProps {
  attachments: Attachment[];
  title?: string;
}

export default function PhotoGallery({ attachments, title = 'Photos' }: PhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Attachment | null>(null);

  const photos = attachments.filter((a) =>
    a.file_type.startsWith('image/') || a.photo_category === 'thermal'
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="size-5" />
            {title}
            {photos.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">{photos.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-rc-border py-8 text-muted-foreground">
              <ImageOff className="size-8 mb-2" />
              <p className="text-sm">No photos attached</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setSelectedPhoto(photo)}
                  className="group relative rounded-lg overflow-hidden border border-rc-border bg-muted text-left transition-shadow hover:shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.file_url}
                    alt={photo.file_name}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute bottom-1 left-1 flex flex-wrap gap-1">
                    {photo.photo_category === 'thermal' && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-rc-orange/90 text-white">
                        <Thermometer className="mr-0.5 size-2.5" />Thermal
                      </Badge>
                    )}
                    {photo.geo_lat !== null && photo.geo_lng !== null && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-rc-emerald/90 text-white">
                        <MapPin className="mr-0.5 size-2.5" />GPS
                      </Badge>
                    )}
                  </div>
                  <p className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">{photo.file_name}</p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full-size photo dialog */}
      <Dialog open={!!selectedPhoto} onOpenChange={() => setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {selectedPhoto && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedPhoto.file_url}
                alt={selectedPhoto.file_name}
                className="w-full max-h-[70vh] object-contain bg-black"
              />
              <div className="p-4 space-y-2">
                <p className="text-sm font-medium">{selectedPhoto.file_name}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {selectedPhoto.photo_category === 'thermal' && (
                    <span className="flex items-center gap-1 text-rc-orange">
                      <Thermometer className="size-3" />Thermal Image
                    </span>
                  )}
                  {selectedPhoto.geo_lat !== null && selectedPhoto.geo_lng !== null && (
                    <span className="flex items-center gap-1 text-rc-emerald">
                      <MapPin className="size-3" />
                      {selectedPhoto.geo_lat.toFixed(6)}, {selectedPhoto.geo_lng.toFixed(6)}
                    </span>
                  )}
                  {selectedPhoto.captured_at && (
                    <span>Captured: {new Date(selectedPhoto.captured_at).toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
