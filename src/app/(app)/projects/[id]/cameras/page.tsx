'use client';

import { FormEvent, useEffect, useMemo, useState, use } from 'react';
import { format, parseISO } from 'date-fns';
import {
  AlertTriangle,
  Building2,
  Camera,
  ChevronDown,
  CheckCircle2,
  Cctv,
  ExternalLink,
  FileVideo,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Video,
} from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useEarthCamWorkspace } from '@/hooks/useData';
import { ACTIONS } from '@/lib/permissions';
import * as store from '@/lib/store';
import { cn } from '@/lib/utils';
import type {
  EarthCamCamera,
  EarthCamCameraStatus,
  EarthCamConnection,
  EarthCamEvidence,
  EarthCamEvidenceType,
} from '@/lib/types';
import {
  createEarthCamAccessLink,
  createEarthCamEvidence,
  deleteEarthCamCamera as serverDeleteEarthCamCamera,
  deleteEarthCamEvidence as serverDeleteEarthCamEvidence,
  saveEarthCamConnection as serverSaveEarthCamConnection,
  syncEarthCamCameras as serverSyncEarthCamCameras,
  upsertEarthCamCamera,
} from '@/lib/actions/earthcam';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type CameraForm = {
  id: string;
  earthcamCameraId: string;
  name: string;
  locationLabel: string;
  railArea: string;
  liveEmbedUrl: string;
  liveStreamUrl: string;
  thumbnailUrl: string;
  status: EarthCamCameraStatus;
  ptzEnabled: boolean;
};

type EvidenceForm = {
  cameraId: string;
  evidenceType: EarthCamEvidenceType;
  title: string;
  description: string;
  capturedAt: string;
  startTime: string;
  endTime: string;
  earthCamAssetId: string;
  earthCamUrl: string;
};

type EarthCamAuthMode = EarthCamConnection['auth_mode'];

const emptyCameraForm: CameraForm = {
  id: '',
  earthcamCameraId: '',
  name: '',
  locationLabel: '',
  railArea: '',
  liveEmbedUrl: '',
  liveStreamUrl: '',
  thumbnailUrl: '',
  status: 'online',
  ptzEnabled: false,
};

function toLocalInput(value: string = new Date().toISOString()) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function formatDateTime(value?: string | null) {
  if (!value) return '--';
  try {
    return format(parseISO(value), 'MMM d, yyyy h:mm a');
  } catch {
    return '--';
  }
}

function statusClass(status: EarthCamCameraStatus) {
  if (status === 'online') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'maintenance') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
}

function authModeLabel(mode?: EarthCamAuthMode | null) {
  if (mode === 'oauth') return 'SSO';
  if (mode === 'api_key') return 'API';
  return 'Managed';
}

export default function CamerasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id: projectId } = use(params);
  use(searchParams);

  const { isDemo } = useProject();
  const { can } = usePermissions(projectId);
  const { data, loading, error, refetch } = useEarthCamWorkspace(projectId);

  const canView = can(ACTIONS.EARTHCAM_VIEW);
  const canAdmin = can(ACTIONS.EARTHCAM_ADMIN);
  const canManage = can(ACTIONS.EARTHCAM_MANAGE);
  const canCapture = can(ACTIONS.EARTHCAM_CAPTURE);
  const connected = data.connection?.status === 'connected';

  const [saving, setSaving] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [connectionForm, setConnectionForm] = useState({
    accountName: 'EarthCam',
    authMode: 'service_account' as EarthCamAuthMode,
    apiBaseUrl: '',
    apiKey: '',
    embedSigningSecret: '',
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraForm, setCameraForm] = useState<CameraForm>(emptyCameraForm);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState<EvidenceForm>({
    cameraId: '',
    evidenceType: 'clip',
    title: '',
    description: '',
    capturedAt: toLocalInput(),
    startTime: '',
    endTime: '',
    earthCamAssetId: '',
    earthCamUrl: '',
  });

  useEffect(() => {
    if (!data.connection?.account_name) return;
    setConnectionForm((current) => ({
      ...current,
      accountName: data.connection?.account_name ?? current.accountName,
      authMode: data.connection?.auth_mode ?? current.authMode,
      apiBaseUrl: data.connection?.api_base_url ?? current.apiBaseUrl,
    }));
  }, [data.connection?.account_name, data.connection?.auth_mode, data.connection?.api_base_url]);

  const selectedCamera =
    data.cameras.find((camera) => camera.id === selectedCameraId) ?? data.cameras[0] ?? null;

  const camerasById = useMemo(() => {
    return new Map(data.cameras.map((camera) => [camera.id, camera]));
  }, [data.cameras]);

  const counts = useMemo(
    () => ({
      snapshots: data.evidence.filter((item) => item.evidence_type === 'snapshot').length,
      clips: data.evidence.filter((item) => item.evidence_type === 'clip').length,
    }),
    [data.evidence]
  );

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAdmin) return;
    setSaving(true);
    try {
      if (isDemo) {
        store.saveEarthCamConnection({
          account_name: connectionForm.accountName,
          auth_mode: connectionForm.authMode,
          api_base_url: connectionForm.apiBaseUrl,
          api_key: connectionForm.apiKey,
        });
      } else {
        const result = await serverSaveEarthCamConnection(projectId, {
          accountName: connectionForm.accountName,
          authMode: connectionForm.authMode,
          apiBaseUrl: connectionForm.apiBaseUrl,
          apiKey: connectionForm.apiKey,
          embedSigningSecret: connectionForm.embedSigningSecret,
        });
        if (result.error) {
          alert(result.error);
          return;
        }
      }
      setConnectionForm((current) => ({ ...current, apiKey: '', embedSigningSecret: '' }));
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleSyncCameras() {
    if (!canManage || !connected) return;
    setSaving(true);
    try {
      if (isDemo) {
        store.saveEarthCamConnection({
          account_name: data.connection?.account_name ?? 'EarthCam',
          auth_mode: data.connection?.auth_mode ?? 'service_account',
          api_base_url: data.connection?.api_base_url ?? '',
        });
      } else {
        const result = await serverSyncEarthCamCameras(projectId);
        if (result.error) {
          alert(result.error);
          return;
        }
      }
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function openEarthCamCamera(camera: EarthCamCamera) {
    if (!canView) return;
    if (isDemo) {
      const url = camera.live_stream_url || camera.live_embed_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    setSaving(true);
    try {
      const result = await createEarthCamAccessLink(projectId, {
        targetType: 'camera',
        cameraId: camera.id,
      });
      if (!result.success) {
        alert(result.error);
        return;
      }
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setSaving(false);
    }
  }

  async function openEarthCamEvidence(item: EarthCamEvidence) {
    if (!canView) return;
    if (isDemo) {
      if (item.earthcam_url) window.open(item.earthcam_url, '_blank', 'noopener,noreferrer');
      return;
    }

    setSaving(true);
    try {
      const result = await createEarthCamAccessLink(projectId, {
        targetType: 'evidence',
        evidenceId: item.id,
      });
      if (!result.success) {
        alert(result.error);
        return;
      }
      window.open(result.data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setSaving(false);
    }
  }

  function openCameraForm(camera?: EarthCamCamera) {
    setCameraForm(
      camera
        ? {
            id: camera.id,
            earthcamCameraId: camera.earthcam_camera_id,
            name: camera.name,
            locationLabel: camera.location_label,
            railArea: camera.rail_area,
            liveEmbedUrl: camera.live_embed_url,
            liveStreamUrl: camera.live_stream_url,
            thumbnailUrl: camera.thumbnail_url,
            status: camera.status,
            ptzEnabled: camera.ptz_enabled,
          }
        : emptyCameraForm
    );
    setCameraOpen(true);
  }

  async function handleSaveCamera(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    if (!cameraForm.name.trim() || !cameraForm.earthcamCameraId.trim()) {
      alert('Camera name and EarthCam ID are required.');
      return;
    }

    setSaving(true);
    try {
      if (isDemo) {
        if (cameraForm.id) {
          store.updateEarthCamCamera(cameraForm.id, {
            earthcam_camera_id: cameraForm.earthcamCameraId,
            name: cameraForm.name,
            location_label: cameraForm.locationLabel,
            rail_area: cameraForm.railArea,
            live_embed_url: cameraForm.liveEmbedUrl,
            live_stream_url: cameraForm.liveStreamUrl,
            thumbnail_url: cameraForm.thumbnailUrl,
            status: cameraForm.status,
            ptz_enabled: cameraForm.ptzEnabled,
            last_seen_at: new Date().toISOString(),
          });
        } else {
          const camera = store.addEarthCamCamera(projectId, {
            earthcam_camera_id: cameraForm.earthcamCameraId,
            name: cameraForm.name,
            location_label: cameraForm.locationLabel,
            rail_area: cameraForm.railArea,
            live_embed_url: cameraForm.liveEmbedUrl,
            live_stream_url: cameraForm.liveStreamUrl,
            thumbnail_url: cameraForm.thumbnailUrl,
            status: cameraForm.status,
            ptz_enabled: cameraForm.ptzEnabled,
          });
          setSelectedCameraId(camera.id);
        }
      } else {
        const result = await upsertEarthCamCamera(projectId, {
          id: cameraForm.id || undefined,
          earthcamCameraId: cameraForm.earthcamCameraId,
          name: cameraForm.name,
          locationLabel: cameraForm.locationLabel,
          railArea: cameraForm.railArea,
          liveEmbedUrl: cameraForm.liveEmbedUrl,
          liveStreamUrl: cameraForm.liveStreamUrl,
          thumbnailUrl: cameraForm.thumbnailUrl,
          status: cameraForm.status,
          ptzEnabled: cameraForm.ptzEnabled,
        });
        if (result.error) {
          alert(result.error);
          return;
        }
        if (result.data) setSelectedCameraId(result.data.id);
      }
      setCameraOpen(false);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCamera(camera: EarthCamCamera) {
    if (!canManage || !confirm(`Remove ${camera.name}?`)) return;
    setSaving(true);
    try {
      if (isDemo) {
        store.deleteEarthCamCamera(camera.id);
      } else {
        const result = await serverDeleteEarthCamCamera(projectId, camera.id);
        if (result.error) {
          alert(result.error);
          return;
        }
      }
      setSelectedCameraId('');
      refetch();
    } finally {
      setSaving(false);
    }
  }

  function openEvidenceForm(type: EarthCamEvidenceType, camera: EarthCamCamera) {
    setEvidenceForm({
      cameraId: camera.id,
      evidenceType: type,
      title: type === 'clip' ? `${camera.name} clip` : `${camera.name} snapshot`,
      description: '',
      capturedAt: toLocalInput(),
      startTime: '',
      endTime: '',
      earthCamAssetId: '',
      earthCamUrl: camera.live_stream_url || camera.live_embed_url,
    });
    setEvidenceOpen(true);
  }

  async function saveEvidence(form: EvidenceForm) {
    if (!canCapture || !form.cameraId || !form.title.trim()) return;
    const camera = camerasById.get(form.cameraId);

    setSaving(true);
    try {
      if (isDemo) {
        store.addEarthCamEvidence(projectId, {
          camera_id: form.cameraId,
          evidence_type: form.evidenceType,
          title: form.title,
          description: form.description,
          captured_at: fromLocalInput(form.capturedAt),
          start_time: fromLocalInput(form.startTime) ?? null,
          end_time: fromLocalInput(form.endTime) ?? null,
          earthcam_asset_id: form.earthCamAssetId || null,
          earthcam_url: form.earthCamUrl,
          thumbnail_url: camera?.thumbnail_url ?? '',
        });
      } else {
        const result = await createEarthCamEvidence(projectId, {
          cameraId: form.cameraId,
          evidenceType: form.evidenceType,
          title: form.title,
          description: form.description,
          capturedAt: fromLocalInput(form.capturedAt),
          startTime: fromLocalInput(form.startTime) ?? null,
          endTime: fromLocalInput(form.endTime) ?? null,
          earthCamAssetId: form.earthCamAssetId || null,
          earthCamUrl: form.earthCamUrl,
          thumbnailUrl: camera?.thumbnail_url ?? '',
        });
        if (result.error) {
          alert(result.error);
          return;
        }
      }
      setEvidenceOpen(false);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleSnapshot(camera: EarthCamCamera) {
    await saveEvidence({
      cameraId: camera.id,
      evidenceType: 'snapshot',
      title: `${camera.name} snapshot`,
      description: 'EarthCam snapshot reference',
      capturedAt: toLocalInput(),
      startTime: '',
      endTime: '',
      earthCamAssetId: '',
      earthCamUrl: camera.live_stream_url || camera.live_embed_url,
    });
  }

  async function handleDeleteEvidence(evidenceId: string) {
    if (!canCapture || !confirm('Delete this EarthCam reference?')) return;
    setSaving(true);
    try {
      if (isDemo) {
        store.removeEarthCamEvidence(evidenceId);
      } else {
        const result = await serverDeleteEarthCamEvidence(projectId, evidenceId);
        if (result.error) {
          alert(result.error);
          return;
        }
      }
      refetch();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-rc-orange/30 border-t-rc-orange" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Cameras' }]} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">Cameras</h1>
            <Badge variant="secondary" className="text-xs">{data.cameras.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            EarthCam {connected ? 'connected' : 'not connected'} - {counts.snapshots} snapshots - {counts.clips} clips
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && connected && (
            <Button variant="outline" onClick={handleSyncCameras} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sync
            </Button>
          )}
          {canManage && connected && (
            <Button variant="outline" onClick={() => openCameraForm()}>
              <Plus className="size-4" />
              Add Camera
            </Button>
          )}
          {canView && selectedCamera && (
            <Button
              onClick={() => openEarthCamCamera(selectedCamera)}
              disabled={saving}
              className="bg-rc-orange text-white hover:bg-rc-orange-dark"
            >
              <ExternalLink className="size-4" />
              Open Live
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {canAdmin ? (
                  <Building2 className="size-4 text-rc-orange" />
                ) : (
                  <ShieldCheck className="size-4 text-rc-orange" />
                )}
                EarthCam Integration
              </CardTitle>
              <CardDescription>
                {connected
                  ? `${data.connection?.account_name} - ${authModeLabel(data.connection?.auth_mode)} connection`
                  : 'Organization-level camera access'}
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={cn(
                connected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              )}
            >
              {connected ? <CheckCircle2 className="mr-1 size-3" /> : <AlertTriangle className="mr-1 size-3" />}
              {connected ? 'Connected' : 'Needs Setup'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-rc-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Account</p>
              <p className="truncate text-sm font-medium">{data.connection?.account_name ?? 'Not connected'}</p>
            </div>
            <div className="rounded-lg border border-rc-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Method</p>
              <p className="text-sm font-medium">{authModeLabel(data.connection?.auth_mode)}</p>
            </div>
            <div className="rounded-lg border border-rc-border px-3 py-2">
              <p className="text-xs text-muted-foreground">Last Sync</p>
              <p className="text-sm font-medium">{formatDateTime(data.connection?.last_sync_at)}</p>
            </div>
          </div>

          {canAdmin && (
            <form onSubmit={handleConnect} className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_1.35fr_auto] lg:items-end">
                <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                  Account
                  <Input
                    value={connectionForm.accountName}
                    onChange={(event) =>
                      setConnectionForm((current) => ({ ...current, accountName: event.target.value }))
                    }
                    placeholder="Union Pacific EarthCam"
                  />
                </label>

                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Connection</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                      ['service_account', 'Managed', 'EarthCam account'],
                      ['oauth', 'SSO', 'Identity flow'],
                      ['api_key', 'API Key', 'Advanced'],
                    ] as const).map(([mode, label, detail]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setConnectionForm((current) => ({ ...current, authMode: mode }));
                          if (mode === 'api_key') setAdvancedOpen(true);
                        }}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-left transition-colors',
                          connectionForm.authMode === mode
                            ? 'border-rc-orange bg-rc-orange/5 text-foreground'
                            : 'border-rc-border text-muted-foreground hover:border-foreground/20'
                        )}
                      >
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="block text-xs">{detail}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Button type="submit" disabled={saving} className="bg-rc-orange text-white hover:bg-rc-orange-dark lg:self-end">
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {connected ? 'Update' : 'Connect EarthCam'}
                </Button>
              </div>

              <div className="rounded-lg border border-rc-border">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium"
                >
                  <span className="inline-flex items-center gap-2">
                    <KeyRound className="size-4 text-rc-orange" />
                    Advanced
                  </span>
                  <ChevronDown className={cn('size-4 transition-transform', advancedOpen && 'rotate-180')} />
                </button>
                {advancedOpen && (
                  <div className="grid gap-3 border-t border-rc-border p-3 md:grid-cols-3">
                    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                      API base URL
                      <Input
                        value={connectionForm.apiBaseUrl}
                        onChange={(event) =>
                          setConnectionForm((current) => ({ ...current, apiBaseUrl: event.target.value }))
                        }
                        placeholder="https://api.earthcam.example"
                      />
                    </label>
                    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                      API key
                      <Input
                        type="password"
                        value={connectionForm.apiKey}
                        onChange={(event) =>
                          setConnectionForm((current) => ({ ...current, apiKey: event.target.value }))
                        }
                        placeholder={connected ? 'Leave blank to keep current key' : 'EarthCam API key'}
                      />
                    </label>
                    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                      Embed signing secret
                      <Input
                        type="password"
                        value={connectionForm.embedSigningSecret}
                        onChange={(event) =>
                          setConnectionForm((current) => ({ ...current, embedSigningSecret: event.target.value }))
                        }
                        placeholder="Optional secure embed secret"
                      />
                    </label>
                  </div>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {connected && selectedCamera && (
        <Card className="overflow-hidden">
          <div className="grid lg:grid-cols-[1.35fr_0.85fr]">
            <div className="flex min-h-[280px] items-center justify-center bg-rc-navy text-white">
              <div className="flex flex-col items-center gap-2 text-white/80">
                <Cctv className="size-10" />
                <span className="text-xs font-medium uppercase tracking-wide">
                  {selectedCamera.earthcam_camera_id}
                </span>
              </div>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-xl font-semibold">{selectedCamera.name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedCamera.location_label || 'Unmapped location'}</p>
                </div>
                <Badge variant="outline" className={cn('capitalize', statusClass(selectedCamera.status))}>
                  {selectedCamera.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Rail Area</span>
                  <p className="font-medium">{selectedCamera.rail_area || '--'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">PTZ</span>
                  <p className="font-medium">{selectedCamera.ptz_enabled ? 'Enabled' : 'View only'}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Last Seen</span>
                  <p className="font-medium">{formatDateTime(selectedCamera.last_seen_at)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canCapture && (
                  <>
                    <Button size="sm" onClick={() => handleSnapshot(selectedCamera)} disabled={saving}>
                      <Camera className="size-4" />
                      Snapshot
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEvidenceForm('clip', selectedCamera)}>
                      <FileVideo className="size-4" />
                      Clip
                    </Button>
                  </>
                )}
                {canManage && (
                  <Button size="sm" variant="ghost" onClick={() => openCameraForm(selectedCamera)}>
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {connected && (
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Video className="size-4 text-rc-orange" />
                Camera Map
              </CardTitle>
              <CardDescription>{data.cameras.length} mapped cameras</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.cameras.map((camera) => (
                <button
                  key={camera.id}
                  type="button"
                  onClick={() => setSelectedCameraId(camera.id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    selectedCamera?.id === camera.id
                      ? 'border-rc-orange bg-rc-orange/5'
                      : 'border-rc-border hover:border-foreground/20'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{camera.name}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{camera.location_label}</p>
                    </div>
                    <Badge variant="outline" className={cn('capitalize', statusClass(camera.status))}>
                      {camera.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{camera.earthcam_camera_id}</span>
                    {camera.ptz_enabled && (
                      <span className="inline-flex items-center gap-1">
                        <Radio className="size-3" />
                        PTZ
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {data.cameras.length === 0 && (
                <div className="rounded-lg border border-dashed border-rc-border py-8 text-center text-sm text-muted-foreground">
                  No cameras mapped
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileVideo className="size-4 text-rc-orange" />
                Evidence
              </CardTitle>
              <CardDescription>{data.evidence.length} EarthCam references</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border border-rc-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-rc-card">
                      <TableHead>Type</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Camera</TableHead>
                      <TableHead>Captured</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.evidence.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="capitalize">{item.evidence_type}</TableCell>
                        <TableCell className="max-w-[220px] truncate font-medium">{item.title}</TableCell>
                        <TableCell>{camerasById.get(item.camera_id)?.name ?? 'Unknown'}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(item.captured_at)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {canView && (
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => openEarthCamEvidence(item)}
                                aria-label="Open EarthCam reference"
                                disabled={saving}
                              >
                                <ExternalLink className="size-3.5" />
                              </Button>
                            )}
                            {canCapture && (
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => handleDeleteEvidence(item.id)}
                                aria-label="Delete EarthCam reference"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.evidence.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          No EarthCam evidence saved
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleSaveCamera} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{cameraForm.id ? 'Edit Camera' : 'Add Camera'}</DialogTitle>
              <DialogDescription>
                Map an EarthCam camera to this project and define how RailCommand should reference its live view.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={cameraForm.name} onChange={(e) => setCameraForm((c) => ({ ...c, name: e.target.value }))} placeholder="Camera name" />
              <Input value={cameraForm.earthcamCameraId} onChange={(e) => setCameraForm((c) => ({ ...c, earthcamCameraId: e.target.value }))} placeholder="EarthCam ID" />
              <Input value={cameraForm.locationLabel} onChange={(e) => setCameraForm((c) => ({ ...c, locationLabel: e.target.value }))} placeholder="Location" />
              <Input value={cameraForm.railArea} onChange={(e) => setCameraForm((c) => ({ ...c, railArea: e.target.value }))} placeholder="Rail area" />
              <Input value={cameraForm.liveEmbedUrl} onChange={(e) => setCameraForm((c) => ({ ...c, liveEmbedUrl: e.target.value }))} placeholder="Embed URL" />
              <Input value={cameraForm.liveStreamUrl} onChange={(e) => setCameraForm((c) => ({ ...c, liveStreamUrl: e.target.value }))} placeholder="Live URL" />
              <Input className="sm:col-span-2" value={cameraForm.thumbnailUrl} onChange={(e) => setCameraForm((c) => ({ ...c, thumbnailUrl: e.target.value }))} placeholder="Thumbnail URL" />
              <Select value={cameraForm.status} onValueChange={(value) => setCameraForm((c) => ({ ...c, status: value as EarthCamCameraStatus }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 rounded-md border border-rc-border px-3 py-2 text-sm">
                <input type="checkbox" checked={cameraForm.ptzEnabled} onChange={(e) => setCameraForm((c) => ({ ...c, ptzEnabled: e.target.checked }))} className="size-4 accent-rc-orange" />
                PTZ enabled
              </label>
            </div>
            <DialogFooter>
              {cameraForm.id && (
                <Button type="button" variant="ghost" className="mr-auto text-muted-foreground hover:text-red-600" onClick={() => {
                  const camera = data.cameras.find((item) => item.id === cameraForm.id);
                  if (camera) {
                    setCameraOpen(false);
                    handleDeleteCamera(camera);
                  }
                }}>
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setCameraOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-rc-orange text-white hover:bg-rc-orange-dark">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={(event) => { event.preventDefault(); saveEvidence(evidenceForm); }} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{evidenceForm.evidenceType === 'clip' ? 'Add Clip' : 'Add Snapshot'}</DialogTitle>
              <DialogDescription>
                Save a snapshot or clip reference from EarthCam as project evidence.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Select value={evidenceForm.cameraId} onValueChange={(value) => setEvidenceForm((f) => ({ ...f, cameraId: value }))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Camera" />
                </SelectTrigger>
                <SelectContent>
                  {data.cameras.map((camera) => (
                    <SelectItem key={camera.id} value={camera.id}>{camera.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={evidenceForm.evidenceType} onValueChange={(value) => setEvidenceForm((f) => ({ ...f, evidenceType: value as EarthCamEvidenceType }))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="clip">Clip</SelectItem>
                  <SelectItem value="snapshot">Snapshot</SelectItem>
                </SelectContent>
              </Select>
              <Input className="sm:col-span-2" value={evidenceForm.title} onChange={(e) => setEvidenceForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" />
              <Input type="datetime-local" value={evidenceForm.capturedAt} onChange={(e) => setEvidenceForm((f) => ({ ...f, capturedAt: e.target.value }))} />
              <Input value={evidenceForm.earthCamAssetId} onChange={(e) => setEvidenceForm((f) => ({ ...f, earthCamAssetId: e.target.value }))} placeholder="Asset ID" />
              {evidenceForm.evidenceType === 'clip' && (
                <>
                  <Input type="datetime-local" value={evidenceForm.startTime} onChange={(e) => setEvidenceForm((f) => ({ ...f, startTime: e.target.value }))} />
                  <Input type="datetime-local" value={evidenceForm.endTime} onChange={(e) => setEvidenceForm((f) => ({ ...f, endTime: e.target.value }))} />
                </>
              )}
              <Input className="sm:col-span-2" value={evidenceForm.earthCamUrl} onChange={(e) => setEvidenceForm((f) => ({ ...f, earthCamUrl: e.target.value }))} placeholder="EarthCam URL" />
              <Textarea className="sm:col-span-2" value={evidenceForm.description} onChange={(e) => setEvidenceForm((f) => ({ ...f, description: e.target.value }))} placeholder="Notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEvidenceOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-rc-orange text-white hover:bg-rc-orange-dark">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
