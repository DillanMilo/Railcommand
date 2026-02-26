'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileCheck,
  MessageSquareMore,
  CalendarDays,
  ClipboardCheck,
} from 'lucide-react';

const MOBILE_TABS = [
  { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Submittals', href: '/projects/proj-001/submittals', Icon: FileCheck },
  { label: 'RFIs', href: '/projects/proj-001/rfis', Icon: MessageSquareMore },
  { label: 'Logs', href: '/projects/proj-001/daily-logs', Icon: CalendarDays },
  { label: 'Punch', href: '/projects/proj-001/punch-list', Icon: ClipboardCheck },
] as const;

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-rc-border pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around">
        {MOBILE_TABS.map(({ label, href, Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + '/');

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
