'use client';

import { useState, useMemo, use } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { FileBarChart, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { useWeeklyReports } from '@/hooks/useData';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import { WEEKLY_REPORT_STATUS_COLORS, WEEKLY_REPORT_STATUS_LABELS, WEEKLY_REPORT_TYPE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { WeeklyReportType, WeeklyReportStatus } from '@/lib/types';

const TYPE_TABS: { label: string; value: WeeklyReportType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'CM Reports', value: 'cm' },
  { label: 'Contractor Reports', value: 'contractor' },
];

const STATUS_TABS: { label: string; value: WeeklyReportStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export default function WeeklyReportsListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  useProject();

  const { can } = usePermissions(projectId);

  const [typeFilter, setTypeFilter] = useState<WeeklyReportType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<WeeklyReportStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const { data: reports, loading } = useWeeklyReports(projectId);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (typeFilter !== 'all' && r.report_type !== typeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!r.title.toLowerCase().includes(q) && !r.work_summary.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [reports, typeFilter, statusFilter, search]);

  const basePath = `/projects/${projectId}/weekly-reports`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports' }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">Weekly Reports</h1>
            <Badge variant="secondary" className="text-xs">{reports.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {reports.filter((r) => r.status === 'draft').length} draft, {reports.filter((r) => r.status === 'submitted').length} submitted, {reports.filter((r) => r.status === 'approved').length} approved
          </p>
        </div>
        {can(ACTIONS.WEEKLY_REPORT_CREATE) && (
          <Button asChild className="bg-rc-orange hover:bg-rc-orange-dark text-white">
            <Link href={`${basePath}/new`}><Plus className="mr-2 size-4" />New Report</Link>
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by title or summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Report Type tabs */}
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

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-px">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === t.value
                ? 'bg-rc-orange text-white'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
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
              <TableHead className="w-[110px]">Type</TableHead>
              <TableHead className="w-[150px]">Week</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead className="w-[110px]">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((report) => (
              <TableRow key={report.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <Link href={`${basePath}/${report.id}`} className="font-medium text-rc-blue hover:underline py-1 inline-block">
                    {report.number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-medium">
                    {WEEKLY_REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(parseISO(report.week_start_date), 'MMM d')} &ndash; {format(parseISO(report.week_end_date), 'MMM d')}
                </TableCell>
                <TableCell className="max-w-[260px] truncate">
                  <Link href={`${basePath}/${report.id}`} className="hover:underline py-1 inline-block">
                    {report.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', WEEKLY_REPORT_STATUS_COLORS[report.status])}>
                    {WEEKLY_REPORT_STATUS_LABELS[report.status] ?? report.status}
                  </span>
                </TableCell>
                <TableCell>{report.submitted_by_profile?.full_name ?? '\u2014'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {report.submit_date ? format(parseISO(report.submit_date), 'MMM d, yyyy') : '\u2014'}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  {reports.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <FileBarChart className="size-10 text-muted-foreground/40" />
                      <p>No weekly reports yet</p>
                      <p className="text-xs">Create your first weekly report to get started.</p>
                    </div>
                  ) : (
                    'No reports match your filters.'
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
            <FileBarChart className="size-10 text-muted-foreground/40" />
            <p>No weekly reports yet</p>
            <p className="text-xs">Create your first weekly report to get started.</p>
          </div>
        )}
        {filtered.length === 0 && reports.length > 0 && (
          <p className="text-center py-10 text-muted-foreground">No reports match your filters.</p>
        )}
        {filtered.map((report) => (
          <Link key={report.id} href={`${basePath}/${report.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-rc-blue">{report.number}</span>
                    <Badge variant="outline" className="text-xs">
                      {WEEKLY_REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}
                    </Badge>
                  </div>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', WEEKLY_REPORT_STATUS_COLORS[report.status])}>
                    {WEEKLY_REPORT_STATUS_LABELS[report.status] ?? report.status}
                  </span>
                </div>
                <p className="font-medium text-sm line-clamp-2">{report.title}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(report.week_start_date), 'MMM d')} &ndash; {format(parseISO(report.week_end_date), 'MMM d')}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{report.submitted_by_profile?.full_name ?? '\u2014'}</span>
                  <span>{report.submit_date ? format(parseISO(report.submit_date), 'MMM d, yyyy') : '\u2014'}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
