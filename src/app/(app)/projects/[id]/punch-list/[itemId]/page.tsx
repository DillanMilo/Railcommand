'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, CheckCircle2, Play, RotateCcw, ShieldCheck, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import PhotoGallery from '@/components/shared/PhotoGallery';
import PhotoUpload, { type PhotoFile } from '@/components/shared/PhotoUpload';
import { getProfiles, updatePunchListStatus as storeUpdatePunchListStatus, updatePunchListItem as storeUpdatePunchListItem, deletePunchListItem as storeDeletePunchListItem, getAttachments } from '@/lib/store';
import { usePunchListDetail, useProjectMembers } from '@/hooks/useData';
import { useProject } from '@/components/providers/ProjectProvider';
import { updatePunchListStatus as serverUpdatePunchListStatus, updatePunchListItem as serverUpdatePunchListItem, deletePunchListItem as serverDeletePunchListItem } from '@/lib/actions/punch-list';
import { getAttachmentsWithSignedUrls } from '@/lib/actions/attachments';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import type { PunchListStatus, Priority } from '@/lib/types';

const PRIORITIES: { label: string; value: Priority }[] = [
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

function getName(id: string, profileName?: string) {
  if (profileName) return profileName;
  return getProfiles().find((p) => p.id === id)?.full_name ?? '—';
}

export default function PunchListDetailPage({ params, searchParams }: { params: Promise<{ id: string; itemId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId, itemId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { can } = usePermissions(projectId);
  const { isDemo } = useProject();
  const { data: item, loading, refetch } = usePunchListDetail(projectId, itemId);
  const { data: members } = useProjectMembers(projectId);
  const [status, setStatus] = useState<PunchListStatus>('open');
  const [notes, setNotes] = useState('');
  const [resolutionInput, setResolutionInput] = useState('');
  const [newPhotos, setNewPhotos] = useState<PhotoFile[]>([]);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const assignableProfiles = members.length > 0 && members.some((m) => m.profile)
    ? members.map((m) => m.profile!).filter(Boolean)
    : getProfiles();

  // Sync state when item loads
  useEffect(() => {
    if (item) {
      setStatus(item.status);
      setNotes(item.resolution_notes ?? '');
    }
  }, [item]);

  // Reset transient state when navigating to a different item
  useEffect(() => {
    setResolutionInput('');
    setNewPhotos([]);
  }, [itemId]);
  const demoAttachments = item?.attachments ?? (item ? getAttachments('punch_list', item.id) : []);
  const [signedAttachments, setSignedAttachments] = useState<typeof demoAttachments>(demoAttachments);

  const resolveSignedUrls = useCallback(async () => {
    if (isDemo || !item) return;
    const result = await getAttachmentsWithSignedUrls('punch_list', item.id);
    if (result.data) setSignedAttachments(result.data);
  }, [isDemo, item]);

  useEffect(() => { resolveSignedUrls(); }, [resolveSignedUrls]);

  const existingAttachments = isDemo ? demoAttachments : signedAttachments;

  function openEditDialog() {
    if (!item) return;
    setEditTitle(item.title);
    setEditDescription(item.description ?? '');
    setEditLocation(item.location ?? '');
    setEditPriority(item.priority);
    setEditAssignedTo(item.assigned_to);
    setEditDueDate(item.due_date ? item.due_date.split('T')[0] : '');
    setEditOpen(true);
  }

  async function handleEditSave() {
    setSaving(true);
    const data = {
      title: editTitle,
      description: editDescription,
      location: editLocation,
      priority: editPriority,
      assigned_to: editAssignedTo,
      due_date: editDueDate,
    };
    if (isDemo) {
      storeUpdatePunchListItem(itemId, data);
      refetch();
    } else {
      const result = await serverUpdatePunchListItem(projectId, itemId, data);
      if (result.error) { setSaving(false); return; }
      refetch();
    }
    setSaving(false);
    setEditOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    if (isDemo) {
      storeDeletePunchListItem(itemId);
    } else {
      const result = await serverDeletePunchListItem(projectId, itemId);
      if (result.error) { setDeleting(false); return; }
    }
    router.push(`/projects/${projectId}/punch-list`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Punch List', href: `/projects/${projectId}/punch-list` }]} />
        <p className="py-20 text-center text-muted-foreground">Item not found.</p>
      </div>
    );
  }

  const basePath = `/projects/${projectId}/punch-list`;

  async function handleStatusChange(newStatus: PunchListStatus, resolutionNotes?: string) {
    setStatus(newStatus);
    if (resolutionNotes !== undefined) setNotes(resolutionNotes);
    if (isDemo) {
      storeUpdatePunchListStatus(itemId, newStatus, resolutionNotes);
      refetch();
    } else {
      const result = await serverUpdatePunchListStatus(projectId, itemId, newStatus, resolutionNotes);
      if (result.error) { /* revert on error */ setStatus(item?.status ?? 'open'); setNotes(item?.resolution_notes ?? ''); return; }
      refetch();
    }
  }

  function handleStart() { handleStatusChange('in_progress'); }
  function handleResolve() { const n = resolutionInput || 'Resolved.'; handleStatusChange('resolved', n); }
  function handleVerify() { handleStatusChange('verified'); }
  function handleReopen() { setResolutionInput(''); handleStatusChange('open', ''); }

  const info = [
    { label: 'Location', value: item.location },
    { label: 'Assigned To', value: getName(item.assigned_to, item.assigned_to_profile?.full_name) },
    { label: 'Created By', value: getName(item.created_by, item.created_by_profile?.full_name) },
    { label: 'Due Date', value: format(parseISO(item.due_date), 'MMM d, yyyy') },
    { label: 'Created', value: format(parseISO(item.created_at), 'MMM d, yyyy') },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Punch List', href: basePath },
        { label: item.number },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to Punch List
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold md:text-2xl">
            <span className="text-rc-blue">{item.number}</span> &mdash; {item.title}
          </h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <StatusBadge status={status} type="punch_list" />
          <PriorityBadge priority={item.priority} />
          {can(ACTIONS.PUNCH_LIST_CREATE) && (
            <>
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Pencil className="size-4 mr-1" />Edit
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4 mr-1" />Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info grid */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
          {info.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-sm font-medium">{f.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">{item.description}</CardContent>
      </Card>

      {/* Resolution workflow */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Resolution</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {status === 'open' && can(ACTIONS.PUNCH_LIST_RESOLVE) && (
            <Button onClick={handleStart} className="bg-rc-blue hover:bg-rc-blue/90 text-white">
              <Play className="mr-2 size-4" />Start Work
            </Button>
          )}
          {status === 'in_progress' && can(ACTIONS.PUNCH_LIST_RESOLVE) && (
            <>
              <Textarea placeholder="Resolution notes..." value={resolutionInput} onChange={(e) => setResolutionInput(e.target.value)} rows={3} />
              <Button onClick={handleResolve} className="bg-rc-emerald hover:bg-rc-emerald/90 text-white">
                <CheckCircle2 className="mr-2 size-4" />Mark Resolved
              </Button>
            </>
          )}
          {status === 'resolved' && (
            <div className="space-y-3">
              {notes && <p className="rounded-md bg-muted p-3 text-sm">{notes}</p>}
              <div className="flex flex-wrap gap-2">
                {can(ACTIONS.PUNCH_LIST_VERIFY) && (
                  <Button onClick={handleVerify} className="bg-rc-emerald hover:bg-rc-emerald/90 text-white">
                    <ShieldCheck className="mr-2 size-4" />Verify
                  </Button>
                )}
                {can(ACTIONS.PUNCH_LIST_RESOLVE) && (
                  <Button variant="outline" onClick={handleReopen}>
                    <RotateCcw className="mr-2 size-4" />Reopen
                  </Button>
                )}
              </div>
            </div>
          )}
          {status === 'verified' && (
            <div className="flex items-center gap-2 text-rc-emerald">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-medium">Verified and closed</span>
            </div>
          )}
          {notes && status !== 'resolved' && status !== 'in_progress' && status !== 'open' && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Resolution Notes</p>
              <p className="rounded-md bg-muted p-3 text-sm">{notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Geo-tag display */}
      {item.geo_tag && (
        <Card>
          <CardContent className="flex items-center gap-2 p-4">
            <MapPin className="size-4 text-rc-emerald shrink-0" />
            <div>
              <p className="text-sm font-medium text-rc-emerald">GPS Location Tagged</p>
              <p className="text-xs text-muted-foreground">
                {item.geo_tag.lat.toFixed(6)}, {item.geo_tag.lng.toFixed(6)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      <PhotoGallery attachments={existingAttachments} />

      {/* Add more photos */}
      {(can(ACTIONS.PUNCH_LIST_RESOLVE) || can(ACTIONS.PUNCH_LIST_CREATE)) && (
        <PhotoUpload
          photos={newPhotos}
          entityType="punch_list"
          entityId={itemId}
          projectId={projectId}
          onUploadComplete={() => refetch()}
          onPhotosChange={setNewPhotos}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Punch List Item</DialogTitle>
            <DialogDescription>Update the details for {item.number}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Priority</label>
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v as Priority)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Assigned To</label>
                <Select value={editAssignedTo} onValueChange={setEditAssignedTo}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {assignableProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Due Date</label>
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Punch List Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {item.number}? This action cannot be undone. All associated photos and attachments will also be deleted.
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
