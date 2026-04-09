'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, Lock, MessageSquare, Paperclip, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import PhotoGallery from '@/components/shared/PhotoGallery';
import PhotoUpload, { type PhotoFile } from '@/components/shared/PhotoUpload';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { getProfiles, getOrganizations, getMilestones, updateRFIStatus as storeUpdateRFIStatus, addRFIResponse as storeAddRFIResponse, updateRFI as storeUpdateRFI, deleteRFI as storeDeleteRFI } from '@/lib/store';
import { useRFIDetail, useProjectMembers } from '@/hooks/useData';
import { useProject } from '@/components/providers/ProjectProvider';
import { updateRFIStatus as serverUpdateRFIStatus, addRFIResponse as serverAddRFIResponse, updateRFI as serverUpdateRFI, deleteRFI as serverDeleteRFI } from '@/lib/actions/rfis';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import { getAttachmentsWithSignedUrls } from '@/lib/actions/attachments';
import type { Attachment, Priority } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PRIORITIES: { label: string; value: Priority }[] = [
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const nativeSelectClasses =
  'border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm';

function getProfile(id: string) {
  return getProfiles().find((p) => p.id === id);
}
function getOrg(orgId: string) {
  return getOrganizations().find((o) => o.id === orgId);
}
function getMilestoneById(id: string | null, projectId: string) {
  return id ? getMilestones(projectId).find((m) => m.id === id) : null;
}

export default function RFIDetailPage({ params, searchParams }: { params: Promise<{ id: string; rfiId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId, rfiId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { can } = usePermissions(projectId);
  const { isDemo } = useProject();
  const { data: members } = useProjectMembers(projectId);
  const [newResponse, setNewResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [newPhotos, setNewPhotos] = useState<PhotoFile[]>([]);

  const { data: rfi, loading, refetch } = useRFIDetail(projectId, rfiId);
  const [status, setStatus] = useState(rfi?.status ?? 'open');

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editQuestion, setEditQuestion] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Resolve signed URLs for attachments in private buckets
  const [signedAttachments, setSignedAttachments] = useState<Attachment[]>([]);
  const resolveSignedUrls = useCallback(async () => {
    if (isDemo || !rfi) return;
    const result = await getAttachmentsWithSignedUrls('rfi', rfi.id);
    if (result.data) setSignedAttachments(result.data);
  }, [isDemo, rfi]);
  useEffect(() => { resolveSignedUrls(); }, [resolveSignedUrls]);
  const rfiAttachments = isDemo ? (rfi?.attachments ?? []) : signedAttachments;

  // Compute overdue days client-side only to avoid server/client Date mismatch
  const [overdueDays, setOverdueDays] = useState(0);
  useEffect(() => {
    if (rfi && (rfi.status === 'overdue' || status === 'overdue')) {
      setOverdueDays(differenceInCalendarDays(new Date(), parseISO(rfi.due_date)));
    }
  }, [rfi, status]);

  const assignableProfiles = members.length > 0 && members.some((m) => m.profile)
    ? members.map((m) => m.profile!).filter(Boolean)
    : getProfiles();

  // Reset state when navigating to a different RFI
  const [prevRfiId, setPrevRfiId] = useState(rfiId);
  if (rfiId !== prevRfiId) {
    setPrevRfiId(rfiId);
    setStatus(rfi?.status ?? 'open');
    setNewResponse('');
    setSubmitted(false);
  }

  // Sync status when rfi data loads/changes
  const [prevRfiStatus, setPrevRfiStatus] = useState(rfi?.status);
  if (rfi?.status && rfi.status !== prevRfiStatus) {
    setPrevRfiStatus(rfi.status);
    setStatus(rfi.status);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!rfi) return <p className="p-8 text-muted-foreground">RFI not found.</p>;

  const submitter = (rfi as any).submitted_by_profile ?? getProfile(rfi.submitted_by);
  const assignee = (rfi as any).assigned_to_profile ?? getProfile(rfi.assigned_to);
  const milestone = (rfi as any).milestone ?? getMilestoneById(rfi.milestone_id, projectId);
  const isOverdue = status === 'overdue';
  const canRespond = status === 'open' || status === 'overdue';
  const basePath = `/projects/${projectId}/rfis`;

  const handleSubmitResponse = async () => {
    if (!newResponse.trim()) return;
    if (isDemo) {
      storeAddRFIResponse(rfiId, newResponse);
      refetch();
    } else {
      const result = await serverAddRFIResponse(projectId, rfiId, newResponse, false);
      if (result.error) return;
      refetch();
    }
    setSubmitted(true);
    setNewResponse('');
  };

  const handleStatusChange = async (newStatus: 'answered' | 'closed') => {
    if (isDemo) {
      storeUpdateRFIStatus(rfiId, newStatus);
      refetch();
    } else {
      const result = await serverUpdateRFIStatus(projectId, rfiId, newStatus);
      if (result.error) return;
      refetch();
    }
    setStatus(newStatus);
  };

  function openEditDialog() {
    if (!rfi) return;
    setEditSubject(rfi.subject);
    setEditQuestion(rfi.question);
    setEditPriority(rfi.priority);
    setEditAssignedTo(rfi.assigned_to);
    setEditDueDate(rfi.due_date ? rfi.due_date.split('T')[0] : '');
    setEditOpen(true);
  }

  async function handleEditSave() {
    setSaving(true);
    const data = {
      subject: editSubject,
      question: editQuestion,
      priority: editPriority,
      assigned_to: editAssignedTo,
      due_date: editDueDate,
    };
    if (isDemo) {
      storeUpdateRFI(rfiId, data);
      refetch();
    } else {
      const result = await serverUpdateRFI(projectId, rfiId, data);
      if (result.error) { setSaving(false); return; }
      refetch();
    }
    setSaving(false);
    setEditOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    if (isDemo) {
      storeDeleteRFI(rfiId);
    } else {
      const result = await serverDeleteRFI(projectId, rfiId);
      if (result.error) { setDeleting(false); return; }
    }
    router.push(`/projects/${projectId}/rfis`);
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'RFIs', href: basePath },
        { label: rfi.number },
      ]} />

      {/* Overdue banner */}
      {isOverdue && (
        <div className="flex items-center gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="text-sm font-medium" suppressHydrationWarning>
            This RFI is {overdueDays} days overdue. Response was due {format(parseISO(rfi.due_date), 'MMM d, yyyy')}.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-bold sm:text-2xl">{rfi.number}</h1>
            <StatusBadge status={status} type="rfi" />
            <PriorityBadge priority={rfi.priority} />
          </div>
          <p className="text-muted-foreground text-sm sm:text-base">{rfi.subject}</p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {can(ACTIONS.RFI_CREATE) && (
            <>
              <Button variant="outline" size="sm" onClick={openEditDialog}>
                <Pencil className="size-4 mr-1" />Edit
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4 mr-1" />Delete
              </Button>
            </>
          )}
          {canRespond && can(ACTIONS.RFI_CLOSE) && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleStatusChange('answered')}>
                <CheckCircle2 className="mr-1.5 size-4" />Answered
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleStatusChange('closed')}>
                <Lock className="mr-1.5 size-4" />Close
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Submitted By', value: submitter?.full_name ?? '—' },
          { label: 'Assigned To', value: assignee?.full_name ?? '—' },
          { label: 'Submit Date', value: format(parseISO(rfi.submit_date), 'MMM d, yyyy') },
          { label: 'Due Date', value: format(parseISO(rfi.due_date), 'MMM d, yyyy') },
          { label: 'Priority', value: rfi.priority },
          { label: 'Milestone', value: milestone?.name ?? 'None' },
        ].map((item) => (
          <div key={item.label} className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
            <p className="text-sm font-medium truncate">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Question */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Question</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{rfi.question}</p>
        </CardContent>
      </Card>

      {/* Attachments & Photos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="size-4" /> Attachments ({rfiAttachments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {rfiAttachments.length > 0 ? (
            <PhotoGallery attachments={rfiAttachments} />
          ) : (
            <p className="text-sm text-muted-foreground">No attachments yet.</p>
          )}
          {can(ACTIONS.RFI_CREATE) && (
            <div className="pt-2">
              <PhotoUpload
                photos={newPhotos}
                onPhotosChange={setNewPhotos}
                entityType="rfi"
                entityId={rfiId}
                projectId={projectId}
                onUploadComplete={() => refetch()}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Responses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4" />Responses ({rfi.responses?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(!rfi.responses || rfi.responses.length === 0) && (
            <p className="text-sm text-muted-foreground py-4 text-center">No responses yet.</p>
          )}
          {rfi.responses?.map((resp) => {
            const author = (resp as any).author ?? getProfile(resp.author_id);
            const org = author ? getOrg(author.organization_id) : null;
            return (
              <div
                key={resp.id}
                className={`rounded-lg border p-4 space-y-2 ${
                  resp.is_official_response
                    ? 'border-rc-emerald/40 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : 'border-rc-border bg-rc-card'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{author?.full_name ?? 'Unknown'}</span>
                  {org && <span className="text-xs text-muted-foreground">{org.name}</span>}
                  <span className="text-xs text-muted-foreground">{format(parseISO(resp.created_at), 'MMM d, yyyy')}</span>
                  {resp.is_official_response && (
                    <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">Official Response</Badge>
                  )}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{resp.content}</p>
              </div>
            );
          })}

          {/* Add response */}
          {canRespond && !submitted && can(ACTIONS.RFI_RESPOND) && (
            <div className="pt-4 border-t border-rc-border space-y-3">
              <Textarea
                placeholder="Write a response..."
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                rows={3}
              />
              <Button onClick={handleSubmitResponse} className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto">
                Submit Response
              </Button>
            </div>
          )}
          {submitted && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-800 text-sm dark:bg-emerald-950/30 dark:text-emerald-300">
              Response submitted successfully.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit RFI</DialogTitle>
            <DialogDescription>Update the details for {rfi.number}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Question</label>
              <Textarea value={editQuestion} onChange={(e) => setEditQuestion(e.target.value)} rows={3} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value as Priority)}
                  className={nativeSelectClasses + ' mt-1'}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Assigned To</label>
                <select
                  value={editAssignedTo}
                  onChange={(e) => setEditAssignedTo(e.target.value)}
                  className={nativeSelectClasses + ' mt-1'}
                >
                  <option value="">Select team member</option>
                  {assignableProfiles.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
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
            <DialogTitle>Delete RFI</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {rfi.number}? This will also delete all responses. This action cannot be undone.
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
