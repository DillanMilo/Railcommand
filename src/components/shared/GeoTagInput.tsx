'use client';

import { MapPin, Loader2, X, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/useGeolocation';
import type { GeoTag } from '@/lib/types';

interface GeoTagInputProps {
  value: GeoTag | null;
  onChange: (tag: GeoTag | null) => void;
  label?: string;
}

export default function GeoTagInput({ value, onChange, label = 'GPS Location' }: GeoTagInputProps) {
  const { geoTag, loading, error, captureLocation, clearLocation } = useGeolocation();

  const handleCapture = () => {
    captureLocation();
  };

  // Sync hook state → parent when captured
  if (geoTag && (!value || value.lat !== geoTag.lat || value.lng !== geoTag.lng)) {
    onChange(geoTag);
  }

  const handleClear = () => {
    clearLocation();
    onChange(null);
  };

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1">
        {value ? (
          <div className="flex items-center gap-2 rounded-md border border-rc-border bg-rc-emerald/5 px-3 py-2">
            <MapPin className="size-4 text-rc-emerald shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-rc-emerald">Location captured</p>
              <p className="text-xs text-muted-foreground truncate">
                {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
                {value.accuracy && ` (±${Math.round(value.accuracy)}m)`}
              </p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-red-500" onClick={handleClear}>
              <X className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCapture}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <Navigation className="mr-1.5 size-3.5" />
              )}
              {loading ? 'Capturing...' : 'Capture GPS Location'}
            </Button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
