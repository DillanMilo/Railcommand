'use client';

import { useSyncExternalStore } from 'react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { Card } from '@/components/ui/card';
import type { Milestone, MilestoneStatus } from '@/lib/types';

/* ------------------------------------------------------------------ */
/*  Colours                                                            */
/* ------------------------------------------------------------------ */

const BAR_COLOR: Record<MilestoneStatus, string> = {
  on_track: 'bg-emerald-500',
  complete: 'bg-emerald-600',
  at_risk: 'bg-amber-500',
  behind: 'bg-red-500',
  not_started: 'bg-gray-300 dark:bg-gray-600',
};

const DOT_COLOR: Record<MilestoneStatus, string> = {
  on_track: 'bg-emerald-500',
  complete: 'bg-emerald-600',
  at_risk: 'bg-amber-500',
  behind: 'bg-red-500',
  not_started: 'bg-gray-300 dark:bg-gray-500',
};

/* ------------------------------------------------------------------ */
/*  Hydration-safe "today" hook                                        */
/* ------------------------------------------------------------------ */

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function pct(days: number, total: number) {
  return Math.min(Math.max((days / total) * 100, 0), 100);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface TimelineViewProps {
  milestones: Milestone[];
  startDate: string;
  endDate: string;
}

export default function TimelineView({ milestones, startDate, endDate }: TimelineViewProps) {
  const projectStart = parseISO(startDate);
  const projectEnd = parseISO(endDate);
  const totalDays = Math.max(differenceInCalendarDays(projectEnd, projectStart), 1);
  const isMounted = useIsMounted();

  const todayPct = isMounted
    ? pct(differenceInCalendarDays(new Date(), projectStart), totalDays)
    : null;

  // Month gridlines
  const months: { label: string; shortLabel: string; pct: number }[] = [];
  const cursor = new Date(projectStart);
  cursor.setDate(1);
  while (cursor <= projectEnd) {
    const p = pct(differenceInCalendarDays(cursor, projectStart), totalDays);
    if (p >= 0) {
      months.push({
        label: format(cursor, 'MMM yyyy'),
        shortLabel: format(cursor, 'MMM'),
        pct: Math.max(p, 0),
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const ROW_H = 44; // px per milestone row
  const HEADER_H = 28; // px for month label header
  const chartHeight = milestones.length * ROW_H + HEADER_H;

  return (
    <Card className="p-0 overflow-hidden">
      {/* ---- MOBILE: vertical list ---- */}
      <div className="block md:hidden divide-y divide-border">
        {milestones.map((ms) => {
          const barEnd = parseISO(ms.target_date);
          const leftPct = 0;
          const widthPct = Math.max(pct(differenceInCalendarDays(barEnd, projectStart), totalDays), 8);

          return (
            <div key={ms.id} className="px-4 py-3 space-y-2">
              {/* Label row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`size-2.5 rounded-full shrink-0 ${DOT_COLOR[ms.status]}`} />
                  <span className="text-sm font-medium truncate">{ms.name}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {ms.percent_complete}%
                </span>
              </div>
              {/* Mini bar */}
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${BAR_COLOR[ms.status]}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground">
                Target: {format(parseISO(ms.target_date), 'MMM d, yyyy')}
              </div>
            </div>
          );
        })}
        {milestones.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No milestones to display.
          </div>
        )}
      </div>

      {/* ---- DESKTOP: Gantt chart ---- */}
      <div className="hidden md:flex">
        {/* Left sidebar — milestone labels */}
        <div
          className="shrink-0 w-48 lg:w-56 border-r border-border bg-muted/30"
          style={{ paddingTop: `${HEADER_H}px` }}
        >
          {milestones.map((ms) => (
            <div
              key={ms.id}
              className="flex items-center gap-2 px-3 border-b border-border/50"
              style={{ height: `${ROW_H}px` }}
            >
              <span className={`size-2 rounded-full shrink-0 ${DOT_COLOR[ms.status]}`} />
              <span className="text-xs font-medium truncate">{ms.name}</span>
            </div>
          ))}
        </div>

        {/* Right side — scrollable chart area */}
        <div className="flex-1 overflow-x-auto">
          <div className="relative min-w-[500px]" style={{ height: `${chartHeight}px` }}>
            {/* Month gridlines + labels */}
            {months.map((m, i) => (
              <div key={i} className="absolute top-0 bottom-0" style={{ left: `${m.pct}%` }}>
                <div className="h-full border-l border-dashed border-border" />
                <span className="absolute top-1.5 left-1.5 text-[10px] text-muted-foreground whitespace-nowrap font-medium">
                  <span className="hidden lg:inline">{m.label}</span>
                  <span className="lg:hidden">{m.shortLabel}</span>
                </span>
              </div>
            ))}

            {/* Today marker */}
            {todayPct !== null && todayPct > 0 && todayPct < 100 && (
              <div className="absolute top-0 bottom-0 z-10" style={{ left: `${todayPct}%` }}>
                <div className="h-full border-l-2 border-dashed border-red-500" />
                <span className="absolute top-1 -translate-x-1/2 text-[10px] font-semibold text-red-600 dark:text-red-400 bg-card px-1 rounded shadow-sm">
                  Today
                </span>
              </div>
            )}

            {/* Row stripes + bars */}
            {milestones.map((ms, idx) => {
              const prevEnd = idx > 0 ? parseISO(milestones[idx - 1].target_date) : projectStart;
              const barStart = idx === 0 ? projectStart : prevEnd;
              const barEnd = parseISO(ms.target_date);
              const leftPct = pct(differenceInCalendarDays(barStart, projectStart), totalDays);
              const widthPct = Math.max(
                pct(differenceInCalendarDays(barEnd, barStart), totalDays),
                2
              );
              const top = idx * ROW_H + HEADER_H;

              return (
                <div key={ms.id}>
                  {/* Row stripe */}
                  <div
                    className={`absolute left-0 right-0 border-b border-border/40 ${idx % 2 === 0 ? 'bg-muted/20' : ''}`}
                    style={{ top: `${top}px`, height: `${ROW_H}px` }}
                  />
                  {/* Bar */}
                  <div
                    className={`absolute rounded-md ${BAR_COLOR[ms.status]} flex items-center px-2 shadow-sm cursor-default group transition-opacity hover:opacity-90`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      top: `${top + 6}px`,
                      height: `${ROW_H - 12}px`,
                    }}
                    title={`${ms.name} — ${ms.percent_complete}% complete`}
                  >
                    <span className="text-[11px] font-medium text-white truncate leading-none">
                      {ms.percent_complete}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
