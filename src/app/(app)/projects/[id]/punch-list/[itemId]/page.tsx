'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, CheckCircle2, Play, RotateCcw, ShieldCheck, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import PriorityBadge from '@/components/shared/PriorityBadge';
import { getPunchListItems, getProfiles, updatePunchListStatus } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import type { PunchListStatus } from '@/lib/types';

function getName(id: string) {
  return getProfiles().find((p) => p.id === id)?.full_name ?? '—';
}

export default function PunchListDetailPage() {
  const { id: projectId, itemId } = useParams<{ id: string; itemId: string }>();
  const { can } = usePermissions(projectId);
  const item = getPunchListItems(projectId).find((i) => i.id === itemId);
  const [status, setStatus] = useState<PunchListStatus>(item?.status ?? 'open');
  const [notes, setNotes] = useState(item?.resolution_notes ?? '');
  const [resolutionInput, setResolutionInput] = useState('');

  if (!item) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Punch List', href: `/projects/${projectId}/punch-list` }]} />
        <p className="py-20 text-center text-muted-foreground">Item not found.</p>
      </div>
    );
  }

  const basePath = `/projects/${projectId}/punch-list`;

  function handleStart() { setStatus('in_progress'); updatePunchListStatus(itemId, 'in_progress'); }
  function handleResolve() { const n = resolutionInput || 'Resolved.'; setStatus('resolved'); setNotes(n); updatePunchListStatus(itemId, 'resolved', n); }
  function handleVerify() { setStatus('verified'); updatePunchListStatus(itemId, 'verified'); }
  function handleReopen() { setStatus('open'); setNotes(''); setResolutionInput(''); updatePunchListStatus(itemId, 'open', ''); }

  const info = [
    { label: 'Location', value: item.location },
    { label: 'Assigned To', value: getName(item.assigned_to) },
    { label: 'Created By', value: getName(item.created_by) },
    { label: 'Due Date', value: format(new Date(item.due_date), 'MMM d, yyyy') },
    { label: 'Created', value: format(new Date(item.created_at), 'MMM d, yyyy') },
  ];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Punch List', href: basePath },
        { label: item.number },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to Punch List
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-xl font-bold md:text-2xl">
            <span className="text-rc-blue">{item.number}</span> &mdash; {item.title}
          </h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <StatusBadge status={status} type="punch_list" />
          <PriorityBadge priority={item.priority} />
        </div>
      </div>

      {/* Info grid */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {info.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-sm font-medium">{f.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Description */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Description</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">{item.description}</CardContent>
      </Card>

      {/* Resolution workflow */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Resolution</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {status === 'open' && can(ACTIONS.PUNCH_LIST_RESOLVE) && (
            <Button onClick={handleStart} className="bg-rc-blue hover:bg-rc-blue/90 text-white">
              <Play className="mr-2 size-4" />Start Work
            </Button>
          )}
          {status === 'in_progress' && can(ACTIONS.PUNCH_LIST_RESOLVE) && (
            <>
              <Textarea placeholder="Resolution notes..." value={resolutionInput} onChange={(e) => setResolutionInput(e.target.value)} rows={3} />
              <Button onClick={handleResolve} className="bg-rc-emerald hover:bg-rc-emerald/90 text-white">
                <CheckCircle2 className="mr-2 size-4" />Mark Resolved
              </Button>
            </>
          )}
          {status === 'resolved' && (
            <div className="space-y-3">
              {notes && <p className="rounded-md bg-muted p-3 text-sm">{notes}</p>}
              <div className="flex flex-wrap gap-2">
                {can(ACTIONS.PUNCH_LIST_VERIFY) && (
                  <Button onClick={handleVerify} className="bg-rc-emerald hover:bg-rc-emerald/90 text-white">
                    <ShieldCheck className="mr-2 size-4" />Verify
                  </Button>
                )}
                {can(ACTIONS.PUNCH_LIST_RESOLVE) && (
                  <Button variant="outline" onClick={handleReopen}>
                    <RotateCcw className="mr-2 size-4" />Reopen
                  </Button>
                )}
              </div>
            </div>
          )}
          {status === 'verified' && (
            <div className="flex items-center gap-2 text-rc-emerald">
              <CheckCircle2 className="size-5" />
              <span className="text-sm font-medium">Verified and closed</span>
            </div>
          )}
          {notes && status !== 'resolved' && status !== 'in_progress' && status !== 'open' && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Resolution Notes</p>
              <p className="rounded-md bg-muted p-3 text-sm">{notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photos placeholder */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Photos</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-rc-border py-6 sm:py-10 text-muted-foreground">
            <Camera className="size-8 mb-2" />
            <p className="text-sm">No photos attached yet</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
