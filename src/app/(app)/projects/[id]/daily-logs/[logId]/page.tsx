'use client';

import { use } from 'react';
import { formatDateSafe, parseDateSafe } from '@/lib/date-utils';
import Link from 'next/link';
import { Cloud, Sun, Snowflake, Wind, ShieldAlert, Users, Wrench, ClipboardList, MapPin, Pencil } from 'lucide-react';
import ExportPDFButton from '@/components/shared/ExportPDFButton';
import DailyLogPDF from '@/lib/pdf/DailyLogPDF';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableFooter } from '@/components/ui/table';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import PhotoGallery from '@/components/shared/PhotoGallery';
import { getProfiles, getAttachments } from '@/lib/store';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { useDailyLogDetail } from '@/hooks/useData';
import { ACTIONS } from '@/lib/permissions';
import type { DailyLog } from '@/lib/types';

function weatherIcon(conditions: string) {
  const c = conditions.toLowerCase();
  if (c.includes('snow') || c.includes('flurr')) return <Snowflake className="size-6 text-blue-400" />;
  if (c.includes('clear') || c.includes('sunny') || c.includes('warm')) return <Sun className="size-6 text-amber-400" />;
  return <Cloud className="size-6 text-gray-400" />;
}

export default function DailyLogDetailPage({ params, searchParams }: { params: Promise<{ id: string; logId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId, logId } = use(params);
  use(searchParams);
  const { isDemo, currentProject } = useProject();
  const { can } = usePermissions(projectId);
  const { data: log, loading } = useDailyLogDetail(projectId, logId);

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Daily Logs', href: `/projects/${projectId}/daily-logs` }, { label: '…' }]} />
        <p className="text-muted-foreground">Loading daily log…</p>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Daily Logs', href: `/projects/${projectId}/daily-logs` }, { label: 'Not Found' }]} />
        <p className="text-muted-foreground">Daily log not found.</p>
      </div>
    );
  }

  const dateLabel = formatDateSafe(log.log_date, 'MMM d, yyyy');
  const dateFull = formatDateSafe(log.log_date, 'EEEE, MMMM d, yyyy');
  const authorName = (log as DailyLog & { created_by_profile?: { full_name?: string } }).created_by_profile?.full_name
    ?? (isDemo ? getProfiles().find((p) => p.id === log.created_by)?.full_name : undefined);
  const totalHeadcount = (log.personnel ?? []).reduce((s, r) => s + r.headcount, 0);
  const attachments = (log as DailyLog & { attachments?: unknown[] }).attachments?.length
    ? (log as DailyLog & { attachments?: unknown[] }).attachments!
    : isDemo ? getAttachments('daily_log', logId) : [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Daily Logs', href: `/projects/${projectId}/daily-logs` },
        { label: dateLabel },
      ]} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">{dateFull}</h1>
          {authorName && <p className="text-sm text-muted-foreground mt-1">Created by {authorName}</p>}
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButton
            document={<DailyLogPDF log={log} projectName={currentProject?.name ?? 'Project'} generatedBy={authorName ?? 'User'} />}
            fileName={`daily-log-${log.log_date}-${projectId}`}
          />
          {can(ACTIONS.DAILY_LOG_UPDATE) && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/projects/${projectId}/daily-logs/${logId}/edit`}>
                <Pencil className="mr-1.5 size-3.5" />Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Weather */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Cloud className="size-5" />Weather</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            {weatherIcon(log.weather_conditions)}
            <span className="text-4xl font-bold">{log.weather_temp}°F</span>
          </div>
          <div className="space-y-1 text-sm">
            <p>{log.weather_conditions}</p>
            <p className="flex items-center gap-1 text-muted-foreground"><Wind className="size-4" />{log.weather_wind}</p>
          </div>
        </CardContent>
      </Card>

      {/* Personnel */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="size-5" />Personnel</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-rc-border overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-rc-card"><TableHead>Role</TableHead><TableHead className="text-right">Headcount</TableHead><TableHead>Company</TableHead></TableRow></TableHeader>
              <TableBody>
                {(log.personnel ?? []).map((p) => (
                  <TableRow key={p.id}><TableCell>{p.role}</TableCell><TableCell className="text-right">{p.headcount}</TableCell><TableCell>{p.company}</TableCell></TableRow>
                ))}
              </TableBody>
              <TableFooter><TableRow><TableCell className="font-semibold">Total</TableCell><TableCell className="text-right font-semibold">{totalHeadcount}</TableCell><TableCell /></TableRow></TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Equipment */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="size-5" />Equipment</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-rc-border overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-rc-card"><TableHead>Equipment Type</TableHead><TableHead className="text-right">Count</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>
                {(log.equipment ?? []).map((e) => (
                  <TableRow key={e.id}><TableCell>{e.equipment_type}</TableCell><TableCell className="text-right">{e.count}</TableCell><TableCell className="text-muted-foreground">{e.notes || '—'}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Work Items */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="size-5" />Work Items</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-lg border border-rc-border overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-rc-card"><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead><TableHead>Location</TableHead></TableRow></TableHeader>
              <TableBody>
                {(log.work_items ?? []).map((w) => (
                  <TableRow key={w.id}><TableCell>{w.description}</TableCell><TableCell className="text-right">{w.quantity}</TableCell><TableCell>{w.unit}</TableCell><TableCell className="text-muted-foreground">{w.location}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Work Summary */}
      <Card>
        <CardHeader><CardTitle>Work Summary</CardTitle></CardHeader>
        <CardContent><p className="text-sm leading-relaxed">{log.work_summary}</p></CardContent>
      </Card>

      {/* Safety Notes */}
      {log.safety_notes && (
        <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
          <CardHeader><CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400"><ShieldAlert className="size-5" />Safety Notes</CardTitle></CardHeader>
          <CardContent><p className="text-sm leading-relaxed">{log.safety_notes}</p></CardContent>
        </Card>
      )}

      {/* Geo-tag display */}
      {log.geo_tag && (
        <Card>
          <CardContent className="flex items-center gap-2 p-4">
            <MapPin className="size-4 text-rc-emerald shrink-0" />
            <div>
              <p className="text-sm font-medium text-rc-emerald">GPS Location Tagged</p>
              <p className="text-xs text-muted-foreground">
                {log.geo_tag.lat.toFixed(6)}, {log.geo_tag.lng.toFixed(6)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      <PhotoGallery attachments={attachments} />
    </div>
  );
}
