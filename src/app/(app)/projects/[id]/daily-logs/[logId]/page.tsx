'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { Cloud, Sun, Snowflake, Wind, ShieldAlert, Users, Wrench, ClipboardList, ImageOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableFooter } from '@/components/ui/table';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { getDailyLogs, getProfiles } from '@/lib/store';
import type { DailyLog } from '@/lib/types';

function weatherIcon(conditions: string) {
  const c = conditions.toLowerCase();
  if (c.includes('snow') || c.includes('flurr')) return <Snowflake className="size-6 text-blue-400" />;
  if (c.includes('clear') || c.includes('sunny') || c.includes('warm')) return <Sun className="size-6 text-amber-400" />;
  return <Cloud className="size-6 text-gray-400" />;
}

export default function DailyLogDetailPage() {
  const { id: projectId, logId } = useParams<{ id: string; logId: string }>();
  const log = getDailyLogs(projectId).find((l) => l.id === logId) as DailyLog | undefined;

  if (!log) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Daily Logs', href: `/projects/${projectId}/daily-logs` }, { label: 'Not Found' }]} />
        <p className="text-muted-foreground">Daily log not found.</p>
      </div>
    );
  }

  const dateObj = new Date(log.log_date);
  const dateLabel = format(dateObj, 'MMM d, yyyy');
  const dateFull = format(dateObj, 'EEEE, MMMM d, yyyy');
  const author = getProfiles().find((p) => p.id === log.created_by);
  const totalHeadcount = log.personnel.reduce((s, r) => s + r.headcount, 0);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Daily Logs', href: `/projects/${projectId}/daily-logs` },
        { label: dateLabel },
      ]} />

      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold">{dateFull}</h1>
        {author && <p className="text-sm text-muted-foreground mt-1">Created by {author.full_name}</p>}
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
                {log.personnel.map((p) => (
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
                {log.equipment.map((e) => (
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
                {log.work_items.map((w) => (
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

      {/* Photos */}
      <Card>
        <CardHeader><CardTitle>Photos</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <ImageOff className="size-8 mb-2" />
            <p className="text-sm">No photos attached</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
