'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format, differenceInCalendarDays } from 'date-fns';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { getRFIs, seedProfiles } from '@/lib/store';
import type { RFI, RFIStatus } from '@/lib/types';

const TABS: { label: string; value: RFIStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Answered', value: 'answered' },
  { label: 'Closed', value: 'closed' },
  { label: 'Overdue', value: 'overdue' },
];

function getProfile(id: string) {
  return seedProfiles.find((p) => p.id === id);
}

function daysOpen(rfi: RFI): number {
  const end = rfi.response_date ? new Date(rfi.response_date) : new Date();
  return differenceInCalendarDays(end, new Date(rfi.submit_date));
}

export default function RFIsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [tab, setTab] = useState<RFIStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return getRFIs().filter((r) => {
      if (tab !== 'all' && r.status !== tab) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.number.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q) ||
          (getProfile(r.submitted_by)?.full_name ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tab, search]);

  const basePath = `/projects/${projectId}/rfis`;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'RFIs' }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">RFIs</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} items</p>
        </div>
        <Button asChild className="bg-rc-orange hover:bg-rc-orange-dark text-white">
          <Link href={`${basePath}/new`}><Plus className="mr-2 size-4" />New RFI</Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-rc-border pb-px">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.value
                ? 'border-rc-orange text-rc-orange'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input placeholder="Search RFIs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border border-rc-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-rc-card">
              <TableHead className="w-[100px]">Number</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Days Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((rfi) => {
              const isOverdue = rfi.status === 'overdue';
              const days = daysOpen(rfi);
              return (
                <TableRow key={rfi.id} className={isOverdue ? 'bg-red-50/60 dark:bg-red-950/20' : undefined}>
                  <TableCell>
                    <Link href={`${basePath}/${rfi.id}`} className="font-medium text-rc-blue hover:underline">{rfi.number}</Link>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">
                    <Link href={`${basePath}/${rfi.id}`} className="hover:underline">{rfi.subject}</Link>
                  </TableCell>
                  <TableCell><StatusBadge status={rfi.status} type="rfi" /></TableCell>
                  <TableCell><PriorityBadge priority={rfi.priority} /></TableCell>
                  <TableCell>{getProfile(rfi.submitted_by)?.full_name ?? '—'}</TableCell>
                  <TableCell>{getProfile(rfi.assigned_to)?.full_name ?? '—'}</TableCell>
                  <TableCell>{format(new Date(rfi.due_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell className={`text-right font-medium ${isOverdue ? 'text-red-600' : ''}`}>{days}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No RFIs match your filters.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map((rfi) => {
          const isOverdue = rfi.status === 'overdue';
          const days = daysOpen(rfi);
          return (
            <Link key={rfi.id} href={`${basePath}/${rfi.id}`}>
              <Card className={`transition-shadow hover:shadow-md ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-rc-blue">{rfi.number}</span>
                    <StatusBadge status={rfi.status} type="rfi" />
                  </div>
                  <p className="font-medium text-sm line-clamp-2">{rfi.subject}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{getProfile(rfi.submitted_by)?.full_name}</span>
                    <span className={isOverdue ? 'text-red-600 font-medium' : ''}>{days}d open</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={rfi.priority} />
                    <span className="text-xs text-muted-foreground">Due {format(new Date(rfi.due_date), 'MMM d')}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && <p className="text-center py-10 text-muted-foreground">No RFIs match your filters.</p>}
      </div>
    </div>
  );
}
