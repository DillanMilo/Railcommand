'use client';

import { FormEvent, use, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Video,
} from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useEarthCamEmbeds } from '@/hooks/useData';
import { ACTIONS } from '@/lib/permissions';
import * as store from '@/lib/store';
import { extractEarthCamEmbedUrl } from '@/lib/earthcam/embed';
import type { EarthCamEmbed } from '@/lib/types';
import {
  deleteEarthCamEmbed as serverDeleteEarthCamEmbed,
  saveEarthCamEmbed as serverSaveEarthCamEmbed,
} from '@/lib/actions/earthcam';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type EmbedForm = {
  id: string;
  label: string;
  embedInput: string;
};

const emptyForm: EmbedForm = {
  id: '',
  label: '',
  embedInput: '',
};

const samplePlaceholder =
  'https://share.earthcam.net/tJ90CoLmq7TzrY396Yd88CKvRQt1vEA9ny7MYZgQXUg';

function EarthCamFrame({ embed }: { embed: EarthCamEmbed }) {
  return (
    <div className="overflow-hidden rounded-lg border border-rc-border bg-black">
      <div className="aspect-video w-full">
        <iframe
          src={embed.url}
          title={embed.label}
          className="h-full w-full"
          sandbox="allow-forms allow-popups allow-presentation allow-same-origin allow-scripts"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
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
  const { data: embeds, loading, error, refetch } = useEarthCamEmbeds(projectId);

  const canView = can(ACTIONS.EARTHCAM_VIEW);
  const canManage = can(ACTIONS.EARTHCAM_MANAGE);

  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<EmbedForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EarthCamEmbed | null>(null);

  function openForm(embed?: EarthCamEmbed) {
    setFormError('');
    setForm(
      embed
        ? {
            id: embed.id,
            label: embed.label,
            embedInput: embed.url,
          }
        : emptyForm
    );
    setFormOpen(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;

    setFormError('');
    let normalizedUrl = '';
    try {
      normalizedUrl = extractEarthCamEmbedUrl(form.embedInput).url;
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Invalid EarthCam embed URL.');
      return;
    }

    const label = form.label.trim() || 'EarthCam Feed';
    setSaving(true);
    try {
      if (isDemo) {
        if (form.id) {
          store.updateEarthCamEmbed(form.id, { label, url: normalizedUrl });
        } else {
          store.addEarthCamEmbed(projectId, { label, url: normalizedUrl });
        }
      } else {
        const result = await serverSaveEarthCamEmbed(projectId, {
          id: form.id || undefined,
          label,
          embedInput: normalizedUrl,
        });
        if (result.error) {
          setFormError(result.error);
          return;
        }
      }
      setFormOpen(false);
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(embed: EarthCamEmbed) {
    if (!canManage) return;
    setSaving(true);
    try {
      if (isDemo) {
        store.deleteEarthCamEmbed(embed.id);
      } else {
        const result = await serverDeleteEarthCamEmbed(projectId, embed.id);
        if (result.error) {
          alert(result.error);
          return;
        }
      }
      refetch();
      setDeleteTarget(null);
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

  if (!canView) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Cameras' }]} />
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <AlertTriangle className="size-4 text-amber-500" />
            You do not have permission to view project cameras.
          </CardContent>
        </Card>
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
            <Badge variant="secondary" className="text-xs">Beta</Badge>
            <Badge variant="outline" className="text-xs">{embeds.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Live EarthCam feeds stream from EarthCam. RailCommand only stores the project embed link.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => openForm()} className="bg-rc-orange text-white hover:bg-rc-orange-dark">
            <Plus className="size-4" />
            Add EarthCam Feed
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {embeds.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-rc-orange/10 text-rc-orange">
              <Video className="size-6" />
            </div>
            <div className="max-w-xl space-y-2">
              <h2 className="font-heading text-lg font-semibold">Add an EarthCam feed</h2>
              <p className="text-sm text-muted-foreground">
                Paste the EarthCam share link or Broadway Media Player embed code generated from the customer&apos;s EarthCam project. A setup PDF link can be added here once EarthCam provides the final instructions.
              </p>
            </div>
            {canManage && (
              <Button onClick={() => openForm()} className="bg-rc-orange text-white hover:bg-rc-orange-dark">
                <Plus className="size-4" />
                Add EarthCam Feed
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {embeds.map((embed) => (
            <Card key={embed.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{embed.label}</CardTitle>
                    <CardDescription className="truncate">
                      {new URL(embed.url).hostname}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => window.open(embed.url, '_blank', 'noopener,noreferrer')}
                      aria-label={`Open ${embed.label} in EarthCam`}
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => openForm(embed)}
                          aria-label={`Rename ${embed.label}`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDeleteTarget(embed)}
                          aria-label={`Remove ${embed.label}`}
                          disabled={saving}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <EarthCamFrame embed={embed} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{form.id ? 'Edit EarthCam Feed' : 'Add EarthCam Feed'}</DialogTitle>
              <DialogDescription>
                Paste the EarthCam share URL or full Broadway Media Player embed code. RailCommand stores only the URL reference.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                Label
                <Input
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                  placeholder="North Yard Camera"
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                EarthCam share URL or embed code
                <Textarea
                  value={form.embedInput}
                  onChange={(event) => setForm((current) => ({ ...current, embedInput: event.target.value }))}
                  placeholder={samplePlaceholder}
                  className="min-h-28 font-mono text-xs"
                />
              </label>
              {formError && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="bg-rc-orange text-white hover:bg-rc-orange-dark">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Video className="size-4" />}
                Save Feed
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove EarthCam Feed?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `This removes ${deleteTarget.label} from this project. RailCommand does not delete or modify anything in EarthCam.`
                : 'This removes the EarthCam feed from this project.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={saving}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Remove Feed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
