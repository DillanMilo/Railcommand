'use client';

import { useState, useMemo, use } from 'react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { Plus, Calendar, List, Cloud, Users, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useDailyLogs } from '@/hooks/useData';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export default function DailyLogsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const { can } = usePermissions(projectId);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const basePath = `/projects/${projectId}/daily-logs`;

  const { data: rawLogs, loading } = useDailyLogs(projectId);

  const logs = useMemo(
    () => [...rawLogs].sort((a, b) => b.log_date.localeCompare(a.log_date)),
    [rawLogs],
  );

  // Calendar grid for the selected month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: calEnd });

  function logForDay(day: Date) {
    return rawLogs.find((l) => isSameDay(new Date(l.log_date), day));
  }

  const totalHeadcount = (p: { headcount: number }[] | undefined) => (p ?? []).reduce((s, r) => s + r.headcount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Daily Logs' }]} />
        <p className="text-muted-foreground">Loading daily logs…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Daily Logs' }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-bold">Daily Logs</h1>
        {can(ACTIONS.DAILY_LOG_CREATE) && (
          <Button asChild className="bg-rc-orange hover:bg-rc-orange-dark text-white">
            <Link href={`${basePath}/new`}><Plus className="mr-2 size-4" />New Log</Link>
          </Button>
        )}
      </div>

      {/* View Tabs */}
      <div className="flex gap-1 border-b border-rc-border pb-px">
        {(['calendar', 'list'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors min-h-[44px] ${
              view === v ? 'border-rc-orange text-rc-orange' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {v === 'calendar' ? <Calendar className="size-4" /> : <List className="size-4" />}
            {v === 'calendar' ? 'Calendar' : 'List'}
          </button>
        ))}
      </div>

      {/* Calendar View */}
      {view === 'calendar' && (
        <div>
          {/* Month navigation */}
          <div className="flex items-center gap-3 mb-4">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <h2 className="font-heading text-lg font-semibold min-w-[160px] text-center">
              {format(monthStart, 'MMMM yyyy')}
            </h2>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground ml-1"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
          </div>

          <div className="grid grid-cols-5 gap-px bg-rc-border rounded-lg overflow-hidden border border-rc-border max-w-4xl">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-rc-card px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {calDays
              .filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
              .map((day) => {
                const log = logForDay(day);
                const inMonth = isSameMonth(day, monthStart);
                const today = isToday(day);
                return (
                  <div
                    key={day.toISOString()}
                    className={`bg-rc-card min-h-[72px] p-2 ${!inMonth ? 'opacity-40' : ''} ${today ? 'ring-2 ring-inset ring-rc-blue' : ''}`}
                  >
                    {log ? (
                      <Link href={`${basePath}/${log.id}`} className="block h-full group">
                        <span className={`text-sm font-medium group-hover:text-rc-orange transition-colors ${today ? 'text-rc-blue font-bold' : ''}`}>
                          {format(day, 'd')}
                        </span>
                        <span className="block mt-1 size-2.5 rounded-full bg-rc-emerald" />
                      </Link>
                    ) : (
                      <span className={`text-sm ${today ? 'text-rc-blue font-bold' : 'text-muted-foreground'}`}>
                        {format(day, 'd')}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="space-y-3">
          {logs.map((log) => {
            const headcount = totalHeadcount(log.personnel);
            return (
              <Link key={log.id} href={`${basePath}/${log.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{format(new Date(log.log_date), 'EEEE, MMM d, yyyy')}</span>
                      <Badge variant="outline" className="gap-1">
                        <ClipboardList className="size-3" />{(log.work_items ?? []).length} items
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{log.work_summary}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Cloud className="size-3" />{log.weather_temp}°F {log.weather_conditions}</span>
                      <span className="flex items-center gap-1"><Users className="size-3" />{headcount} workers</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
