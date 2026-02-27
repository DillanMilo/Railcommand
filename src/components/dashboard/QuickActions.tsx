import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
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
}

const actions: QuickAction[] = [
  {
    label: 'New Daily Log',
    href: '/projects/proj-001/daily-logs/new',
    icon: CalendarPlus,
  },
  {
    label: 'New RFI',
    href: '/projects/proj-001/rfis/new',
    icon: MessageSquarePlus,
  },
  {
    label: 'New Submittal',
    href: '/projects/proj-001/submittals/new',
    icon: FilePlus,
  },
  {
    label: 'New Punch Item',
    href: '/projects/proj-001/punch-list/new',
    icon: ClipboardPlus,
  },
];

export default function QuickActions() {
  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b pb-4 pt-5">
        <CardTitle className="font-heading text-base font-semibold">
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className="flex flex-col items-center gap-2 rounded-lg border border-rc-border bg-rc-card p-4 text-center transition-all hover:border-rc-orange hover:shadow-sm group"
              >
                <div className="flex items-center justify-center rounded-lg bg-rc-bg p-2 group-hover:bg-rc-orange/10 transition-colors">
                  <Icon className="size-5 text-rc-steel group-hover:text-rc-orange transition-colors" />
                </div>
                <span className="text-sm font-medium text-foreground">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
