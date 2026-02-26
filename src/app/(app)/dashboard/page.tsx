import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { Badge } from '@/components/ui/badge';
import KPICard from '@/components/dashboard/KPICard';
import ActivityFeed from '@/components/dashboard/ActivityFeed';
import QuickActions from '@/components/dashboard/QuickActions';
import MilestoneWidget from '@/components/dashboard/MilestoneWidget';
import {
  seedProject,
  seedSubmittals,
  seedRFIs,
  seedPunchListItems,
  seedDailyLogs,
} from '@/lib/seed-data';
import {
  DollarSign,
  Calendar,
  FileCheck,
  MessageSquareMore,
  ClipboardCheck,
  CalendarDays,
} from 'lucide-react';

function computeKPIs() {
  const project = seedProject;

  const budgetDisplay = `$${(project.budget_total / 1_000_000).toFixed(1)}M`;
  const budgetSpent = `$${(project.budget_spent / 1_000_000).toFixed(1)}M spent`;
  const budgetPercent = Math.round((project.budget_spent / project.budget_total) * 100);

  const totalDays =
    new Date(project.target_end_date).getTime() - new Date(project.start_date).getTime();
  const elapsed = Date.now() - new Date(project.start_date).getTime();
  const schedulePercent = Math.min(100, Math.round((elapsed / totalDays) * 100));

  const totalSubmittals = seedSubmittals.length;
  const pendingSubmittals = seedSubmittals.filter(
    (s) => s.status === 'submitted' || s.status === 'under_review'
  ).length;

  const openRFIs = seedRFIs.filter(
    (r) => r.status === 'open' || r.status === 'overdue'
  ).length;
  const overdueRFIs = seedRFIs.filter((r) => r.status === 'overdue').length;

  const openPunch = seedPunchListItems.filter(
    (p) => p.status === 'open' || p.status === 'in_progress'
  ).length;
  const criticalPunch = seedPunchListItems.filter(
    (p) =>
      (p.status === 'open' || p.status === 'in_progress') && p.priority === 'critical'
  ).length;

  const totalLogs = seedDailyLogs.length;
  const lastLog = [...seedDailyLogs].sort(
    (a, b) => new Date(b.log_date).getTime() - new Date(a.log_date).getTime()
  )[0];
  const lastLogDate = lastLog
    ? new Date(lastLog.log_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : 'N/A';

  return {
    budgetDisplay,
    budgetSpent,
    budgetPercent,
    schedulePercent,
    totalSubmittals,
    pendingSubmittals,
    openRFIs,
    overdueRFIs,
    openPunch,
    criticalPunch,
    totalLogs,
    lastLogDate,
  };
}

export default function DashboardPage() {
  const kpis = computeKPIs();

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard' }]} />

      {/* Project header */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-2xl font-bold text-rc-navy">
            {seedProject.name}
          </h1>
          <Badge className="border-0 bg-rc-emerald/10 text-rc-emerald font-medium">
            Active
          </Badge>
        </div>
        <p className="mt-1 text-sm text-rc-steel">{seedProject.client}</p>
      </div>

      {/* KPI cards grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KPICard
          title="Budget"
          value={kpis.budgetDisplay}
          subtitle={kpis.budgetSpent}
          icon={DollarSign}
          color="navy"
          trend="flat"
          trendValue={`${kpis.budgetPercent}%`}
        />
        <KPICard
          title="Schedule"
          value={`${kpis.schedulePercent}%`}
          subtitle="On Schedule"
          icon={Calendar}
          color="emerald"
          trend="up"
          trendValue="On track"
        />
        <KPICard
          title="Submittals"
          value={kpis.totalSubmittals}
          subtitle={`${kpis.pendingSubmittals} pending review`}
          icon={FileCheck}
          color="blue"
        />
        <KPICard
          title="Open RFIs"
          value={kpis.openRFIs}
          subtitle={`${kpis.overdueRFIs} overdue`}
          icon={MessageSquareMore}
          color={kpis.overdueRFIs > 0 ? 'orange' : 'blue'}
        />
        <KPICard
          title="Punch List"
          value={`${kpis.openPunch} open`}
          subtitle={`${kpis.criticalPunch} critical`}
          icon={ClipboardCheck}
          color={kpis.criticalPunch > 0 ? 'red' : 'amber'}
        />
        <KPICard
          title="Daily Logs"
          value={kpis.totalLogs}
          subtitle={`Last: ${kpis.lastLogDate}`}
          icon={CalendarDays}
          color="emerald"
        />
      </div>

      {/* Two column layout: Activity + sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ActivityFeed />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <QuickActions />
          <MilestoneWidget />
        </div>
      </div>
    </div>
  );
}
