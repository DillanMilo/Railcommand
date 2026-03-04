'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Search, Settings, LogOut, User, X, Check, ChevronDown, Plus, Train } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
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
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useProject } from '@/components/providers/ProjectProvider';
import NewProjectDialog from '@/components/projects/NewProjectDialog';
import { getProfiles } from '@/lib/store';
import { getMyProfile } from '@/lib/actions/profiles';
import { useActivityLog, useProjectMembers } from '@/hooks/useData';
import { formatDistanceToNow } from 'date-fns';
import type { Project, Profile } from '@/lib/types';

const STATUS_DOT_COLORS: Record<Project['status'], string> = {
  active: 'bg-rc-emerald',
  on_hold: 'bg-amber-400',
  completed: 'bg-gray-400',
  archived: 'bg-slate-500',
};

interface TopbarProps {
  children?: React.ReactNode;
}

function getProfileName(id: string, performedByProfile?: { full_name?: string } | null, demo?: boolean) {
  if (performedByProfile?.full_name) return performedByProfile.full_name;
  if (demo) return getProfiles().find((p) => p.id === id)?.full_name ?? 'Unknown';
  return 'Unknown';
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatProjectRole(role: string): string {
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Topbar({ children }: TopbarProps) {
  const router = useRouter();
  const { currentProject, currentProjectId, projects, setCurrentProjectId, currentUserId, isDemo } = useProject();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [authProfile, setAuthProfile] = useState<Profile | null>(null);

  const activeProjects = projects.filter((p) => p.status === 'active' || p.status === 'on_hold');
  const inactiveProjects = projects.filter((p) => p.status === 'completed' || p.status === 'archived');
  const { data: recentActivity } = useActivityLog(currentProjectId, 5);
  const { data: projectMembersData } = useProjectMembers(currentProjectId);

  // For real auth users, fetch profile from Supabase
  useEffect(() => {
    if (isDemo) return;
    getMyProfile().then((result) => {
      if (result.data) setAuthProfile(result.data);
    });
  }, [isDemo]);

  const currentProfile = isDemo
    ? getProfiles().find((p) => p.id === currentUserId) ?? null
    : authProfile;
  const currentMembership = projectMembersData.find((m) => m.profile_id === currentUserId);

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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Clear demo mode state
    try {
      localStorage.removeItem('rc-mode');
      localStorage.removeItem('rc-user-name');
      localStorage.removeItem('rc-user-email');
      localStorage.removeItem('rc-current-project');
      document.cookie = 'rc-mode=; path=/; max-age=0';
      document.cookie = 'rc-remember=; path=/; max-age=0';
    } catch { /* noop */ }
    router.push('/login');
  }

  return (
    <>
      <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-rc-card border-b border-rc-border shrink-0">
        {/* Left: Mobile project switcher + Breadcrumbs slot */}
        <div className="flex items-center min-w-0 gap-2">
          {/* Mobile project switcher - hidden on desktop where sidebar handles it */}
          <div className="md:hidden shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-rc-navy text-white text-sm font-medium hover:bg-rc-navy/90 transition-colors">
                <Train className="size-4 shrink-0" />
                <span className="max-w-[120px] truncate">
                  {currentProject?.name ?? 'Select'}
                </span>
                <ChevronDown className="size-3.5 shrink-0 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {activeProjects.length > 0 && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Active Projects
                    </DropdownMenuLabel>
                    {activeProjects.map((project) => (
                      <DropdownMenuItem
                        key={project.id}
                        onClick={() => {
                          setCurrentProjectId(project.id);
                          router.push(`/projects/${project.id}/submittals`);
                        }}
                        className="flex items-center gap-2"
                      >
                        <span className={cn('size-2 rounded-full shrink-0', STATUS_DOT_COLORS[project.status])} />
                        <span className="truncate">{project.name}</span>
                        {project.id === currentProjectId && (
                          <Check className="size-4 text-rc-orange shrink-0 ml-auto" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                )}
                {inactiveProjects.length > 0 && (
                  <>
                    {activeProjects.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Completed / Archived
                      </DropdownMenuLabel>
                      {inactiveProjects.map((project) => (
                        <DropdownMenuItem
                          key={project.id}
                          onClick={() => {
                            setCurrentProjectId(project.id);
                            router.push(`/projects/${project.id}/submittals`);
                          }}
                          className="flex items-center gap-2"
                        >
                          <span className={cn('size-2 rounded-full shrink-0', STATUS_DOT_COLORS[project.status])} />
                          <span className="truncate">{project.name}</span>
                          {project.id === currentProjectId && (
                            <Check className="size-4 text-rc-orange shrink-0 ml-auto" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  </>
                )}
                {projects.length === 0 && (
                  <div className="px-2 py-3 text-center text-sm text-muted-foreground">No projects yet</div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setNewProjectOpen(true)}>
                  <Plus className="size-4" />
                  New Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {children}
        </div>

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
                      <span className="font-medium">{getProfileName(activity.performed_by, activity.performed_by_profile, isDemo)}</span>{' '}
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
                    {currentProfile?.full_name ? getInitials(currentProfile.full_name) : '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium leading-tight">
                    {currentProfile?.full_name || currentProfile?.email || 'New User'}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {currentMembership ? formatProjectRole(currentMembership.project_role) : (currentProfile?.role ? formatProjectRole(currentProfile.role) : 'No Role')}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <p className="font-medium">{currentProfile?.full_name || currentProfile?.email || 'New User'}</p>
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

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </>
  );
}
