'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { getNavItems } from '@/lib/constants';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import { updateProjectStatus as storeUpdateProjectStatus, deleteProject as storeDeleteProject } from '@/lib/store';
import { updateProjectStatus as serverUpdateProjectStatus, deleteProject as serverDeleteProject } from '@/lib/actions/projects';
import NewProjectDialog from '@/components/projects/NewProjectDialog';
import DeleteProjectDialog from '@/components/projects/DeleteProjectDialog';
import type { Project } from '@/lib/types';
import {
  LayoutDashboard,
  FileCheck,
  MessageSquareMore,
  CalendarDays,
  ClipboardCheck,
  GanttChart,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  Plus,
  Check,
  MoreHorizontal,
  CheckCircle2,
  Archive,
  Trash2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FileCheck,
  MessageSquareMore,
  ClipboardList: CalendarDays,
  ListChecks: ClipboardCheck,
  CalendarRange: GanttChart,
  ShieldAlert,
  Users,
};

const STATUS_DOT_COLORS: Record<Project['status'], string> = {
  active: 'bg-rc-emerald',
  on_hold: 'bg-amber-400',
  completed: 'bg-gray-400',
  archived: 'bg-slate-500',
};

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [deleteDialogProject, setDeleteDialogProject] = useState<Project | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { currentProject, currentProjectId, projects, setCurrentProjectId, refreshProjects, isDemo } = useProject();
  const { can } = usePermissions(currentProjectId);

  const navItems = getNavItems(currentProjectId);

  // Group projects: active/on_hold first, then completed/archived
  const activeProjects = projects.filter(
    (p) => p.status === 'active' || p.status === 'on_hold'
  );
  const inactiveProjects = projects.filter(
    (p) => p.status === 'completed' || p.status === 'archived'
  );

  const handleMarkComplete = async (project: Project) => {
    if (isDemo) {
      storeUpdateProjectStatus(project.id, 'completed');
    } else {
      await serverUpdateProjectStatus(project.id, 'completed');
    }
    refreshProjects();
  };

  const handleArchive = async (project: Project) => {
    if (isDemo) {
      storeUpdateProjectStatus(project.id, 'archived');
    } else {
      await serverUpdateProjectStatus(project.id, 'archived');
    }
    refreshProjects();
  };

  const handleDeleteConfirmed = async (projectId: string) => {
    const wasCurrentProject = projectId === currentProjectId;
    if (isDemo) {
      storeDeleteProject(projectId);
    } else {
      await serverDeleteProject(projectId);
    }
    refreshProjects();

    if (wasCurrentProject) {
      // Switch to the first remaining project, or navigate to dashboard
      const remaining = projects.filter((p) => p.id !== projectId);
      if (remaining.length > 0) {
        setCurrentProjectId(remaining[0].id);
        router.push(`/projects/${remaining[0].id}/submittals`);
      } else {
        router.push('/dashboard');
      }
    }

    setDeleteDialogProject(null);
  };

  const renderProjectItem = (project: Project) => (
    <div
      key={project.id}
      className="flex items-center"
    >
      <DropdownMenuItem
        onClick={() => {
          setCurrentProjectId(project.id);
          router.push(`/projects/${project.id}/submittals`);
        }}
        className="flex-1 min-w-0 flex items-center gap-2"
      >
        {/* Status dot */}
        <span
          className={cn(
            'size-2 rounded-full shrink-0',
            STATUS_DOT_COLORS[project.status]
          )}
        />
        <span className="truncate">{project.name}</span>
        {project.id === currentProjectId && (
          <Check className="size-4 text-rc-orange shrink-0 ml-auto" />
        )}
      </DropdownMenuItem>

      {/* Three-dot actions menu — only visible with PROJECT_MANAGE permission */}
      {can(ACTIONS.PROJECT_MANAGE) && (
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            className="h-7 w-7 p-0 flex items-center justify-center shrink-0 text-muted-foreground hover:text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal className="size-3.5" />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-[180px]">
            {/* Mark as Complete - only for active or on_hold */}
            {(project.status === 'active' || project.status === 'on_hold') && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleMarkComplete(project);
                }}
              >
                <CheckCircle2 className="size-4 text-rc-emerald" />
                Mark as Complete
              </DropdownMenuItem>
            )}

            {/* Archive - only for active or completed */}
            {(project.status === 'active' || project.status === 'completed') && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleArchive(project);
                }}
              >
                <Archive className="size-4" />
                Archive
              </DropdownMenuItem>
            )}

            {/* Separator before destructive action */}
            {(project.status === 'active' || project.status === 'on_hold' || project.status === 'completed') && (
              <DropdownMenuSeparator />
            )}

            {/* Delete - always available */}
            <DropdownMenuItem
              variant="destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteDialogProject(project);
              }}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      )}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          'hidden md:flex flex-col bg-rc-navy text-white transition-all duration-300 ease-in-out h-screen sticky top-0',
          collapsed ? 'w-[72px]' : 'w-[260px]'
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-white/10 shrink-0">
          {collapsed ? (
            <Image
              src="/IMG_0936.jpg"
              alt="RailCommand"
              width={36}
              height={36}
              className="rounded-lg shrink-0"
            />
          ) : (
            <div className="flex flex-col">
              <Image
                src="/IMG_0938.jpg"
                alt="RailCommand"
                width={170}
                height={40}
                className="object-contain"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-white/40 tracking-wide uppercase ml-0.5">
                  by A5
                </span>
                <span className="text-[9px] font-semibold text-rc-orange/80 tracking-wider uppercase px-1.5 py-0.5 rounded border border-rc-orange/30 leading-none">
                  Beta
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Project Switcher */}
        {!collapsed && (
          <div className="px-4 py-4 border-b border-white/10 shrink-0">
            <p className="text-[11px] uppercase tracking-wider text-white/70 font-medium">
              Project
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 w-full text-left mt-0.5 group">
                {currentProject && (
                  <span
                    className={cn(
                      'size-2 rounded-full shrink-0 mr-1',
                      STATUS_DOT_COLORS[currentProject.status]
                    )}
                  />
                )}
                <span className="text-sm text-white/95 truncate flex-1 font-medium">
                  {currentProject?.name ?? 'Select project'}
                </span>
                <ChevronDown className="size-3.5 text-white/70 shrink-0 group-hover:text-white transition-colors" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {/* Active / On Hold projects */}
                {activeProjects.length > 0 && (
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      Active Projects
                    </DropdownMenuLabel>
                    {activeProjects.map(renderProjectItem)}
                  </DropdownMenuGroup>
                )}

                {/* Completed / Archived projects */}
                {inactiveProjects.length > 0 && (
                  <>
                    {activeProjects.length > 0 && <DropdownMenuSeparator />}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Completed / Archived
                      </DropdownMenuLabel>
                      {inactiveProjects.map(renderProjectItem)}
                    </DropdownMenuGroup>
                  </>
                )}

                {/* Empty state */}
                {projects.length === 0 && (
                  <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                    No projects yet
                  </div>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setNewProjectOpen(true)}>
                  <Plus className="size-4" />
                  New Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon];
            const disabled = item.requiresProject && !currentProjectId;
            const isActive =
              !disabled && (pathname === item.href || pathname.startsWith(item.href + '/'));

            if (disabled) {
              const disabledEl = (
                <span
                  key={item.label}
                  className="flex items-center gap-3.5 px-3 h-11 rounded-lg text-sm font-medium text-white/30 cursor-not-allowed"
                >
                  {Icon && <Icon className="size-5 shrink-0" />}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
              );

              return (
                <Tooltip key={item.label} delayDuration={0}>
                  <TooltipTrigger asChild>{disabledEl}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8}>
                    Select a project first
                  </TooltipContent>
                </Tooltip>
              );
            }

            const link = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3.5 px-3 h-11 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-rc-orange text-white font-semibold shadow-sm shadow-rc-orange/40 ring-1 ring-inset ring-white/15'
                    : 'font-medium text-white/85 hover:text-white hover:bg-white/10'
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
            <div className="flex items-center gap-1.5 text-white/60">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span className="text-[11px] font-medium">US Data Only</span>
            </div>
          </div>
        )}

        {/* Collapse Toggle */}
        <div className="px-2 py-3 border-t border-white/10 shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full h-11 rounded-lg text-white/85 hover:text-white hover:bg-white/10 transition-colors"
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

      <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
      <DeleteProjectDialog
        project={deleteDialogProject}
        open={deleteDialogProject !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogProject(null);
        }}
        onConfirm={handleDeleteConfirmed}
      />
    </>
  );
}
