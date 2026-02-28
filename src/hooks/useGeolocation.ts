'use client';

import { useState, useCallback } from 'react';
import type { GeoTag } from '@/lib/types';

interface GeolocationState {
  geoTag: GeoTag | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    geoTag: null,
    loading: false,
    error: null,
  });

  const captureLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Geolocation not supported by this browser.' }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          geoTag: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude ?? undefined,
            timestamp: new Date().toISOString(),
          },
          loading: false,
          error: null,
        });
      },
      (err) => {
        setState({
          geoTag: null,
          loading: false,
          error: err.code === 1
            ? 'Location access denied. Enable in browser settings.'
            : err.code === 2
              ? 'Location unavailable. Try again.'
              : 'Location request timed out.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const clearLocation = useCallback(() => {
    setState({ geoTag: null, loading: false, error: null });
  }, []);

  return { ...state, captureLocation, clearLocation };
}
