'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { getPunchListItems, getProfiles } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import type { PunchListStatus, Priority } from '@/lib/types';

const STATUS_TABS: { label: string; value: PunchListStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Verified', value: 'verified' },
];

const PRIORITY_OPTIONS: { label: string; value: Priority | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
];

const BORDER_COLOR: Record<Priority, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-500',
  low: 'border-l-blue-500',
};

function getName(id: string) {
  return getProfiles().find((p) => p.id === id)?.full_name ?? '—';
}

export default function PunchListPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const { can } = usePermissions(projectId);
  const [statusFilter, setStatusFilter] = useState<PunchListStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');

  const items = getPunchListItems(projectId);
  const counts = useMemo(() => ({
    open: items.filter((i) => i.status === 'open').length,
    in_progress: items.filter((i) => i.status === 'in_progress').length,
    resolved: items.filter((i) => i.status === 'resolved').length,
    verified: items.filter((i) => i.status === 'verified').length,
  }), [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && i.priority !== priorityFilter) return false;
      return true;
    });
  }, [items, statusFilter, priorityFilter]);

  const basePath = `/projects/${projectId}/punch-list`;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Punch List' }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Punch List</h1>
          <p className="text-sm text-muted-foreground">
            {items.length} items &mdash; {counts.open} open, {counts.in_progress} in progress, {counts.resolved} resolved, {counts.verified} verified
          </p>
        </div>
        {can(ACTIONS.PUNCH_LIST_CREATE) && (
          <Button asChild className="bg-rc-orange hover:bg-rc-orange-dark text-white">
            <Link href={`${basePath}/new`}><Plus className="mr-2 size-4" />New Item</Link>
          </Button>
        )}
      </div>

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

      {/* Priority chips */}
      <div className="flex flex-wrap gap-2">
        {PRIORITY_OPTIONS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPriorityFilter(p.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors min-h-[36px] inline-flex items-center ${
              priorityFilter === p.value
                ? 'bg-rc-navy text-white border-rc-navy'
                : 'bg-rc-card text-muted-foreground border-rc-border hover:border-rc-steel'
            }`}
          >
            {p.label}
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
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => (
              <TableRow key={item.id} className={item.priority === 'critical' ? 'bg-red-50/60 dark:bg-red-950/20' : undefined}>
                <TableCell>
                  <Link href={`${basePath}/${item.id}`} className="font-medium text-rc-blue hover:underline py-1 inline-block">{item.number}</Link>
                </TableCell>
                <TableCell className="max-w-[260px] truncate">
                  <Link href={`${basePath}/${item.id}`} className="hover:underline py-1 inline-block">{item.title}</Link>
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-muted-foreground">{item.location}</TableCell>
                <TableCell><StatusBadge status={item.status} type="punch_list" /></TableCell>
                <TableCell><PriorityBadge priority={item.priority} /></TableCell>
                <TableCell>{getName(item.assigned_to)}</TableCell>
                <TableCell>{format(new Date(item.due_date), 'MMM d, yyyy')}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No items match your filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {filtered.map((item) => (
          <Link key={item.id} href={`${basePath}/${item.id}`}>
            <Card className={`transition-shadow hover:shadow-md border-l-4 ${BORDER_COLOR[item.priority]} ${item.priority === 'critical' ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-rc-blue">{item.number}</span>
                  <StatusBadge status={item.status} type="punch_list" />
                </div>
                <p className="font-medium text-sm line-clamp-2">{item.title}</p>
                <p className="text-xs text-muted-foreground truncate">{item.location}</p>
                <div className="flex items-center justify-between">
                  <PriorityBadge priority={item.priority} />
                  <span className="text-xs text-muted-foreground">Due {format(new Date(item.due_date), 'MMM d')}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && <p className="text-center py-10 text-muted-foreground">No items match your filters.</p>}
      </div>
    </div>
  );
}
