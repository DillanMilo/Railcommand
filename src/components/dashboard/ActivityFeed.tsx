'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getActivityLog, seedProfiles } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';
import {
  FileCheck,
  MessageSquareMore,
  CalendarDays,
  ClipboardCheck,
  Flag,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const entityConfig: Record<string, { icon: typeof FileCheck; dotColor: string }> = {
  submittal: { icon: FileCheck, dotColor: 'bg-rc-blue' },
  rfi: { icon: MessageSquareMore, dotColor: 'bg-rc-orange' },
  daily_log: { icon: CalendarDays, dotColor: 'bg-rc-emerald' },
  punch_list: { icon: ClipboardCheck, dotColor: 'bg-rc-red' },
  milestone: { icon: Flag, dotColor: 'bg-rc-amber' },
  project: { icon: Activity, dotColor: 'bg-rc-steel' },
};

function getProfileName(profileId: string): string {
  const profile = seedProfiles.find((p) => p.id === profileId);
  return profile?.full_name ?? 'Unknown';
}

export default function ActivityFeed() {
  const recentActivities = [...getActivityLog()]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b pb-4 pt-5">
        <CardTitle className="font-heading text-base font-semibold">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[420px] overflow-y-auto">
          {recentActivities.map((activity) => {
            const config = entityConfig[activity.entity_type] ?? entityConfig.project;
            const Icon = config.icon;
            const timeAgo = formatDistanceToNow(new Date(activity.created_at), {
              addSuffix: true,
            });

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 border-b last:border-b-0 px-5 py-3"
              >
                <div className="mt-1.5 shrink-0">
                  <div className={cn('size-2 rounded-full', config.dotColor)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">
                      {getProfileName(activity.performed_by)}
                    </span>{' '}
                    <span className="text-rc-steel">{activity.description}</span>
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-rc-steel">
                    <Icon className="size-3" />
                    <span>{timeAgo}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t px-5 py-3">
          <Link
            href="/projects/proj-001/daily-logs"
            className="text-sm font-medium text-rc-orange hover:text-rc-orange-dark transition-colors"
          >
            View all activity
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
