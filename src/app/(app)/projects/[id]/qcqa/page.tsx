'use client';

import { useState, useMemo, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Plus, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { useQCQAReports } from '@/hooks/useData';
import { usePermissions } from '@/hooks/usePermissions';
import { QCQA_STATUS_COLORS, QCQA_STATUS_LABELS, QCQA_TYPE_LABELS, QCQA_SEVERITY_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { ACTIONS } from '@/lib/permissions';
import type { QCQAReportStatus, QCQAReportType } from '@/lib/types';

const STATUS_TABS: { label: string; value: QCQAReportStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Open', value: 'open' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Closed', value: 'closed' },
];

const TYPE_TABS: { label: string; value: QCQAReportType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Inspections', value: 'inspection' },
  { label: 'Nonconformances', value: 'nonconformance' },
  { label: 'Tests', value: 'test' },
  { label: 'Audits', value: 'audit' },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  major: 'bg-orange-100 text-orange-700',
  minor: 'bg-blue-100 text-blue-700',
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  major: 'border-l-orange-500',
  minor: 'border-l-blue-500',
};

export default function QCQAListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  useProject();
  const { can } = usePermissions(projectId);
  const urlSearchParams = useSearchParams();

  const VALID_STATUSES: ReadonlyArray<QCQAReportStatus> = ['draft', 'open', 'in_review', 'closed'];
  const statusParam = urlSearchParams?.get('status');
  const initialStatus: QCQAReportStatus | 'all' =
    statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as QCQAReportStatus)
      : 'all';

  const [statusFilter, setStatusFilter] = useState<QCQAReportStatus | 'all'>(initialStatus);
  const [typeFilter, setTypeFilter] = useState<QCQAReportType | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data: reports, loading } = useQCQAReports(projectId);

  const canCreate = can(ACTIONS.QCQA_CREATE);

  const counts = useMemo(() => ({
    draft: reports.filter((r) => r.status === 'draft').length,
    open: reports.filter((r) => r.status === 'open').length,
    in_review: reports.filter((r) => r.status === 'in_review').length,
    closed: reports.filter((r) => r.status === 'closed').length,
  }), [reports]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.report_type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.title.toLowerCase().includes(q) &&
          !r.findings.toLowerCase().includes(q) &&
          !r.spec_reference.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [reports, statusFilter, typeFilter, search]);

  const basePath = `/projects/${projectId}/qcqa`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'QC/QA' }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">QC/QA Reports</h1>
            <Badge variant="secondary" className="text-xs">{reports.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {counts.draft} draft, {counts.open} open, {counts.in_review} in review, {counts.closed} closed
          </p>
        </div>
        {canCreate && (
          <Button asChild className="bg-rc-orange hover:bg-rc-orange-dark text-white">
            <Link href={`${basePath}/new`}><Plus className="mr-2 size-4" />New Report</Link>
          </Button>
        )}
      </div>

      {/* Search */}
      <Input
        placeholder="Search by title, findings, or spec reference..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Type tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-rc-border pb-px">
        {TYPE_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTypeFilter(t.value)}
            className={`whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px] ${
              typeFilter === t.value ? 'border-rc-orange text-rc-orange' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Status filter pills */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border min-h-[32px]',
              statusFilter === t.value
                ? 'bg-rc-orange text-white border-rc-orange'
                : 'bg-background text-muted-foreground border-rc-border hover:border-foreground/30'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block rounded-lg border border-rc-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-rc-card">
              <TableHead className="w-[90px]">Number</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Inspector</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id} className={item.severity === 'critical' ? 'bg-red-50/60 dark:bg-red-950/20' : undefined}>
                <TableCell>
                  <Link href={`${basePath}/${item.id}`} className="font-medium text-rc-blue hover:underline py-1 inline-block">{item.number}</Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-medium">
                    {QCQA_TYPE_LABELS[item.report_type] ?? item.report_type}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[260px] truncate">
                  <Link href={`${basePath}/${item.id}`} className="hover:underline py-1 inline-block">{item.title}</Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn('border-0 font-medium text-xs', SEVERITY_COLORS[item.severity])}>
                    {QCQA_SEVERITY_LABELS[item.severity] ?? item.severity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn('border-0 font-medium text-xs', QCQA_STATUS_COLORS[item.status])}>
                    {QCQA_STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </TableCell>
                <TableCell>{item.inspector_profile?.full_name ?? '\u2014'}</TableCell>
                <TableCell className="text-muted-foreground">{format(parseISO(item.created_at), 'MMM d, yyyy')}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  {reports.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardCheck className="size-10 text-muted-foreground/40" />
                      <p>No QC/QA reports recorded</p>
                    </div>
                  ) : (
                    'No items match your filters.'
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {filtered.length === 0 && reports.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <ClipboardCheck className="size-10 text-muted-foreground/40" />
            <p>No QC/QA reports recorded</p>
          </div>
        )}
        {filtered.length === 0 && reports.length > 0 && (
          <p className="text-center py-10 text-muted-foreground">No items match your filters.</p>
        )}
        {filtered.map((item) => (
          <Link key={item.id} href={`${basePath}/${item.id}`}>
            <Card className={`transition-shadow hover:shadow-md border-l-4 ${SEVERITY_BORDER[item.severity] ?? ''} ${item.severity === 'critical' ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rc-blue">{item.number}</span>
                  <Badge variant="secondary" className={cn('border-0 font-medium text-xs', QCQA_STATUS_COLORS[item.status])}>
                    {QCQA_STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </div>
                <p className="font-medium text-sm line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {QCQA_TYPE_LABELS[item.report_type] ?? item.report_type}
                  </Badge>
                  <Badge variant="secondary" className={cn('border-0 text-xs', SEVERITY_COLORS[item.severity])}>
                    {QCQA_SEVERITY_LABELS[item.severity] ?? item.severity}
                  </Badge>
                  {item.is_nonconformance && (
                    <Badge variant="destructive" className="text-xs">NCR</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.inspector_profile?.full_name ?? '\u2014'}</span>
                  <span>{format(parseISO(item.created_at), 'MMM d')}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
