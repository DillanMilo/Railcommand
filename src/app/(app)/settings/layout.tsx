'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Settings, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const SETTINGS_NAV = [
  { label: 'Profile', href: '/settings/profile', icon: User },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 py-2"
      >
        <ChevronLeft className="size-4" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar nav */}
        <nav className="md:w-56 shrink-0">
          <div className="flex md:flex-col gap-1 p-1 md:p-0">
            {SETTINGS_NAV.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/settings'
                  ? pathname === '/settings'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px]',
                    isActive
                      ? 'bg-rc-orange/10 text-rc-orange dark:bg-rc-orange/15'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
