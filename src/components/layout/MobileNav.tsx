'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useProject } from '@/components/providers/ProjectProvider';
import {
  LayoutDashboard,
  FileCheck,
  MessageSquareMore,
  CalendarDays,
  ClipboardCheck,
  GanttChart,
  Users,
  MoreHorizontal,
  ShieldAlert,
  FileBarChart,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

export default function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { currentProjectId } = useProject();

  const hasProject = Boolean(currentProjectId);

  const mobileTabs = [
    { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard, requiresProject: false },
    { label: 'Submittals', href: hasProject ? `/projects/${currentProjectId}/submittals` : '#', Icon: FileCheck, requiresProject: true },
    { label: 'RFIs', href: hasProject ? `/projects/${currentProjectId}/rfis` : '#', Icon: MessageSquareMore, requiresProject: true },
    { label: 'Logs', href: hasProject ? `/projects/${currentProjectId}/daily-logs` : '#', Icon: CalendarDays, requiresProject: true },
    { label: 'More', href: '#more', Icon: MoreHorizontal, requiresProject: false },
  ];

  const moreItems = [
    { label: 'Punch List', href: hasProject ? `/projects/${currentProjectId}/punch-list` : '#', Icon: ClipboardCheck, requiresProject: true },
    { label: 'Safety', href: hasProject ? `/projects/${currentProjectId}/safety` : '#', Icon: ShieldAlert, requiresProject: true },
    { label: 'Reports', href: hasProject ? `/projects/${currentProjectId}/weekly-reports` : '#', Icon: FileBarChart, requiresProject: true },
    { label: 'Schedule', href: hasProject ? `/projects/${currentProjectId}/schedule` : '#', Icon: GanttChart, requiresProject: true },
    { label: 'Team', href: hasProject ? `/projects/${currentProjectId}/team` : '#', Icon: Users, requiresProject: true },
  ];

  const isMoreActive = moreItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-rc-card border-t border-rc-border pb-[max(8px,env(safe-area-inset-bottom))]">
      <div className="flex items-stretch justify-around">
        {mobileTabs.map(({ label, href, Icon, requiresProject }) => {
          if (href === '#more') {
            return (
              <Sheet key="more" open={moreOpen} onOpenChange={setMoreOpen}>
                <SheetTrigger asChild>
                  <button
                    className={cn(
                      'flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[44px] flex-1 pt-2 pb-1 transition-colors',
                      isMoreActive ? 'text-rc-orange' : 'text-rc-steel'
                    )}
                  >
                    <Icon className="size-6 shrink-0" />
                    <span className="text-[10px] font-medium leading-tight">{label}</span>
                  </button>
                </SheetTrigger>
                <SheetContent side="bottom" className="pb-[env(safe-area-inset-bottom)]">
                  <SheetHeader>
                    <SheetTitle>More</SheetTitle>
                  </SheetHeader>
                  <div className="grid grid-cols-3 gap-4 mt-4 pb-4">
                    {moreItems.map((item) => {
                      const itemDisabled = item.requiresProject && !hasProject;
                      const active = !itemDisabled && (pathname === item.href || pathname.startsWith(item.href + '/'));

                      if (itemDisabled) {
                        return (
                          <span
                            key={item.label}
                            className="flex flex-col items-center gap-2 rounded-lg p-4 text-muted-foreground/40 cursor-not-allowed"
                          >
                            <item.Icon className="size-6" />
                            <span className="text-xs font-medium">{item.label}</span>
                          </span>
                        );
                      }

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            'flex flex-col items-center gap-2 rounded-lg p-4 transition-colors',
                            active ? 'bg-rc-orange/10 text-rc-orange' : 'hover:bg-accent text-muted-foreground'
                          )}
                        >
                          <item.Icon className="size-6" />
                          <span className="text-xs font-medium">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </SheetContent>
              </Sheet>
            );
          }

          const disabled = requiresProject && !hasProject;
          const isActive = !disabled && (pathname === href || pathname.startsWith(href + '/'));

          if (disabled) {
            return (
              <span
                key={label}
                className="flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[44px] flex-1 pt-2 pb-1 text-rc-steel/40 cursor-not-allowed"
              >
                <Icon className="size-6 shrink-0" />
                <span className="text-[10px] font-medium leading-tight">{label}</span>
              </span>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-h-[56px] min-w-[44px] flex-1 pt-2 pb-1 transition-colors',
                isActive ? 'text-rc-orange' : 'text-rc-steel'
              )}
            >
              <Icon className="size-6 shrink-0" />
              <span className="text-[10px] font-medium leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
