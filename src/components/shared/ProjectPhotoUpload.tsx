'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useProject } from '@/components/providers/ProjectProvider';
import { prepareProjectPhoto } from '@/lib/prepare-project-photo';
import { resolvePhotoGeo } from '@/lib/photoGeotag';
import { uploadProjectPhoto } from '@/lib/actions/project-photo-upload';
import * as store from '@/lib/store';

type Candidate = { id: string; file: File; originalSize: number; geoLat: number | null; geoLng: number | null; capturedAt: string };

export default function ProjectPhotoUpload({ projectId, onUpload }: { projectId: string; onUpload: () => void }) {
  const { currentUserId, isDemo } = useProject();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const [online, setOnline] = useState(true);
  const [working, setWorking] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    if (!candidate) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [candidate]);

  async function upload(photo: Candidate) {
    if (!isDemo && !currentUserId) throw new Error('Sign in before uploading this photo.');
    if (!navigator.onLine) throw new Error('You are offline. Reconnect and retry this photo.');
    if (isDemo) {
      store.addProjectPhoto(projectId, {
        file_name: photo.file.name, file_url: URL.createObjectURL(photo.file),
        file_type: photo.file.type, file_size: photo.file.size, photo_category: 'standard',
        geo_lat: photo.geoLat, geo_lng: photo.geoLng,
      });
    } else {
      const formData = new FormData();
      formData.append('file', photo.file, photo.file.name);
      formData.append('metadata', JSON.stringify({ userId: currentUserId, projectId,
        operationId: photo.id, fileName: photo.file.name, geoLat: photo.geoLat,
        geoLng: photo.geoLng, capturedAt: photo.capturedAt }));
      const result = await uploadProjectPhoto(formData);
      if (!result.success) throw new Error(result.error);
    }
    setCandidate(null);
    setMessage('Photo uploaded.');
    onUpload();
  }

  async function choose(file: File | undefined, fromCamera: boolean) {
    if (!file || busy.current) return;
    busy.current = true; setWorking(true); setError(''); setMessage('');
    try {
      const [prepared, geo] = await Promise.all([
        prepareProjectPhoto(file),
        resolvePhotoGeo(file, { allowDeviceGeo: fromCamera }),
      ]);
      const photo = { id: crypto.randomUUID(), file: prepared, originalSize: file.size,
        geoLat: geo?.lat ?? null, geoLng: geo?.lng ?? null, capturedAt: new Date().toISOString() };
      if (!window.confirm(`Upload ${prepared.name} (${Math.ceil(prepared.size / 1024)} KB)? Keep the original for full resolution.`)) return;
      setCandidate(photo);
      await upload(photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed. Reconnect and retry.');
    } finally { busy.current = false; setWorking(false); }
  }

  return <div className="space-y-2 sm:max-w-md">
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={() => camera.current?.click()} disabled={working || !!candidate || (!online && !isDemo)} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
        {working ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Camera className="mr-2 size-4" />}Take Photo
      </Button>
      <Button type="button" variant="outline" onClick={() => library.current?.click()} disabled={working || !!candidate || (!online && !isDemo)}>
        <ImagePlus className="mr-2 size-4" />Choose Existing Photo
      </Button>
    </div>
    <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" aria-label="Take a new photo" onChange={(event) => { void choose(event.target.files?.[0], true); event.target.value = ''; }} />
    <input ref={library} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" className="hidden" aria-label="Choose a saved photo" onChange={(event) => { void choose(event.target.files?.[0], false); event.target.value = ''; }} />
    <p className="text-xs text-muted-foreground">Online connection required. One photo at a time, optimized to 500 KB or less.</p>
    {!online && !isDemo && <p role="status" className="text-xs text-amber-700 dark:text-amber-300">Reconnect to take or choose a project photo.</p>}
    {message && <p role="status" className="text-sm">{message}</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {candidate && !working && <div className="flex flex-wrap gap-2 rounded border p-3">
      <p className="w-full text-sm">{candidate.file.name} was not uploaded. Reconnect and retry, or keep the original on your device.</p>
      <Button type="button" variant="outline" onClick={async () => { if (busy.current) return; busy.current = true; setWorking(true); setError(''); try { await upload(candidate); } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed.'); } finally { busy.current = false; setWorking(false); } }}>Retry upload</Button>
      <Button type="button" variant="ghost" onClick={() => { if (window.confirm('Discard this retry? The original on your device is unchanged.')) { setCandidate(null); setError(''); } }}>Discard retry</Button>
    </div>}
  </div>;
}
