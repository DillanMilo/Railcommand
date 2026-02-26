'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from '@/lib/constants';
import {
  LayoutDashboard,
  FileCheck,
  MessageSquareMore,
  CalendarDays,
  ClipboardCheck,
  GanttChart,
  Users,
  Train,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FileCheck,
  MessageSquareMore,
  ClipboardList: CalendarDays,
  ListChecks: ClipboardCheck,
  CalendarRange: GanttChart,
  Users,
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-rc-navy text-white transition-all duration-300 ease-in-out h-screen sticky top-0',
        collapsed ? 'w-[72px]' : 'w-[260px]'
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
        <div className="flex items-center justify-center size-9 rounded-lg bg-rc-orange shrink-0">
          <Train className="size-5 text-white" />
        </div>
        {!collapsed && (
          <span className="font-heading font-bold text-lg tracking-tight whitespace-nowrap">
            RailCommand
          </span>
        )}
      </div>

      {/* Project Name */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-white/10 shrink-0">
          <p className="text-[11px] uppercase tracking-wider text-white/40 font-medium">
            Project
          </p>
          <p className="text-sm text-white/80 truncate mt-0.5">
            Englewood Yard Expansion
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon];
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');

          const link = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 h-11 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-rc-orange text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              {Icon && (
                <Icon className="size-5 shrink-0" />
              )}
              {!collapsed && (
                <span className="truncate">{item.label}</span>
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return link;
        })}
      </nav>

      {/* US Data Only Badge */}
      {!collapsed && (
        <div className="px-4 py-2 shrink-0">
          <div className="flex items-center gap-1.5 text-white/40">
            <ShieldCheck className="size-3.5 shrink-0" />
            <span className="text-[11px] font-medium">US Data Only</span>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <div className="px-2 py-3 border-t border-white/10 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full h-11 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5" />
          ) : (
            <PanelLeftClose className="size-5" />
          )}
        </button>
      </div>
    </aside>
  );
}
