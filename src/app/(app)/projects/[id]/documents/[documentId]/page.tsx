'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectDocumentDetail, useMilestones } from '@/hooks/useData';
import { ACTIONS } from '@/lib/permissions';
import { updateProjectDocument as storeUpdateDocument, deleteProjectDocument as storeDeleteDocument } from '@/lib/store';
import { updateProjectDocument, deleteProjectDocument } from '@/lib/actions/documents';
import { DOCUMENT_STATUS_COLORS, DOCUMENT_STATUS_LABELS, DOCUMENT_CATEGORY_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { DocumentStatus } from '@/lib/types';

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Status transitions: draft -> issued -> under_review -> approved -> superseded
const STATUS_TRANSITIONS: Record<DocumentStatus, { label: string; next: DocumentStatus }[]> = {
  draft: [{ label: 'Issue', next: 'issued' }],
  issued: [{ label: 'Send for Review', next: 'under_review' }],
  under_review: [{ label: 'Approve', next: 'approved' }],
  approved: [{ label: 'Supersede', next: 'superseded' }],
  superseded: [],
};

export default function DocumentDetailPage({ params, searchParams }: { params: Promise<{ id: string; documentId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId, documentId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { isDemo } = useProject();
  const { can } = usePermissions(projectId);
  const { data: doc, loading, refetch } = useProjectDocumentDetail(projectId, documentId);
  const { data: milestones } = useMilestones(projectId);

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const basePath = `/projects/${projectId}/documents`;

  async function handleStatusChange(newStatus: DocumentStatus) {
    setStatusUpdating(true);
    setErrorMsg(null);

    if (isDemo) {
      storeUpdateDocument(documentId, { status: newStatus });
      refetch();
      setStatusUpdating(false);
      return;
    }

    const result = await updateProjectDocument(projectId, documentId, { status: newStatus });
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      refetch();
    }
    setStatusUpdating(false);
  }

  async function handleDelete() {
    setDeleting(true);

    if (isDemo) {
      storeDeleteDocument(documentId);
      router.push(basePath);
      return;
    }

    const result = await deleteProjectDocument(projectId, documentId);
    if (result.error) {
      setErrorMsg(result.error);
      setDeleting(false);
      return;
    }
    router.push(basePath);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Documents', href: basePath }]} />
        <p className="py-20 text-center text-muted-foreground">Document not found.</p>
      </div>
    );
  }

  const transitions = STATUS_TRANSITIONS[doc.status] ?? [];
  const linkedMilestone = milestones.find((ms) => ms.id === doc.linked_milestone_id);

  const info = [
    { label: 'Category', value: DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category },
    { label: 'Revision', value: doc.revision },
    { label: 'Revision Date', value: doc.revision_date ? format(parseISO(doc.revision_date), 'MMM d, yyyy') : '\u2014' },
    { label: 'Uploaded By', value: doc.uploaded_by_profile?.full_name ?? '\u2014' },
    { label: 'Created', value: format(parseISO(doc.created_at), 'MMM d, yyyy') },
    { label: 'File Size', value: formatFileSize(doc.file_size) },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Documents', href: basePath },
        { label: doc.number },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to Documents
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold md:text-2xl">
            <span className="text-rc-blue">{doc.number}</span> &mdash; {doc.title}
          </h1>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Badge variant="secondary" className={cn('border-0 font-medium', DOCUMENT_STATUS_COLORS[doc.status])}>
            {DOCUMENT_STATUS_LABELS[doc.status] ?? doc.status}
          </Badge>
          <Badge variant="outline" className="text-xs font-medium">
            {DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
          </Badge>
          <span className="text-sm text-muted-foreground self-center">{doc.revision}</span>
          {can(ACTIONS.DOCUMENT_MANAGE) && (
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4 mr-1" />Delete
            </Button>
          )}
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
      {doc.description && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{doc.description}</CardContent>
        </Card>
      )}

      {/* File Info */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">File Information</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">File Name</p>
              <p className="text-sm font-medium">{doc.file_name || '\u2014'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">File Size</p>
              <p className="text-sm font-medium">{formatFileSize(doc.file_size)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revision</p>
              <p className="text-sm font-medium">{doc.revision}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revision Date</p>
              <p className="text-sm font-medium">{doc.revision_date ? format(parseISO(doc.revision_date), 'MMM d, yyyy') : '\u2014'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Info */}
      {doc.reviewed_by && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Review Information</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Reviewed By</p>
                <p className="text-sm font-medium">{doc.reviewed_by_profile?.full_name ?? '\u2014'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Review Date</p>
                <p className="text-sm font-medium">{doc.review_date ? format(parseISO(doc.review_date), 'MMM d, yyyy') : '\u2014'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked Milestone */}
      {linkedMilestone && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Linked Milestone</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm font-medium">{linkedMilestone.name}</p>
            {linkedMilestone.description && (
              <p className="text-sm text-muted-foreground mt-1">{linkedMilestone.description}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Status Transitions */}
      {can(ACTIONS.DOCUMENT_MANAGE) && transitions.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Actions</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {transitions.map((t) => (
                <Button
                  key={t.next}
                  onClick={() => handleStatusChange(t.next)}
                  disabled={statusUpdating}
                  className="bg-rc-orange hover:bg-rc-orange-dark text-white"
                >
                  {statusUpdating ? 'Updating...' : t.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {doc.number}? This action cannot be undone.
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
