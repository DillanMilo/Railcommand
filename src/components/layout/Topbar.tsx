'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Settings, LogOut, User, X, Check, Users } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProject } from '@/components/providers/ProjectProvider';
import { getActivityLog, getProfiles, getProjectMembers } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';

interface TopbarProps {
  children?: React.ReactNode;
}

function getProfileName(id: string) {
  return getProfiles().find((p) => p.id === id)?.full_name ?? 'Unknown';
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatProjectRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Topbar({ children }: TopbarProps) {
  const router = useRouter();
  const { currentProjectId, currentUserId, setCurrentUser } = useProject();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const recentActivity = getActivityLog(currentProjectId).slice(0, 5);

  const allProfiles = getProfiles();
  const currentProfile = allProfiles.find((p) => p.id === currentUserId);
  const projectMembers = getProjectMembers(currentProjectId);
  const currentMembership = projectMembers.find((m) => m.profile_id === currentUserId);

  const searchResults = searchQuery.trim()
    ? [
        { label: 'Submittals', href: `/projects/${currentProjectId}/submittals` },
        { label: 'RFIs', href: `/projects/${currentProjectId}/rfis` },
        { label: 'Daily Logs', href: `/projects/${currentProjectId}/daily-logs` },
        { label: 'Punch List', href: `/projects/${currentProjectId}/punch-list` },
        { label: 'Schedule', href: `/projects/${currentProjectId}/schedule` },
        { label: 'Team', href: `/projects/${currentProjectId}/team` },
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
            <SheetContent className="w-full max-w-[360px] sm:max-w-[400px]">
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
                    {currentProfile ? getInitials(currentProfile.full_name) : '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium leading-tight">{currentProfile?.full_name ?? 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {currentMembership ? formatProjectRole(currentMembership.project_role) : 'No Role'}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>
                <p className="font-medium">{currentProfile?.full_name ?? 'Unknown'}</p>
                <p className="text-xs text-muted-foreground font-normal">
                  {currentProfile?.email ?? ''}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings/profile')}>
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                <Users className="size-3" />
                Switch User (Demo)
              </DropdownMenuLabel>
              {allProfiles.map((p) => {
                const mem = projectMembers.find((m) => m.profile_id === p.id);
                return (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => setCurrentUser(p.id)}
                    className={cn('cursor-pointer', p.id === currentUserId && 'bg-accent')}
                  >
                    <div className="flex items-center gap-2 w-full min-w-0">
                      <Avatar className="size-6 shrink-0">
                        <AvatarFallback className="bg-rc-slate text-white text-[10px] font-semibold">
                          {getInitials(p.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{p.full_name}</span>
                      {mem ? (
                        <Badge variant="secondary" className="text-[10px] ml-auto shrink-0 px-1.5 py-0">
                          {formatProjectRole(mem.project_role)}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                          Not on project
                        </span>
                      )}
                      {p.id === currentUserId && <Check className="size-3.5 shrink-0 text-rc-emerald" />}
                    </div>
                  </DropdownMenuItem>
                );
              })}
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-9"
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
