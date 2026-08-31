'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePWA } from '@/components/providers/ServiceWorkerProvider';
import { prepareProjectPhoto } from '@/lib/prepare-project-photo';
import { resolvePhotoGeo } from '@/lib/photoGeotag';
import { enqueueProjectPhoto } from '@/lib/offline/project-photo';
import { getOfflineStorageErrorMessage } from '@/lib/offline/errors';
import { OFFLINE_DATA_CLEARING_EVENT } from '@/lib/offline/storage';
import type { OfflinePhotoInput } from '@/lib/offline/outbox';
import * as store from '@/lib/store';

export default function ProjectPhotoUpload({ projectId, onDemoUpload }: { projectId: string; onDemoUpload: () => void }) {
  const { currentUserId, isDemo } = useProject();
  const { connectivityStatus } = usePWA();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const activeScope = useRef(`${currentUserId}:${projectId}`);
  const [working, setWorking] = useState(false);
  const [candidate, setCandidate] = useState<OfflinePhotoInput | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const scope = `${currentUserId}:${projectId}`;

  useEffect(() => {
    activeScope.current = scope;
    const clear = () => { activeScope.current = ''; setCandidate(null); setMessage(''); setError(''); };
    window.addEventListener(OFFLINE_DATA_CLEARING_EVENT, clear);
    return () => { activeScope.current = ''; window.removeEventListener(OFFLINE_DATA_CLEARING_EVENT, clear); };
  }, [scope]);

  useEffect(() => {
    if (!candidate) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [candidate]);

  async function save(photo: OfflinePhotoInput) {
    if (activeScope.current !== scope) return;
    if (!isDemo && !currentUserId) throw new Error('Sign in before saving this photo.');
    if (isDemo) {
      store.addProjectPhoto(projectId, {
        file_name: photo.file.name, file_url: URL.createObjectURL(photo.file),
        file_type: photo.file.type, file_size: photo.file.size, photo_category: 'standard',
        geo_lat: photo.geo_lat, geo_lng: photo.geo_lng,
      });
      onDemoUpload();
    } else {
      await enqueueProjectPhoto(currentUserId, projectId, photo);
    }
    if (activeScope.current !== scope) return;
    setCandidate(null);
    setMessage(isDemo ? 'Photo added to this demo.' : 'Saved on this device. See Sync Center for upload progress; uploads resume when connected.');
  }

  async function choose(file: File | undefined, fromCamera: boolean) {
    if (!file || busy.current) return;
    busy.current = true;
    setWorking(true); setError(''); setMessage('');
    try {
      const prepared = await prepareProjectPhoto(file);
      // Imported photos must not inherit the uploader's current GPS location.
      const geo = await resolvePhotoGeo(file, { allowDeviceGeo: fromCamera });
      if (activeScope.current !== scope) return;
      const photo: OfflinePhotoInput = {
        id: crypto.randomUUID(), file: prepared, category: 'standard',
        geo_lat: geo?.lat ?? null, geo_lng: geo?.lng ?? null, originalSize: file.size,
      };
      if (!window.confirm(`Upload ${prepared.name} (${Math.ceil(prepared.size / 1024)} KB)? The optimized copy will be saved on this device and uploaded when connected. Keep the original for full resolution.`)) return;
      setCandidate(photo);
      await save(photo);
    } catch (err) {
      if (activeScope.current === scope) setError(getOfflineStorageErrorMessage(err));
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }

  return (
    <div className="space-y-2 sm:max-w-md">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => camera.current?.click()} disabled={working || !!candidate} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
          {working ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Camera className="mr-2 size-4" />}Take Photo
        </Button>
        <Button type="button" variant="outline" onClick={() => library.current?.click()} disabled={working || !!candidate}>
          <ImagePlus className="mr-2 size-4" />Choose Existing Photo
        </Button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a new photo" onChange={(event) => { void choose(event.target.files?.[0], true); event.target.value = ''; }} />
      <input ref={library} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" aria-label="Choose a saved photo" onChange={(event) => { void choose(event.target.files?.[0], false); event.target.value = ''; }} />
      <p className="text-xs text-muted-foreground">One photo at a time. Optimized to 500 KB or less; keep your original for full resolution.</p>
      {connectivityStatus !== 'online' && <p className="text-xs text-amber-700 dark:text-amber-300">Offline or checking connection: confirmed photos stay on this device until upload is available.</p>}
      {message && <p role="status" className="text-sm">{message}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {candidate && !working && (
        <div className="space-y-2 rounded border p-3">
          <p className="text-sm">{candidate.file.name} has not been saved. Keep this page open and retry after freeing space.</p>
          <Button type="button" variant="outline" onClick={async () => {
            if (busy.current) return;
            busy.current = true; setWorking(true); setError('');
            try { await save(candidate); } catch (err) { setError(getOfflineStorageErrorMessage(err)); }
            finally { busy.current = false; setWorking(false); }
          }}>Retry saving photo</Button>
          <Button type="button" variant="ghost" onClick={() => { if (window.confirm('Discard this unsaved selection? The original on your device is unchanged.')) { setCandidate(null); setError(''); } }}>Discard selection</Button>
        </div>
      )}
    </div>
  );
}
