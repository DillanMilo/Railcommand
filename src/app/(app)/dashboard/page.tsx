'use client';

import { useState, useEffect } from 'react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import PendingInvitations from '@/components/dashboard/PendingInvitations';
import KPICard from '@/components/dashboard/KPICard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import QuickActions from '@/components/dashboard/QuickActions';
import MilestoneWidget from '@/components/dashboard/MilestoneWidget';
import { useProject } from '@/components/providers/ProjectProvider';
import NewProjectDialog from '@/components/projects/NewProjectDialog';
import EditProjectDialog from '@/components/projects/EditProjectDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import { useDashboardData } from '@/hooks/useData';
import { format, parseISO } from 'date-fns';
import {
  DollarSign,
  Calendar,
  FileCheck,
  MessageSquareMore,
  ClipboardCheck,
  CalendarDays,
  Pencil,
  Plus,
  Rocket,
} from 'lucide-react';

export default function DashboardPage() {
  const { currentProject, currentProjectId, projects, isDemo } = useProject();
  const { can } = usePermissions(currentProjectId);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);

  const [now, setNow] = useState<number>(0);
  useEffect(() => { setNow(Date.now()); }, []);

  // Single batched fetch — 1 auth check + 4 parallel queries instead of 4 × (auth + membership + query)
  const { data: dashboardData, loading: dashboardLoading } = useDashboardData(currentProjectId);
  const allSubmittals = dashboardData.submittals;
  const allRFIs = dashboardData.rfis;
  const allPunch = dashboardData.punchListItems;
  const allLogs = dashboardData.dailyLogs;

  if (!currentProject) {
    // Real auth user with no projects — show welcome state
    if (!isDemo && projects.length === 0) {
      return (
        <div className="space-y-6">
          <Breadcrumbs items={[{ label: 'Dashboard' }]} />
          <PendingInvitations />
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-rc-orange/10 p-4 mb-4">
              <Rocket className="size-8 text-rc-orange" />
            </div>
            <h2 className="font-heading text-2xl font-bold">Welcome to Railcommand</h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              Get started by creating your first project. You can manage submittals, RFIs, daily logs, and more.
            </p>
            <Button
              className="mt-6 bg-rc-orange hover:bg-rc-orange-dark text-white gap-2"
              onClick={() => setNewProjectOpen(true)}
            >
              <Plus className="size-4" />
              New Project
            </Button>
            <NewProjectDialog open={newProjectOpen} onOpenChange={setNewProjectOpen} />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard' }]} />
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-medium">No project selected</p>
          <p className="text-sm mt-1">Select or create a project from the sidebar.</p>
        </div>
      </div>
    );
  }

  const project = currentProject;

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  const budgetDisplay = `$${(project.budget_total / 1_000_000).toFixed(1)}M`;
  const budgetSpent = `$${(project.budget_spent / 1_000_000).toFixed(1)}M spent`;
  const budgetPercent = project.budget_total > 0
    ? Math.round((project.budget_spent / project.budget_total) * 100)
    : 0;

  const totalDays =
    parseISO(project.target_end_date).getTime() - parseISO(project.start_date).getTime();
  const elapsed = now - parseISO(project.start_date).getTime();
  const schedulePercent = totalDays > 0
    ? Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)))
    : 100;

  const totalSubmittals = allSubmittals.length;
  const pendingSubmittals = allSubmittals.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review'
  ).length;

  const openRFIs = allRFIs.filter(
    (r) => r.status === 'open' || r.status === 'overdue'
  ).length;
  const overdueRFIs = allRFIs.filter((r) => r.status === 'overdue').length;

  const openPunch = allPunch.filter(
    (p) => p.status === 'open' || p.status === 'in_progress'
  ).length;
  const criticalPunch = allPunch.filter(
    (p) =>
      (p.status === 'open' || p.status === 'in_progress') && p.priority === 'critical'
  ).length;

  const totalLogs = allLogs.length;
  const lastLog = [...allLogs].sort(
    (a, b) => parseISO(b.log_date).getTime() - parseISO(a.log_date).getTime()
  )[0];
  const lastLogDate = lastLog
    ? format(parseISO(lastLog.log_date), 'MMM d')
    : 'N/A';

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />

      {/* Pending invitations banner (real auth only) */}
      {!isDemo && <PendingInvitations />}

      {/* Project header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {project.name}
          </h1>
          {can(ACTIONS.PROJECT_EDIT) && (
            <button
              onClick={() => setEditProjectOpen(true)}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-md text-rc-steel hover:text-rc-orange hover:bg-rc-orange/10 transition-colors"
              aria-label="Edit Project"
            >
              <Pencil className="size-4" />
            </button>
          )}
          <Badge
            className={cn(
              'border-0 font-medium',
              project.status === 'active' && 'bg-rc-emerald/10 text-rc-emerald',
              project.status === 'on_hold' && 'bg-amber-500/10 text-amber-600',
              project.status === 'completed' && 'bg-rc-blue/10 text-rc-blue',
              project.status === 'archived' && 'bg-slate-500/10 text-slate-500'
            )}
          >
            {project.status.charAt(0).toUpperCase() + project.status.slice(1).replace('_', ' ')}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-rc-steel">{project.client}</p>
      </div>
      {can(ACTIONS.PROJECT_EDIT) && (
        <EditProjectDialog
          open={editProjectOpen}
          onOpenChange={setEditProjectOpen}
          project={project}
        />
      )}

      {/* KPI cards grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">
        {can(ACTIONS.BUDGET_VIEW) ? (
          <KPICard
            title="Budget"
            value={budgetDisplay}
            subtitle={budgetSpent}
            icon={DollarSign}
            color="navy"
            trend="flat"
            trendValue={`${budgetPercent}%`}
            href={`/projects/${currentProjectId}/schedule`}
            ariaLabel="View budget and milestones"
          />
        ) : (
          <KPICard title="Budget" value="--" subtitle="Restricted" icon={DollarSign} color="navy" />
        )}
        <KPICard
          title="Schedule"
          value={`${schedulePercent}%`}
          subtitle="On Schedule"
          icon={Calendar}
          color="emerald"
          trend="up"
          trendValue="On track"
          href={`/projects/${currentProjectId}/schedule`}
          ariaLabel="View schedule and milestones"
        />
        <KPICard
          title="Submittals"
          value={totalSubmittals}
          subtitle={`${pendingSubmittals} pending review`}
          icon={FileCheck}
          color="blue"
          href={`/projects/${currentProjectId}/submittals?status=under_review`}
          ariaLabel="View submittals pending review"
        />
        <KPICard
          title="Open RFIs"
          value={openRFIs}
          subtitle={`${overdueRFIs} overdue`}
          icon={MessageSquareMore}
          color={overdueRFIs > 0 ? 'orange' : 'blue'}
          href={`/projects/${currentProjectId}/rfis?status=open`}
          ariaLabel="View open RFIs"
        />
        <KPICard
          title="Punch List"
          value={`${openPunch} open`}
          subtitle={`${criticalPunch} critical`}
          icon={ClipboardCheck}
          color={criticalPunch > 0 ? 'red' : 'amber'}
          href={`/projects/${currentProjectId}/punch-list?status=open`}
          ariaLabel="View open punch list items"
        />
        <KPICard
          title="Daily Logs"
          value={totalLogs}
          subtitle={`Last: ${lastLogDate}`}
          icon={CalendarDays}
          color="emerald"
          href={`/projects/${currentProjectId}/daily-logs`}
          ariaLabel="View daily logs"
        />
      </div>

      {/* Two column layout: Activity + sidebar */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ActivityFeed projectId={currentProjectId} />
        </div>
        <div className="space-y-6 xl:col-span-2">
          <QuickActions projectId={currentProjectId} />
          <MilestoneWidget projectId={currentProjectId} />
        </div>
      </div>
    </div>
  );
}
