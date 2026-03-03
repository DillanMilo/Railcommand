'use client';

import { useSyncExternalStore } from 'react';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import type { Milestone, MilestoneStatus } from '@/lib/types';

const TIMELINE_BAR_COLOR: Record<MilestoneStatus, string> = {
  on_track: 'bg-emerald-500/80',
  complete: 'bg-emerald-600',
  at_risk: 'bg-amber-500/80',
  behind: 'bg-red-500/80',
  not_started: 'bg-gray-300',
};

// useSyncExternalStore provides a clean way to differ between server and client
const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
function useIsMounted() {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}

interface TimelineViewProps {
  milestones: Milestone[];
  startDate: string;
  endDate: string;
}

export default function TimelineView({ milestones, startDate, endDate }: TimelineViewProps) {
  const projectStart = parseISO(startDate);
  const projectEnd = parseISO(endDate);
  const totalDays = differenceInCalendarDays(projectEnd, projectStart);
  const isMounted = useIsMounted();

  // Only compute "today" on the client to avoid hydration mismatch
  const todayPct = isMounted
    ? Math.min(Math.max((differenceInCalendarDays(new Date(), projectStart) / totalDays) * 100, 0), 100)
    : null;

  // generate month labels
  const months: { label: string; pct: number }[] = [];
  const cursor = new Date(projectStart);
  cursor.setDate(1);
  while (cursor <= projectEnd) {
    const pct = (differenceInCalendarDays(cursor, projectStart) / totalDays) * 100;
    if (pct >= 0) months.push({ label: format(cursor, 'MMM yyyy'), pct: Math.max(pct, 0) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="overflow-x-auto pb-4 -mx-1 px-1">
      <p className="text-xs text-muted-foreground mb-2 lg:hidden">Scroll horizontally to view full timeline</p>
      <div className="relative min-w-[700px]" style={{ height: `${milestones.length * 52 + 60}px` }}>
        {/* month gridlines + labels */}
        {months.map((m, i) => (
          <div key={i} className="absolute top-0 bottom-0" style={{ left: `${m.pct}%` }}>
            <div className="h-full border-l border-dashed border-gray-200" />
            <span className="absolute top-0 left-1 text-[10px] text-muted-foreground whitespace-nowrap">
              {m.label}
            </span>
          </div>
        ))}

        {/* today marker (client-only to avoid hydration mismatch) */}
        {todayPct !== null && (
          <div className="absolute top-0 bottom-0 z-10" style={{ left: `${todayPct}%` }}>
            <div className="h-full border-l-2 border-dashed border-red-500" />
            <span className="absolute -top-0.5 -translate-x-1/2 text-[10px] font-semibold text-red-600 bg-rc-card px-1 rounded">
              Today
            </span>
          </div>
        )}

        {/* milestone bars */}
        {milestones.map((ms, idx) => {
          const prevEnd = idx > 0 ? parseISO(milestones[idx - 1].target_date) : projectStart;
          const barStart = idx === 0 ? projectStart : prevEnd;
          const barEnd = parseISO(ms.target_date);
          const leftPct = Math.max(
            (differenceInCalendarDays(barStart, projectStart) / totalDays) * 100, 0
          );
          const widthPct = Math.max(
            (differenceInCalendarDays(barEnd, barStart) / totalDays) * 100, 2
          );
          const top = idx * 52 + 28;

          return (
            <div
              key={ms.id}
              className={`absolute rounded ${TIMELINE_BAR_COLOR[ms.status]} flex items-center px-2 shadow-sm`}
              style={{ left: `${leftPct}%`, width: `${widthPct}%`, top: `${top}px`, height: '36px' }}
            >
              <span className="text-[11px] font-medium text-white truncate">
                {ms.name} ({ms.percent_complete}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
