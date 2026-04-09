'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bell, BellOff, Search, Settings, LogOut, User, Check, ChevronDown, Plus, FileCheck, MessageSquareMore, ClipboardCheck, CalendarDays, GanttChart, FolderKanban, Sparkles, CheckCheck } from 'lucide-react';
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
import ThemeToggle from './ThemeToggle';
import GlobalSearch from '@/components/shared/GlobalSearch';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { useProject } from '@/components/providers/ProjectProvider';
import NewProjectDialog from '@/components/projects/NewProjectDialog';
import { getProfiles } from '@/lib/store';
import { getMyProfile } from '@/lib/actions/profiles';
import { useActivityLog, useProjectMembers } from '@/hooks/useData';
import { formatDistanceToNow } from 'date-fns';
import { PATCH_NOTES } from '@/lib/patch-notes';
import type { Project, Profile, ActivityLogEntry } from '@/lib/types';

type EntityType = ActivityLogEntry['entity_type'];

const ENTITY_ICONS: Record<EntityType, typeof FileCheck> = {
  submittal: FileCheck,
  rfi: MessageSquareMore,
  punch_list: ClipboardCheck,
  daily_log: CalendarDays,
  milestone: GanttChart,
  project: FolderKanban,
};

const ENTITY_LABELS: Record<EntityType, string> = {
  submittal: 'Submittal',
  rfi: 'RFI',
  punch_list: 'Punch',
  daily_log: 'Daily Log',
  milestone: 'Milestone',
  project: 'Project',
};

const STATUS_DOT_COLORS: Record<Project['status'], string> = {
  active: 'bg-rc-emerald',
  on_hold: 'bg-amber-400',
  completed: 'bg-gray-400',
  archived: 'bg-slate-500',
};

const LS_KEY = 'rc-read-notifications';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* noop */ }
  return new Set();
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch { /* noop */ }
}

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

type UnifiedItem =
  | { type: 'activity'; id: string; date: string; activity: ActivityLogEntry }
  | { type: 'patch_note'; id: string; date: string; version: string; title: string; description: string };

export default function Topbar({ children }: TopbarProps) {
  const router = useRouter();
  const { currentProject, currentProjectId, projects, setCurrentProjectId, currentUserId, isDemo } = useProject();
  const [searchOpen, setSearchOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [authProfile, setAuthProfile] = useState<Profile | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Load read IDs from localStorage on mount
  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback((ids: string[]) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      saveReadIds(next);
      return next;
    });
  }, []);

  function getActivityHref(
    entity_type: EntityType,
    entity_id: string,
    project_id: string | null | undefined
  ): string | null {
    if (!project_id) return null;
    switch (entity_type) {
      case 'submittal':
        return `/projects/${project_id}/submittals/${entity_id}`;
      case 'rfi':
        return `/projects/${project_id}/rfis/${entity_id}`;
      case 'daily_log':
        return `/projects/${project_id}/daily-logs/${entity_id}`;
      case 'punch_list':
        return `/projects/${project_id}/punch-list/${entity_id}`;
      case 'milestone':
        return `/projects/${project_id}/schedule`;
      case 'project':
        return `/dashboard`;
      default:
        return null;
    }
  }

  const activeProjects = projects.filter((p) => p.status === 'active' || p.status === 'on_hold');
  const inactiveProjects = projects.filter((p) => p.status === 'completed' || p.status === 'archived');
  const { data: recentActivity } = useActivityLog(currentProjectId, 5);
  const { data: projectMembersData } = useProjectMembers(currentProjectId);

  // Build unified notification list: activity + patch notes, sorted by date desc
  const unifiedItems = useMemo<UnifiedItem[]>(() => {
    const items: UnifiedItem[] = [];

    // Activity items
    for (const a of recentActivity) {
      items.push({ type: 'activity', id: a.id, date: a.created_at, activity: a });
    }

    // Patch notes
    for (const p of PATCH_NOTES) {
      items.push({
        type: 'patch_note',
        id: p.id,
        date: p.date,
        version: p.version,
        title: p.title,
        description: p.description,
      });
    }

    // Sort most recent first
    items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return items.slice(0, 15);
  }, [recentActivity]);

  // Compute unread count
  const unreadCount = useMemo(() => {
    return unifiedItems.filter((item) => !readIds.has(item.id)).length;
  }, [unifiedItems, readIds]);

  // Split items for group headers
  const patchNoteItems = useMemo(() => unifiedItems.filter((i) => i.type === 'patch_note'), [unifiedItems]);
  const activityItems = useMemo(() => unifiedItems.filter((i) => i.type === 'activity'), [unifiedItems]);
  const hasBothGroups = patchNoteItems.length > 0 && activityItems.length > 0;

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

  // Cmd+K / Ctrl+K keyboard shortcut to open global search
  // Cmd+Shift+F / Ctrl+Shift+F to navigate to full search page
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        router.push('/search');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [router]);

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

  // Determine if the notification panel has any content to show
  const hasNotifications = unifiedItems.length > 0;
  // If no project is selected, we still show patch notes
  const showEmptyProjectState = !currentProjectId && patchNoteItems.length === 0;
  const showAllCaughtUp = currentProjectId && !hasNotifications;

  return (
    <>
      <header className="flex items-center justify-between h-16 px-4 md:px-6 bg-rc-card border-b border-rc-border shrink-0">
        {/* Left: Mobile project switcher + Breadcrumbs slot */}
        <div className="flex items-center min-w-0 gap-2">
          {/* Mobile project switcher - hidden on desktop where sidebar handles it */}
          <div className="md:hidden shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg bg-rc-navy text-white text-sm font-medium hover:bg-rc-navy/90 transition-colors">
                <Image src="/IMG_0936.jpg" alt="RailCommand" width={20} height={20} className="rounded-sm shrink-0" />
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
            className="text-rc-steel gap-2 hidden md:inline-flex"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-4" />
            <span className="text-sm text-muted-foreground">Search...</span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-rc-steel md:hidden"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="size-5" />
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-rc-steel" aria-label="Notifications">
                <Bell className="size-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rc-red text-white text-[10px] font-bold leading-none ring-2 ring-rc-card">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-[360px] sm:max-w-[400px] flex flex-col">
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>Notifications</SheetTitle>
                  {hasNotifications && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground h-8 gap-1.5 text-xs"
                      onClick={() => markAllAsRead(unifiedItems.map((i) => i.id))}
                    >
                      <CheckCheck className="size-3.5" />
                      <span className="hidden sm:inline">Mark all as read</span>
                    </Button>
                  )}
                </div>
              </SheetHeader>
              <div className="mt-4 space-y-2 flex-1 overflow-y-auto">
                {showEmptyProjectState && (
                  <div className="flex flex-col items-center justify-center text-center py-12 gap-2">
                    <BellOff className="size-8 text-muted-foreground/60" />
                    <p className="text-sm text-muted-foreground">Select a project to see notifications</p>
                  </div>
                )}
                {showAllCaughtUp && (
                  <div className="flex flex-col items-center justify-center text-center py-12 gap-2">
                    <BellOff className="size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">You&apos;re all caught up</p>
                    <p className="text-xs text-muted-foreground">New activity will show up here.</p>
                  </div>
                )}

                {/* Patch notes group */}
                {patchNoteItems.length > 0 && (
                  <>
                    {hasBothGroups && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-1 pb-0.5">
                        Updates
                      </p>
                    )}
                    {patchNoteItems.map((item) => {
                      if (item.type !== 'patch_note') return null;
                      const isRead = readIds.has(item.id);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'relative rounded-lg border p-3 border-l-[3px] border-l-rc-orange/60 transition-colors',
                            isRead ? 'opacity-60' : ''
                          )}
                        >
                          {/* Unread dot */}
                          {!isRead && (
                            <span className="absolute left-[-9px] top-3.5 size-2 rounded-full bg-blue-500" />
                          )}
                          <div className="flex gap-3">
                            <div className="shrink-0 mt-0.5">
                              <div className="flex items-center justify-center size-8 rounded-md bg-rc-orange/10 text-rc-orange">
                                <Sparkles className="size-4" />
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-rc-orange/15 text-rc-orange px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
                                  v{item.version}
                                </span>
                                {!isRead && (
                                  <button
                                    type="button"
                                    onClick={() => markAsRead(item.id)}
                                    className="ml-auto text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
                                    aria-label="Mark as read"
                                    title="Mark as read"
                                  >
                                    <Check className="size-3.5" />
                                  </button>
                                )}
                              </div>
                              <p className="text-sm font-medium leading-snug">{item.title}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                                {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Activity group */}
                {activityItems.length > 0 && (
                  <>
                    {hasBothGroups && (
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pt-2 pb-0.5">
                        Activity
                      </p>
                    )}
                    {activityItems.map((item) => {
                      if (item.type !== 'activity') return null;
                      const { activity } = item;
                      const isRead = readIds.has(item.id);
                      const href = getActivityHref(
                        activity.entity_type,
                        activity.entity_id,
                        activity.project_id ?? currentProjectId
                      );
                      const Icon = ENTITY_ICONS[activity.entity_type] ?? Bell;
                      const label = ENTITY_LABELS[activity.entity_type] ?? 'Activity';
                      const actorName = getProfileName(activity.performed_by, activity.performed_by_profile, isDemo);

                      const content = (
                        <div className="flex gap-3">
                          <div className="shrink-0 mt-0.5">
                            <div className="flex items-center justify-center size-8 rounded-md bg-rc-navy/10 text-rc-navy dark:bg-rc-navy/30 dark:text-white">
                              <Icon className="size-4" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {label}
                              </span>
                            </div>
                            <p className="text-sm leading-snug">
                              <span className="font-medium">{actorName}</span>{' '}
                              <span className="text-muted-foreground">{activity.description}</span>
                            </p>
                            <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );

                      if (href) {
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              markAsRead(item.id);
                              setNotificationsOpen(false);
                              router.push(href);
                            }}
                            className={cn(
                              'relative w-full text-left rounded-lg border p-3 cursor-pointer hover:bg-accent hover:border-rc-navy/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-rc-navy',
                              isRead ? 'opacity-60' : ''
                            )}
                          >
                            {!isRead && (
                              <span className="absolute left-[-1px] top-3.5 size-2 rounded-full bg-blue-500" />
                            )}
                            {content}
                          </button>
                        );
                      }

                      return (
                        <div
                          key={item.id}
                          className={cn('relative rounded-lg border p-3', isRead ? 'opacity-60' : '')}
                        >
                          {!isRead && (
                            <span className="absolute left-[-1px] top-3.5 size-2 rounded-full bg-blue-500" />
                          )}
                          {content}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
              {currentProjectId && activityItems.length > 0 && (
                <div className="pt-3 mt-2 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false);
                      router.push('/dashboard');
                    }}
                    className="w-full text-center text-xs font-medium text-rc-navy dark:text-rc-orange hover:underline py-1"
                  >
                    View all activity
                  </button>
                </div>
              )}
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

      {/* Global Search Command Palette */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
    </>
  );
}
