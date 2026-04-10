'use client';

import { useState, useMemo, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Plus, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import { useProject } from '@/components/providers/ProjectProvider';
import { useSafetyIncidents } from '@/hooks/useData';
import { SEVERITY_COLORS, INCIDENT_TYPE_LABELS, SAFETY_STATUS_COLORS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { IncidentStatus } from '@/lib/types';

const STATUS_TABS: { label: string; value: IncidentStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

const SEVERITY_BORDER: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-500',
};

export default function SafetyListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  useProject();
  const urlSearchParams = useSearchParams();

  const VALID_STATUSES: ReadonlyArray<IncidentStatus> = ['open', 'in_progress', 'resolved', 'closed'];
  const statusParam = urlSearchParams?.get('status');
  const initialStatus: IncidentStatus | 'all' =
    statusParam && (VALID_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as IncidentStatus)
      : 'all';

  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>(initialStatus);
  const [search, setSearch] = useState('');

  const { data: incidents, loading } = useSafetyIncidents(projectId);

  const counts = useMemo(() => ({
    open: incidents.filter((i) => i.status === 'open').length,
    in_progress: incidents.filter((i) => i.status === 'in_progress').length,
    resolved: incidents.filter((i) => i.status === 'resolved').length,
    closed: incidents.filter((i) => i.status === 'closed').length,
  }), [incidents]);

  const filtered = useMemo(() => {
    return incidents.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [incidents, statusFilter, search]);

  const basePath = `/projects/${projectId}/safety`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Safety' }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">Safety</h1>
            <Badge variant="secondary" className="text-xs">{incidents.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {counts.open} open, {counts.in_progress} in progress, {counts.resolved} resolved, {counts.closed} closed
          </p>
        </div>
        <Button asChild className="bg-rc-orange hover:bg-rc-orange-dark text-white">
          <Link href={`${basePath}/new`}><Plus className="mr-2 size-4" />New Incident</Link>
        </Button>
      </div>

      {/* Search */}
      <Input
        placeholder="Search by title..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-rc-border pb-px">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setStatusFilter(t.value)}
            className={`whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px min-h-[44px] ${
              statusFilter === t.value ? 'border-rc-orange text-rc-orange' : 'border-transparent text-muted-foreground hover:text-foreground'
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
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Reported By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id} className={item.severity === 'critical' ? 'bg-red-50/60 dark:bg-red-950/20' : undefined}>
                <TableCell>
                  <Link href={`${basePath}/${item.id}`} className="font-medium text-rc-blue hover:underline py-1 inline-block">{item.number}</Link>
                </TableCell>
                <TableCell className="max-w-[260px] truncate">
                  <Link href={`${basePath}/${item.id}`} className="hover:underline py-1 inline-block">{item.title}</Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-medium">
                    {INCIDENT_TYPE_LABELS[item.incident_type] ?? item.incident_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn('border-0 font-medium text-xs', SEVERITY_COLORS[item.severity])}>
                    {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell><StatusBadge status={item.status} type="safety" /></TableCell>
                <TableCell className="text-muted-foreground">{format(parseISO(item.incident_date), 'MMM d, yyyy')}</TableCell>
                <TableCell>{item.reported_by_profile?.full_name ?? '\u2014'}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  {incidents.length === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      <ShieldAlert className="size-10 text-muted-foreground/40" />
                      <p>No safety incidents recorded</p>
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
        {filtered.length === 0 && incidents.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <ShieldAlert className="size-10 text-muted-foreground/40" />
            <p>No safety incidents recorded</p>
          </div>
        )}
        {filtered.length === 0 && incidents.length > 0 && (
          <p className="text-center py-10 text-muted-foreground">No items match your filters.</p>
        )}
        {filtered.map((item) => (
          <Link key={item.id} href={`${basePath}/${item.id}`}>
            <Card className={`transition-shadow hover:shadow-md border-l-4 ${SEVERITY_BORDER[item.severity] ?? ''} ${item.severity === 'critical' ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rc-blue">{item.number}</span>
                  <StatusBadge status={item.status} type="safety" />
                </div>
                <p className="font-medium text-sm line-clamp-2">{item.title}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {INCIDENT_TYPE_LABELS[item.incident_type] ?? item.incident_type}
                  </Badge>
                  <Badge variant="secondary" className={cn('border-0 text-xs', SEVERITY_COLORS[item.severity])}>
                    {item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{item.reported_by_profile?.full_name ?? '\u2014'}</span>
                  <span>{format(parseISO(item.incident_date), 'MMM d')}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
