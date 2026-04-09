'use client';

import { useState, useMemo, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { differenceInDays } from 'date-fns';
import { formatDateSafe, parseDateSafe } from '@/lib/date-utils';
import { Plus, Search } from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { getProfiles, getCurrentUserId, getProfileWithOrg } from '@/lib/store';
import { useProject } from '@/components/providers/ProjectProvider';
import ExportPDFButton from '@/components/shared/ExportPDFButton';
import { useSubmittals } from '@/hooks/useData';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Under Review', value: 'under_review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Conditional', value: 'conditional' },
  { label: 'Rejected', value: 'rejected' },
];

function getAgingDays(submitDate: string): number {
  return differenceInDays(new Date(), parseDateSafe(submitDate));
}

function isOverdue(dueDate: string): boolean {
  return parseDateSafe(dueDate) < new Date();
}

export default function SubmittalsListPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const { isDemo, currentProject } = useProject();
  const { can } = usePermissions(projectId);
  const currentProfile = getProfileWithOrg(getCurrentUserId());
  const { data: submittals, loading } = useSubmittals(projectId);
  const urlSearchParams = useSearchParams();
  const ALLOWED_STATUSES = ['all', 'draft', 'submitted', 'under_review', 'approved', 'conditional', 'rejected'];
  const rawStatus = urlSearchParams.get('status') ?? 'all';
  const initialStatus = ALLOWED_STATUSES.includes(rawStatus) ? rawStatus : 'all';
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let items = [...submittals].sort(
      (a, b) => parseDateSafe(b.submit_date).getTime() - parseDateSafe(a.submit_date).getTime()
    );
    if (statusFilter !== 'all') {
      items = items.filter((s) => s.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (s) => s.title.toLowerCase().includes(q) || s.number.toLowerCase().includes(q)
      );
    }
    return items;
  }, [statusFilter, search, submittals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rc-orange" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Submittals' }]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-bold">Submittals</h1>
          <Badge variant="secondary" className="text-xs">{submittals.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButton
            getDocument={async () => {
              const { default: SubmittalsPDF } = await import('@/lib/pdf/SubmittalsPDF');
              return <SubmittalsPDF submittals={filtered} projectName={currentProject?.name ?? 'Project'} generatedBy={currentProfile?.full_name ?? 'User'} />;
            }}
            fileName={`submittals-report-${projectId}`}
          />
          {can(ACTIONS.SUBMITTAL_CREATE) && (
            <Link href={`/projects/${projectId}/submittals/new`}>
              <Button className="bg-rc-orange hover:bg-rc-orange-dark text-white">
                <Plus className="size-4" /> New Submittal
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 space-y-4">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList variant="line" className="flex-wrap">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by title or number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Spec Section</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((sub) => {
              const profileName = sub.submitted_by_profile?.full_name ?? (isDemo ? getProfiles().find((p) => p.id === sub.submitted_by)?.full_name : null) ?? 'Unknown';
              const days = getAgingDays(sub.submit_date);
              const overdue = isOverdue(sub.due_date);
              return (
                <TableRow key={sub.id}>
                  <TableCell>
                    <Link href={`/projects/${projectId}/submittals/${sub.id}`} className="font-medium text-rc-blue hover:underline py-1 inline-block">
                      {sub.number}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate">
                    <Link href={`/projects/${projectId}/submittals/${sub.id}`} className="hover:underline py-1 inline-block">
                      {sub.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{sub.spec_section}</TableCell>
                  <TableCell><StatusBadge status={sub.status} type="submittal" /></TableCell>
                  <TableCell className="text-sm">{profileName}</TableCell>
                  <TableCell className="text-sm">{formatDateSafe(sub.due_date, 'MMM d, yyyy')}</TableCell>
                  <TableCell className={`text-right text-sm font-medium ${overdue && !['approved', 'rejected'].includes(sub.status) ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {days}d
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No submittals found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden mt-6 space-y-3">
        {filtered.map((sub) => {
          const profileName = sub.submitted_by_profile?.full_name ?? (isDemo ? getProfiles().find((p) => p.id === sub.submitted_by)?.full_name : null) ?? 'Unknown';
          const days = getAgingDays(sub.submit_date);
          const overdue = isOverdue(sub.due_date);
          return (
            <Link key={sub.id} href={`/projects/${projectId}/submittals/${sub.id}`}>
              <Card className="py-4 hover:border-rc-orange/50 transition-colors">
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-rc-blue">{sub.number}</span>
                    <StatusBadge status={sub.status} type="submittal" />
                  </div>
                  <p className="font-medium text-sm leading-tight line-clamp-2">{sub.title}</p>
                  <p className="text-xs text-muted-foreground">{sub.spec_section}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>{profileName}</span>
                    <span className={overdue && !['approved', 'rejected'].includes(sub.status) ? 'text-red-600 font-medium' : ''}>
                      Due {formatDateSafe(sub.due_date, 'MMM d')} ({days}d)
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center py-10 text-muted-foreground">No submittals found.</p>
        )}
      </div>
    </div>
  );
}
