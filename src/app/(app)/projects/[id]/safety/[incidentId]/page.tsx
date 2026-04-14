'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import PhotoGallery from '@/components/shared/PhotoGallery';
import PhotoUpload, { type PhotoFile } from '@/components/shared/PhotoUpload';
import { useProject } from '@/components/providers/ProjectProvider';
import { useSafetyIncidentDetail } from '@/hooks/useData';
import { updateSafetyIncident, deleteSafetyIncident } from '@/lib/actions/safety';
import { getAttachmentsWithSignedUrls } from '@/lib/actions/attachments';
import { SEVERITY_COLORS, INCIDENT_TYPE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { IncidentStatus } from '@/lib/types';

const STATUS_OPTIONS: { label: string; value: IncidentStatus }[] = [
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

export default function SafetyIncidentDetailPage({ params, searchParams }: { params: Promise<{ id: string; incidentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId, incidentId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { isDemo } = useProject();
  const { data: incident, loading, refetch } = useSafetyIncidentDetail(projectId, incidentId);

  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [savingInvestigation, setSavingInvestigation] = useState(false);
  const [investigationSaved, setInvestigationSaved] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [newPhotos, setNewPhotos] = useState<PhotoFile[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Signed attachments state
  const demoAttachments = incident?.attachments ?? [];
  const [signedAttachments, setSignedAttachments] = useState<typeof demoAttachments>([]);

  const resolveSignedUrls = useCallback(async () => {
    if (isDemo || !incident) return;
    const result = await getAttachmentsWithSignedUrls('safety_incident', incident.id);
    if (result.data) setSignedAttachments(result.data);
  }, [isDemo, incident]);

  useEffect(() => { resolveSignedUrls(); }, [resolveSignedUrls]);

  const existingAttachments = isDemo ? demoAttachments : signedAttachments;

  // Sync state when incident loads
  useEffect(() => {
    if (incident) {
      setRootCause(incident.root_cause ?? '');
      setCorrectiveAction(incident.corrective_action ?? '');
    }
  }, [incident]);

  async function handleSaveInvestigation() {
    setSavingInvestigation(true);
    setErrorMsg(null);
    const result = await updateSafetyIncident(incidentId, projectId, {
      root_cause: rootCause,
      corrective_action: correctiveAction,
    });
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setInvestigationSaved(true);
      setTimeout(() => setInvestigationSaved(false), 2000);
      refetch();
    }
    setSavingInvestigation(false);
  }

  async function handleStatusChange(newStatus: IncidentStatus) {
    setStatusUpdating(true);
    setErrorMsg(null);
    const result = await updateSafetyIncident(incidentId, projectId, { status: newStatus });
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      refetch();
    }
    setStatusUpdating(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteSafetyIncident(incidentId, projectId);
    if (result.error) {
      setErrorMsg(result.error);
      setDeleting(false);
      return;
    }
    router.push(`/projects/${projectId}/safety`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Safety', href: `/projects/${projectId}/safety` }]} />
        <p className="py-20 text-center text-muted-foreground">Incident not found.</p>
      </div>
    );
  }

  const basePath = `/projects/${projectId}/safety`;

  const info = [
    { label: 'Type', value: INCIDENT_TYPE_LABELS[incident.incident_type] ?? incident.incident_type },
    { label: 'Severity', value: incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1) },
    { label: 'Date', value: format(parseISO(incident.incident_date), 'MMM d, yyyy') },
    { label: 'Location', value: incident.location || '\u2014' },
    { label: 'Reported By', value: incident.reported_by_profile?.full_name ?? '\u2014' },
    { label: 'Created', value: format(parseISO(incident.created_at), 'MMM d, yyyy') },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Safety', href: basePath },
        { label: incident.number },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to Safety
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold md:text-2xl">
            <span className="text-rc-blue">{incident.number}</span> &mdash; {incident.title}
          </h1>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <StatusBadge status={incident.status} type="safety" />
          <Badge variant="secondary" className={cn('border-0 font-medium', SEVERITY_COLORS[incident.severity])}>
            {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)}
          </Badge>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4 mr-1" />Delete
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Info grid */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {info.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-sm font-medium">{f.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Description */}
      {incident.description && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{incident.description}</CardContent>
        </Card>
      )}

      {/* Personnel Involved */}
      {incident.personnel_involved && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Personnel Involved</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{incident.personnel_involved}</CardContent>
        </Card>
      )}

      {/* Status Actions */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={incident.status}
              onValueChange={(v) => handleStatusChange(v as IncidentStatus)}
              disabled={statusUpdating}
            >
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusUpdating && (
              <span className="text-sm text-muted-foreground">Updating...</span>
            )}
            {incident.status === 'closed' && (
              <div className="flex items-center gap-2 text-rc-emerald">
                <CheckCircle2 className="size-5" />
                <span className="text-sm font-medium">Incident closed</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Investigation */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Investigation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Root Cause</label>
            <Textarea
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="What was the root cause of this incident?"
              rows={3}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Corrective Action</label>
            <Textarea
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              placeholder="What corrective actions are being taken?"
              rows={3}
              className="mt-1"
            />
          </div>
          <Button
            onClick={handleSaveInvestigation}
            disabled={savingInvestigation}
            className="bg-rc-orange hover:bg-rc-orange-dark text-white"
          >
            {investigationSaved ? 'Saved!' : savingInvestigation ? 'Saving...' : 'Save Investigation'}
          </Button>
        </CardContent>
      </Card>

      {/* Photos */}
      <PhotoGallery attachments={existingAttachments} />

      {/* Add more photos */}
      <PhotoUpload
        photos={newPhotos}
        entityType="safety_incident"
        entityId={incidentId}
        projectId={projectId}
        onUploadComplete={() => { refetch(); resolveSignedUrls(); }}
        onPhotosChange={setNewPhotos}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Safety Incident</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {incident.number}? This action cannot be undone. All associated photos and attachments will also be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
