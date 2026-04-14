'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Trash2, Send, CheckCircle2, XCircle, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { useWeeklyReportDetail } from '@/hooks/useData';
import { updateWeeklyReport as serverUpdateReport, deleteWeeklyReport as serverDeleteReport } from '@/lib/actions/weekly-reports';
import { updateWeeklyReport as storeUpdateReport, deleteWeeklyReport as storeDeleteReport } from '@/lib/store';
import { WEEKLY_REPORT_STATUS_COLORS, WEEKLY_REPORT_STATUS_LABELS, WEEKLY_REPORT_TYPE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { WeeklyReportStatus } from '@/lib/types';

export default function WeeklyReportDetailPage({ params, searchParams }: { params: Promise<{ id: string; reportId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId, reportId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { isDemo } = useProject();
  const { data: report, loading, refetch } = useWeeklyReportDetail(projectId, reportId);

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const basePath = `/projects/${projectId}/weekly-reports`;

  async function handleStatusChange(newStatus: WeeklyReportStatus) {
    setStatusUpdating(true);
    setErrorMsg(null);

    if (isDemo) {
      storeUpdateReport(reportId, { status: newStatus });
      refetch();
      setStatusUpdating(false);
      return;
    }

    const result = await serverUpdateReport(projectId, reportId, { status: newStatus });
    if (result.error) {
      setErrorMsg(result.error);
    } else {
      refetch();
    }
    setStatusUpdating(false);
  }

  async function handleDelete() {
    setDeleting(true);
    setErrorMsg(null);

    if (isDemo) {
      storeDeleteReport(reportId);
      router.push(basePath);
      return;
    }

    const result = await serverDeleteReport(projectId, reportId);
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

  if (!report) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports', href: basePath }]} />
        <p className="py-20 text-center text-muted-foreground">Report not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reports', href: basePath },
        { label: report.number },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to Reports
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold md:text-2xl">
            <span className="text-rc-blue">{report.number}</span> &mdash; {report.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(parseISO(report.week_start_date), 'MMM d, yyyy')} &ndash; {format(parseISO(report.week_end_date), 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Badge variant="secondary" className="border-0 font-medium bg-blue-50 text-blue-700">
            {WEEKLY_REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}
          </Badge>
          <Badge variant="secondary" className={cn('border-0 font-medium', WEEKLY_REPORT_STATUS_COLORS[report.status])}>
            {WEEKLY_REPORT_STATUS_LABELS[report.status] ?? report.status}
          </Badge>
          <Button variant="outline" size="sm" disabled>
            <Pencil className="size-4 mr-1" />Edit
          </Button>
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4 mr-1" />Delete
          </Button>
        </div>
      </div>

      {/* Status transition buttons */}
      <div className="flex flex-wrap gap-2">
        {report.status === 'draft' && (
          <Button size="sm" onClick={() => handleStatusChange('submitted')} disabled={statusUpdating} className="bg-rc-blue hover:bg-rc-blue/90 text-white">
            <Send className="size-4 mr-1" />{statusUpdating ? 'Submitting...' : 'Submit Report'}
          </Button>
        )}
        {report.status === 'submitted' && (
          <>
            <Button size="sm" onClick={() => handleStatusChange('approved')} disabled={statusUpdating} className="bg-rc-emerald hover:bg-rc-emerald/90 text-white">
              <CheckCircle2 className="size-4 mr-1" />{statusUpdating ? 'Updating...' : 'Approve'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleStatusChange('rejected')} disabled={statusUpdating} className="text-red-600 hover:text-red-700 hover:bg-red-50">
              <XCircle className="size-4 mr-1" />{statusUpdating ? 'Updating...' : 'Reject'}
            </Button>
          </>
        )}
        {report.status === 'rejected' && (
          <Button size="sm" onClick={() => handleStatusChange('draft')} disabled={statusUpdating} variant="outline">
            {statusUpdating ? 'Updating...' : 'Revert to Draft'}
          </Button>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Card 1: Work Summary */}
      {report.work_summary && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Work Summary</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{report.work_summary}</CardContent>
        </Card>
      )}

      {/* Card 2: Schedule Summary + Upcoming Work */}
      {(report.schedule_summary || report.upcoming_work) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.schedule_summary && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Schedule Summary</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{report.schedule_summary}</CardContent>
            </Card>
          )}
          {report.upcoming_work && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming Work</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{report.upcoming_work}</CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Card 3: Safety & Weather */}
      {(report.safety_summary || report.weather_summary) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.safety_summary && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Safety Summary</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{report.safety_summary}</CardContent>
            </Card>
          )}
          {report.weather_summary && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Weather Summary</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{report.weather_summary}</CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Card 4: Issues & Concerns */}
      {report.issues_concerns && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Issues & Concerns</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground whitespace-pre-wrap">{report.issues_concerns}</CardContent>
        </Card>
      )}

      {/* Card 5: Metrics */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Metrics</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Manpower Total</p>
              <p className="text-lg font-semibold">{report.manpower_total}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Equipment Hours</p>
              <p className="text-lg font-semibold">{report.equipment_hours}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata footer */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Submitted By</p>
            <p className="text-sm font-medium">{report.submitted_by_profile?.full_name ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Submit Date</p>
            <p className="text-sm font-medium">{report.submit_date ? format(parseISO(report.submit_date), 'MMM d, yyyy') : '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approved By</p>
            <p className="text-sm font-medium">{report.approved_by_profile?.full_name ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approval Date</p>
            <p className="text-sm font-medium">{report.approval_date ? format(parseISO(report.approval_date), 'MMM d, yyyy') : '\u2014'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Weekly Report</DialogTitle>
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
