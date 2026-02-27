'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Settings, LogOut, User, X } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import ThemeToggle from './ThemeToggle';
import { getActivityLog, seedProfiles } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';

interface TopbarProps {
  children?: React.ReactNode;
}

function getProfileName(id: string) {
  return seedProfiles.find((p) => p.id === id)?.full_name ?? 'Unknown';
}

export default function Topbar({ children }: TopbarProps) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const recentActivity = getActivityLog().slice(0, 5);

  const searchResults = searchQuery.trim()
    ? [
        { label: 'Submittals', href: '/projects/proj-001/submittals' },
        { label: 'RFIs', href: '/projects/proj-001/rfis' },
        { label: 'Daily Logs', href: '/projects/proj-001/daily-logs' },
        { label: 'Punch List', href: '/projects/proj-001/punch-list' },
        { label: 'Schedule', href: '/projects/proj-001/schedule' },
        { label: 'Team', href: '/projects/proj-001/team' },
        { label: 'Dashboard', href: '/dashboard' },
      ].filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  function handleSignOut() {
    router.push('/login');
  }

  return (
    <>
      <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-rc-card border-b border-rc-border shrink-0">
        {/* Left: Breadcrumbs slot */}
        <div className="flex items-center min-w-0">{children}</div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {/* Search */}
          <Button
            variant="ghost"
            size="icon"
            className="text-rc-steel"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-5" />
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-rc-steel" aria-label="Notifications">
                <Bell className="size-5" />
                {recentActivity.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex items-center justify-center size-4 rounded-full bg-rc-red text-white text-[10px] font-bold leading-none">
                    {Math.min(recentActivity.length, 9)}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[360px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Notifications</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="rounded-lg border p-3 space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">{getProfileName(activity.performed_by)}</span>{' '}
                      <span className="text-muted-foreground">{activity.description}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No recent notifications</p>
                )}
              </div>
            </SheetContent>
          </Sheet>

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
                  mark.sullivan@a5rail.com
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard')}>
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search pages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                  onClick={() => setSearchQuery('')}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-1">
                {searchResults.map((result) => (
                  <button
                    key={result.href}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm transition-colors"
                    onClick={() => {
                      router.push(result.href);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    {result.label}
                  </button>
                ))}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No results found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
