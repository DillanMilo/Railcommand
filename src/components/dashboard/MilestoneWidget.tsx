'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import StatusBadge from '@/components/shared/StatusBadge';
import { getMilestones } from '@/lib/store';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const progressColorMap: Record<string, string> = {
  on_track: '[&>[data-slot=progress-indicator]]:bg-rc-emerald',
  complete: '[&>[data-slot=progress-indicator]]:bg-rc-emerald',
  at_risk: '[&>[data-slot=progress-indicator]]:bg-rc-amber',
  behind: '[&>[data-slot=progress-indicator]]:bg-rc-red',
  not_started: '[&>[data-slot=progress-indicator]]:bg-rc-steel',
};

interface MilestoneWidgetProps {
  projectId: string;
}

export default function MilestoneWidget({ projectId }: MilestoneWidgetProps) {
  const sortedMilestones = [...getMilestones(projectId)].sort(
    (a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime()
  );

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b pb-4 pt-5">
        <CardTitle className="font-heading text-base font-semibold">
          Milestones
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[320px] sm:max-h-[380px] overflow-y-auto">
          {sortedMilestones.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No milestones yet.</p>
          )}
          {sortedMilestones.map((milestone) => {
            const barColor = progressColorMap[milestone.status] ?? progressColorMap.not_started;

            return (
              <div
                key={milestone.id}
                className="border-b last:border-b-0 px-3 sm:px-5 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug truncate">
                    {milestone.name}
                  </p>
                  <StatusBadge status={milestone.status} type="milestone" />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-rc-steel">
                  <span>Target: {format(parseISO(milestone.target_date), 'MMM d, yyyy')}</span>
                  {milestone.actual_date && (
                    <span>Actual: {format(parseISO(milestone.actual_date), 'MMM d, yyyy')}</span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Progress
                    value={milestone.percent_complete}
                    className={cn('h-1.5 flex-1', barColor)}
                  />
                  <span className="text-xs font-medium text-rc-steel min-w-[2rem] text-right">
                    {milestone.percent_complete}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
