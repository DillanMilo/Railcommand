'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileCheck,
  MessageSquareMore,
  CalendarDays,
  ClipboardCheck,
  GanttChart,
  Users,
  MoreHorizontal,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const MOBILE_TABS = [
  { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Submittals', href: '/projects/proj-001/submittals', Icon: FileCheck },
  { label: 'RFIs', href: '/projects/proj-001/rfis', Icon: MessageSquareMore },
  { label: 'Logs', href: '/projects/proj-001/daily-logs', Icon: CalendarDays },
  { label: 'More', href: '#more', Icon: MoreHorizontal },
] as const;

const MORE_ITEMS = [
  { label: 'Punch List', href: '/projects/proj-001/punch-list', Icon: ClipboardCheck },
  { label: 'Schedule', href: '/projects/proj-001/schedule', Icon: GanttChart },
  { label: 'Team', href: '/projects/proj-001/team', Icon: Users },
];

export default function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-rc-card border-t border-rc-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around">
        {MOBILE_TABS.map(({ label, href, Icon }) => {
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
                    {MORE_ITEMS.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(item.href + '/');
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

          const isActive = pathname === href || pathname.startsWith(href + '/');

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
