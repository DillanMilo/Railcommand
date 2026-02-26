'use client';

import { Bell, Search, Settings, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopbarProps {
  children?: React.ReactNode;
}

export default function Topbar({ children }: TopbarProps) {
  return (
    <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-white border-b border-rc-border shrink-0">
      {/* Left: Breadcrumbs slot */}
      <div className="flex items-center min-w-0">{children}</div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {/* Search */}
        <Button variant="ghost" size="icon" className="text-rc-steel" aria-label="Search">
          <Search className="size-5" />
        </Button>

        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative text-rc-steel" aria-label="Notifications">
          <Bell className="size-5" />
          <span className="absolute top-1.5 right-1.5 flex items-center justify-center size-4 rounded-full bg-rc-red text-white text-[10px] font-bold leading-none">
            3
          </span>
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 h-11 px-2 rounded-lg hover:bg-accent transition-colors focus:outline-none"
              aria-label="User menu"
            >
              <Avatar>
                <AvatarFallback className="bg-rc-navy text-white text-xs font-semibold">
                  MS
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium leading-tight">Mark Sullivan</p>
                <p className="text-xs text-muted-foreground leading-tight">
                  Project Manager
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium">Mark Sullivan</p>
              <p className="text-xs text-muted-foreground font-normal">
                mark.sullivan@example.com
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
