'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Bell, BellOff, Search, Settings, LogOut, User, Check, ChevronDown, ChevronRight, Plus, FileCheck, MessageSquareMore, ClipboardCheck, CalendarDays, GanttChart, FolderKanban, Sparkles, CheckCheck, X } from 'lucide-react';
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
const LS_DISMISSED_KEY = 'rc-dismissed-notifications';

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

function loadDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DISMISSED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* noop */ }
  return new Set();
}

function saveDismissedIds(ids: Set<string>) {
  try {
    localStorage.setItem(LS_DISMISSED_KEY, JSON.stringify([...ids]));
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
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [updatesOpen, setUpdatesOpen] = useState(true);
  const [activityOpen, setActivityOpen] = useState(true);

  // Load read/dismissed IDs from localStorage on mount
  useEffect(() => {
    setReadIds(loadReadIds());
    setDismissedIds(loadDismissedIds());
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

  const dismissItem = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedIds(next);
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

  // Split items for categories, filtering out dismissed
  const patchNoteItems = useMemo(
    () => unifiedItems.filter((i) => i.type === 'patch_note' && !dismissedIds.has(i.id)),
    [unifiedItems, dismissedIds]
  );
  const activityItems = useMemo(
    () => unifiedItems.filter((i) => i.type === 'activity' && !dismissedIds.has(i.id)),
    [unifiedItems, dismissedIds]
  );

  // Unread counts per category and global (non-dismissed only)
  const updatesUnreadCount = useMemo(
    () => patchNoteItems.filter((i) => !readIds.has(i.id)).length,
    [patchNoteItems, readIds]
  );
  const activityUnreadCount = useMemo(
    () => activityItems.filter((i) => !readIds.has(i.id)).length,
    [activityItems, readIds]
  );
  const unreadCount = updatesUnreadCount + activityUnreadCount;

  // All visible (non-dismissed) items for "mark all as read"
  const allVisibleIds = useMemo(
    () => [...patchNoteItems, ...activityItems].map((i) => i.id),
    [patchNoteItems, activityItems]
  );

  // Auto-open categories when they have unread items, auto-close when all read
  useEffect(() => {
    if (updatesUnreadCount > 0) setUpdatesOpen(true);
  }, [updatesUnreadCount]);
  useEffect(() => {
    if (activityUnreadCount > 0) setActivityOpen(true);
  }, [activityUnreadCount]);

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

  // Both categories empty means full empty state
  const bothCategoriesEmpty = patchNoteItems.length === 0 && activityItems.length === 0;
  const hasAnyVisible = !bothCategoriesEmpty;

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
            <SheetContent className="w-full sm:max-w-[400px] flex flex-col p-0">
              {/* Header */}
              <div className="flex items-center justify-between px-4 pr-12 py-3 border-b gap-3">
                <SheetTitle className="text-base font-semibold">Notifications</SheetTitle>
                {hasAnyVisible && (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-foreground min-h-[44px] gap-1.5 text-xs px-3"
                    onClick={() => markAllAsRead(allVisibleIds)}
                  >
                    <CheckCheck className="size-4" />
                    <span className="hidden sm:inline">Mark all read</span>
                  </Button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Full empty state when both categories have nothing */}
                {bothCategoriesEmpty && (
                  <div className="flex flex-col items-center justify-center text-center py-16 gap-2">
                    <BellOff className="size-8 text-muted-foreground/60" />
                    <p className="text-sm font-medium">You&apos;re all caught up</p>
                    <p className="text-xs text-muted-foreground">New activity will show up here.</p>
                  </div>
                )}

                {!bothCategoriesEmpty && (
                  <>
                    {/* ── Updates category ── */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setUpdatesOpen((v) => !v)}
                        className="flex items-center w-full px-4 py-3 min-h-[44px] bg-muted/50 hover:bg-muted/80 transition-colors text-left"
                      >
                        <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', updatesOpen && 'rotate-90')} />
                        <Sparkles className="size-4 shrink-0 text-rc-orange ml-2" />
                        <span className="text-sm font-medium ml-2">Updates</span>
                        {updatesUnreadCount > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rc-orange text-white text-[10px] font-bold">
                            {updatesUnreadCount}
                          </span>
                        )}
                        <span className="ml-auto" />
                      </button>

                      <div className={cn(
                        'overflow-hidden transition-all duration-200 ease-in-out',
                        updatesOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                      )}>
                        {patchNoteItems.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-muted-foreground text-center">No updates</p>
                        ) : (
                          <div className="divide-y">
                            {patchNoteItems.map((item) => {
                              if (item.type !== 'patch_note') return null;
                              const isRead = readIds.has(item.id);
                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    'relative px-4 py-2.5 transition-colors',
                                    isRead ? 'opacity-60' : ''
                                  )}
                                >
                                  {/* Unread dot */}
                                  {!isRead && (
                                    <span className="absolute left-1 top-4 size-2 rounded-full bg-blue-500" />
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
                                      </div>
                                      <p className="text-sm font-medium leading-snug">{item.title}</p>
                                      <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                                      <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                                        {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                                      </p>
                                    </div>
                                    {/* Action buttons */}
                                    <div className="flex flex-col items-center gap-1 shrink-0 ml-1">
                                      {!isRead && (
                                        <button
                                          type="button"
                                          onClick={() => markAsRead(item.id)}
                                          className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] text-muted-foreground hover:text-foreground transition-colors rounded"
                                          aria-label="Mark as read"
                                          title="Mark as read"
                                        >
                                          <Check className="size-4" />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => dismissItem(item.id)}
                                        className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] text-muted-foreground hover:text-foreground transition-colors rounded"
                                        aria-label="Dismiss"
                                        title="Dismiss"
                                      >
                                        <X className="size-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── Activity category ── */}
                    <div>
                      <button
                        type="button"
                        onClick={() => setActivityOpen((v) => !v)}
                        className="flex items-center w-full px-4 py-3 min-h-[44px] bg-muted/50 hover:bg-muted/80 transition-colors text-left border-t"
                      >
                        <ChevronRight className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-200', activityOpen && 'rotate-90')} />
                        <Bell className="size-4 shrink-0 text-rc-navy dark:text-white ml-2" />
                        <span className="text-sm font-medium ml-2">Activity</span>
                        {activityUnreadCount > 0 && (
                          <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-rc-navy text-white text-[10px] font-bold dark:bg-white dark:text-rc-navy">
                            {activityUnreadCount}
                          </span>
                        )}
                        <span className="ml-auto" />
                      </button>

                      <div className={cn(
                        'overflow-hidden transition-all duration-200 ease-in-out',
                        activityOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
                      )}>
                        {!currentProjectId ? (
                          <p className="px-4 py-4 text-xs text-muted-foreground text-center">Select a project to see activity</p>
                        ) : activityItems.length === 0 ? (
                          <p className="px-4 py-4 text-xs text-muted-foreground text-center">No recent activity</p>
                        ) : (
                          <div className="divide-y">
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

                              return (
                                <div
                                  key={item.id}
                                  className={cn(
                                    'relative flex items-start px-4 py-2.5 transition-colors',
                                    isRead ? 'opacity-60' : '',
                                    href ? 'cursor-pointer hover:bg-accent' : ''
                                  )}
                                >
                                  {/* Unread dot */}
                                  {!isRead && (
                                    <span className="absolute left-1 top-4 size-2 rounded-full bg-blue-500" />
                                  )}
                                  <div
                                    className="flex gap-3 min-w-0 flex-1"
                                    role={href ? 'button' : undefined}
                                    tabIndex={href ? 0 : undefined}
                                    onClick={href ? () => {
                                      markAsRead(item.id);
                                      setNotificationsOpen(false);
                                      router.push(href);
                                    } : undefined}
                                    onKeyDown={href ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        markAsRead(item.id);
                                        setNotificationsOpen(false);
                                        router.push(href);
                                      }
                                    } : undefined}
                                  >
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
                                  {/* Dismiss button */}
                                  <div className="flex flex-col items-center gap-1 shrink-0 ml-1">
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); dismissItem(item.id); }}
                                      className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] text-muted-foreground hover:text-foreground transition-colors rounded"
                                      aria-label="Dismiss"
                                      title="Dismiss"
                                    >
                                      <X className="size-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer: view all activity link */}
              {currentProjectId && activityItems.length > 0 && (
                <div className="pt-3 pb-3 border-t">
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
