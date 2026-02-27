'use client';

import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import KPICard from '@/components/dashboard/KPICard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import QuickActions from '@/components/dashboard/QuickActions';
import MilestoneWidget from '@/components/dashboard/MilestoneWidget';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import {
  getSubmittals,
  getRFIs,
  getPunchListItems,
  getDailyLogs,
} from '@/lib/store';
import {
  DollarSign,
  Calendar,
  FileCheck,
  MessageSquareMore,
  ClipboardCheck,
  CalendarDays,
} from 'lucide-react';

export default function DashboardPage() {
  const { currentProject, currentProjectId } = useProject();
  const { can } = usePermissions(currentProjectId);

  if (!currentProject) {
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

  const budgetDisplay = `$${(project.budget_total / 1_000_000).toFixed(1)}M`;
  const budgetSpent = `$${(project.budget_spent / 1_000_000).toFixed(1)}M spent`;
  const budgetPercent = project.budget_total > 0
    ? Math.round((project.budget_spent / project.budget_total) * 100)
    : 0;

  const totalDays =
    new Date(project.target_end_date).getTime() - new Date(project.start_date).getTime();
  const elapsed = Date.now() - new Date(project.start_date).getTime();
  const schedulePercent = Math.min(100, Math.round((elapsed / totalDays) * 100));

  const allSubmittals = getSubmittals(currentProjectId);
  const totalSubmittals = allSubmittals.length;
  const pendingSubmittals = allSubmittals.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review'
  ).length;

  const allRFIs = getRFIs(currentProjectId);
  const openRFIs = allRFIs.filter(
    (r) => r.status === 'open' || r.status === 'overdue'
  ).length;
  const overdueRFIs = allRFIs.filter((r) => r.status === 'overdue').length;

  const allPunch = getPunchListItems(currentProjectId);
  const openPunch = allPunch.filter(
    (p) => p.status === 'open' || p.status === 'in_progress'
  ).length;
  const criticalPunch = allPunch.filter(
    (p) =>
      (p.status === 'open' || p.status === 'in_progress') && p.priority === 'critical'
  ).length;

  const allLogs = getDailyLogs(currentProjectId);
  const totalLogs = allLogs.length;
  const lastLog = [...allLogs].sort(
    (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  )[0];
  const lastLogDate = lastLog
    ? new Date(lastLog.log_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'N/A';

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />

      {/* Project header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {project.name}
          </h1>
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
        />
        <KPICard
          title="Submittals"
          value={totalSubmittals}
          subtitle={`${pendingSubmittals} pending review`}
          icon={FileCheck}
          color="blue"
        />
        <KPICard
          title="Open RFIs"
          value={openRFIs}
          subtitle={`${overdueRFIs} overdue`}
          icon={MessageSquareMore}
          color={overdueRFIs > 0 ? 'orange' : 'blue'}
        />
        <KPICard
          title="Punch List"
          value={`${openPunch} open`}
          subtitle={`${criticalPunch} critical`}
          icon={ClipboardCheck}
          color={criticalPunch > 0 ? 'red' : 'amber'}
        />
        <KPICard
          title="Daily Logs"
          value={totalLogs}
          subtitle={`Last: ${lastLogDate}`}
          icon={CalendarDays}
          color="emerald"
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
