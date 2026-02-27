import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import type { Action } from '@/lib/permissions';
import {
  CalendarPlus,
  MessageSquarePlus,
  FilePlus,
  ClipboardPlus,
  type LucideIcon,
} from 'lucide-react';

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: Action;
}

interface QuickActionsProps {
  projectId: string;
}

export default function QuickActions({ projectId }: QuickActionsProps) {
  const { can } = usePermissions(projectId);

  const actions: QuickAction[] = [
    {
      label: 'New Daily Log',
      href: `/projects/${projectId}/daily-logs/new`,
      icon: CalendarPlus,
      permission: ACTIONS.DAILY_LOG_CREATE,
    },
    {
      label: 'New RFI',
      href: `/projects/${projectId}/rfis/new`,
      icon: MessageSquarePlus,
      permission: ACTIONS.RFI_CREATE,
    },
    {
      label: 'New Submittal',
      href: `/projects/${projectId}/submittals/new`,
      icon: FilePlus,
      permission: ACTIONS.SUBMITTAL_CREATE,
    },
    {
      label: 'New Punch Item',
      href: `/projects/${projectId}/punch-list/new`,
      icon: ClipboardPlus,
      permission: ACTIONS.PUNCH_LIST_CREATE,
    },
  ];

  const visibleActions = actions.filter((action) => can(action.permission));

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b pb-4 pt-5">
        <CardTitle className="font-heading text-base font-semibold">
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 sm:p-4">
        {visibleActions.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {visibleActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex flex-col items-center gap-1.5 sm:gap-2 rounded-lg border border-rc-border bg-rc-card p-3 sm:p-4 text-center transition-all hover:border-rc-orange hover:shadow-sm active:scale-[0.98] group"
                >
                  <div className="flex items-center justify-center rounded-lg bg-rc-bg p-2 group-hover:bg-rc-orange/10 transition-colors">
                    <Icon className="size-5 text-rc-steel group-hover:text-rc-orange transition-colors" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-foreground leading-tight">{action.label}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No quick actions available for your role
          </p>
        )}
      </CardContent>
    </Card>
  );
}
