'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, CheckCircle2, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { useQCQAReportDetail, usePunchListItems } from '@/hooks/useData';
import { usePermissions } from '@/hooks/usePermissions';
import { updateQCQAReport, deleteQCQAReport } from '@/lib/actions/qcqa';
import * as store from '@/lib/store';
import { QCQA_STATUS_COLORS, QCQA_STATUS_LABELS, QCQA_TYPE_LABELS, QCQA_SEVERITY_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ACTIONS } from '@/lib/permissions';
import type { QCQAReportStatus } from '@/lib/types';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-blue-100 text-blue-700',
};

// Status transition map: current status -> allowed next statuses
const STATUS_TRANSITIONS: Record<QCQAReportStatus, { label: string; value: QCQAReportStatus }[]> = {
  draft: [{ label: 'Open', value: 'open' }],
  open: [{ label: 'Submit for Review', value: 'in_review' }],
  in_review: [{ label: 'Close', value: 'closed' }],
  closed: [],
};

export default function QCQAReportDetailPage({ params, searchParams }: { params: Promise<{ id: string; reportId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId, reportId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { isDemo } = useProject();
  const { can } = usePermissions(projectId);
  const { data: report, loading, refetch } = useQCQAReportDetail(projectId, reportId);
  const { data: allPunchItems } = usePunchListItems(projectId);

  const [editFindings, setEditFindings] = useState('');
  const [editCorrectiveAction, setEditCorrectiveAction] = useState('');
  const [savingFindings, setSavingFindings] = useState(false);
  const [findingsSaved, setFindingsSaved] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canEdit = can(ACTIONS.QCQA_CREATE);

  // Sync state when report loads
  useEffect(() => {
    if (report) {
      setEditFindings(report.findings ?? '');
      setEditCorrectiveAction(report.corrective_action ?? '');
    }
  }, [report]);

  async function handleSaveFindings() {
    setSavingFindings(true);
    setErrorMsg(null);

    if (isDemo) {
      store.updateQCQAReport(reportId, {
        findings: editFindings,
        corrective_action: editCorrectiveAction,
      });
      setFindingsSaved(true);
      setTimeout(() => setFindingsSaved(false), 2000);
      refetch();
      setSavingFindings(false);
      return;
    }

    const result = await updateQCQAReport(projectId, reportId, {
      findings: editFindings,
      corrective_action: editCorrectiveAction,
    });
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      setFindingsSaved(true);
      setTimeout(() => setFindingsSaved(false), 2000);
      refetch();
    }
    setSavingFindings(false);
  }

  async function handleStatusChange(newStatus: QCQAReportStatus) {
    setStatusUpdating(true);
    setErrorMsg(null);

    if (isDemo) {
      store.updateQCQAReport(reportId, {
        status: newStatus,
        ...(newStatus === 'closed' ? { closed_by: store.getCurrentUserId(), closed_date: new Date().toISOString() } : {}),
      });
      refetch();
      setStatusUpdating(false);
      return;
    }

    const result = await updateQCQAReport(projectId, reportId, { status: newStatus });
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
      store.deleteQCQAReport(reportId);
      router.push(`/projects/${projectId}/qcqa`);
      return;
    }

    const result = await deleteQCQAReport(projectId, reportId);
    if (result.error) {
      setErrorMsg(result.error);
      setDeleting(false);
      return;
    }
    router.push(`/projects/${projectId}/qcqa`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'QC/QA', href: `/projects/${projectId}/qcqa` }]} />
        <p className="py-20 text-center text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  const basePath = `/projects/${projectId}/qcqa`;
  const transitions = STATUS_TRANSITIONS[report.status] ?? [];

  // Resolve linked punch list items
  const linkedPunchItems = allPunchItems.filter((p) =>
    report.linked_punch_list_ids?.includes(p.id)
  );

  const info = [
    { label: 'Type', value: QCQA_TYPE_LABELS[report.report_type] ?? report.report_type },
    { label: 'Severity', value: QCQA_SEVERITY_LABELS[report.severity] ?? report.severity },
    { label: 'Spec Reference', value: report.spec_reference || '\u2014' },
    { label: 'Location', value: report.location || '\u2014' },
    { label: 'Inspector', value: report.inspector_profile?.full_name ?? '\u2014' },
    { label: 'Created', value: format(parseISO(report.created_at), 'MMM d, yyyy') },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'QC/QA', href: basePath },
        { label: report.number },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to QC/QA
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold md:text-2xl">
            <span className="text-rc-blue">{report.number}</span> &mdash; {report.title}
          </h1>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Badge variant="secondary" className={cn('border-0 font-medium text-xs', QCQA_STATUS_COLORS[report.status])}>
            {QCQA_STATUS_LABELS[report.status] ?? report.status}
          </Badge>
          <Badge variant="secondary" className={cn('border-0 font-medium', SEVERITY_COLORS[report.severity])}>
            {QCQA_SEVERITY_LABELS[report.severity] ?? report.severity}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {QCQA_TYPE_LABELS[report.report_type] ?? report.report_type}
          </Badge>
          {report.is_nonconformance && (
            <Badge variant="destructive" className="text-xs">NCR</Badge>
          )}
          {canEdit && (
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
      {report.description && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Description</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{report.description}</CardContent>
        </Card>
      )}

      {/* Status Actions */}
      {canEdit && transitions.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              {transitions.map((t) => (
                <Button
                  key={t.value}
                  onClick={() => handleStatusChange(t.value)}
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

      {report.status === 'closed' && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-rc-emerald">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-medium">Report closed</span>
              {report.closed_date && (
                <span className="text-xs text-muted-foreground ml-2">
                  on {format(parseISO(report.closed_date), 'MMM d, yyyy')}
                </span>
              )}
              {report.closed_by_profile && (
                <span className="text-xs text-muted-foreground">
                  by {report.closed_by_profile.full_name}
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Findings & Corrective Action */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Findings & Corrective Action</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Findings</label>
            {canEdit ? (
              <Textarea
                value={editFindings}
                onChange={(e) => setEditFindings(e.target.value)}
                placeholder="Document findings..."
                rows={4}
                className="mt-1"
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{report.findings || '\u2014'}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium">Corrective Action</label>
            {canEdit ? (
              <Textarea
                value={editCorrectiveAction}
                onChange={(e) => setEditCorrectiveAction(e.target.value)}
                placeholder="Required corrective actions..."
                rows={3}
                className="mt-1"
              />
            ) : (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{report.corrective_action || '\u2014'}</p>
            )}
          </div>
          {canEdit && (
            <Button
              onClick={handleSaveFindings}
              disabled={savingFindings}
              className="bg-rc-orange hover:bg-rc-orange-dark text-white"
            >
              {findingsSaved ? 'Saved!' : savingFindings ? 'Saving...' : 'Save Findings'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Linked Punch List Items */}
      {linkedPunchItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Linked Punch List Items</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {linkedPunchItems.map((pl) => (
                <Link
                  key={pl.id}
                  href={`/projects/${projectId}/punch-list/${pl.id}`}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium text-rc-blue">{pl.number}</span>
                  <span className="text-sm">{pl.title}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {pl.status.replace(/_/g, ' ')}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="text-muted-foreground">Report ID:</span> {report.id}</p>
          <p><span className="text-muted-foreground">Number:</span> {report.number}</p>
          <p><span className="text-muted-foreground">Nonconformance:</span> {report.is_nonconformance ? 'Yes' : 'No'}</p>
          {report.closed_date && <p><span className="text-muted-foreground">Closed:</span> {format(parseISO(report.closed_date), 'MMM d, yyyy')}</p>}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete QC/QA Report</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {report.number}? This action cannot be undone.
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
