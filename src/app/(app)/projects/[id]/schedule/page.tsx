'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Flag, Calendar, DollarSign, TrendingUp, AlertTriangle, FileCheck, MessageSquareMore } from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import KPICard from '@/components/dashboard/KPICard';
import BudgetTracker from '@/components/schedule/BudgetTracker';
import TimelineView from '@/components/schedule/TimelineView';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { seedMilestones } from '@/lib/store';
import type { Milestone, MilestoneStatus } from '@/lib/types';

const STATUS_BAR_COLOR: Record<MilestoneStatus, string> = {
  on_track: 'bg-emerald-500', complete: 'bg-emerald-500',
  at_risk: 'bg-amber-500', behind: 'bg-red-500', not_started: 'bg-gray-300',
};

function fmtCurrency(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

/* ---------- KPI computation ---------- */
function useKPIs(milestones: Milestone[]) {
  return useMemo(() => {
    const totalWeight = milestones.reduce((s, m) => s + m.budget_planned, 0);
    const weightedProgress =
      totalWeight > 0
        ? milestones.reduce((s, m) => s + m.percent_complete * m.budget_planned, 0) / totalWeight
        : 0;

    const onTrack = milestones.filter(
      (m) => m.status === 'on_track' || m.status === 'complete'
    ).length;
    const atRiskBehind = milestones.filter(
      (m) => m.status === 'at_risk' || m.status === 'behind'
    ).length;
    const budgetPlanned = milestones.reduce((s, m) => s + m.budget_planned, 0);
    const budgetActual = milestones.reduce((s, m) => s + m.budget_actual, 0);

    return { weightedProgress: Math.round(weightedProgress), onTrack, atRiskBehind, budgetPlanned, budgetActual };
  }, [milestones]);
}

/* ---------- page ---------- */
export default function SchedulePage() {
  const params = useParams();
  const projectId = params.id as string;
  const milestones = [...seedMilestones].sort((a, b) => a.sort_order - b.sort_order);
  const kpis = useKPIs(milestones);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Schedule' },
        ]}
      />

      <h1 className="font-heading text-2xl font-bold mt-4">Schedule &amp; Milestones</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        <KPICard title="Overall Progress" value={`${kpis.weightedProgress}%`} icon={TrendingUp} color="blue" />
        <KPICard title="On Track" value={kpis.onTrack} icon={Flag} color="emerald" />
        <KPICard title="At Risk / Behind" value={kpis.atRiskBehind} icon={AlertTriangle} color={kpis.atRiskBehind > 0 ? 'red' : 'emerald'} />
        <KPICard
          title="Budget"
          value={fmtCurrency(kpis.budgetActual)}
          subtitle={`of ${fmtCurrency(kpis.budgetPlanned)} planned`}
          icon={DollarSign}
          color={kpis.budgetActual <= kpis.budgetPlanned ? 'emerald' : 'amber'}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="milestones" className="mt-8">
        <TabsList variant="line">
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="milestones" className="mt-4 space-y-4">
          {milestones.map((ms) => (
            <MilestoneCard key={ms.id} milestone={ms} projectId={projectId} />
          ))}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineView milestones={milestones} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Milestone card ---------- */
function MilestoneCard({ milestone: ms, projectId }: { milestone: Milestone; projectId: string }) {
  const submittals = ms.linked_submittals ?? [];
  const rfis = ms.linked_rfis ?? [];

  return (
    <Card className="gap-0 py-4">
      <CardContent className="px-4 space-y-3">
        {/* header row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm leading-tight">{ms.name}</h3>
              <StatusBadge status={ms.status} type="milestone" />
            </div>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ms.description}</p>
          </div>
          <div className="text-xs text-muted-foreground shrink-0 text-right space-y-0.5">
            <div className="flex items-center gap-1 justify-end">
              <Calendar className="size-3" />
              <span>Target: {format(parseISO(ms.target_date), 'MMM d, yyyy')}</span>
            </div>
            {ms.actual_date && (
              <div className="text-emerald-700 font-medium">
                Actual: {format(parseISO(ms.actual_date), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        </div>

        {/* progress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{ms.percent_complete}% complete</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${STATUS_BAR_COLOR[ms.status]}`}
              style={{ width: `${ms.percent_complete}%` }}
            />
          </div>
        </div>

        {/* budget + links row */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1 max-w-xs">
            <BudgetTracker planned={ms.budget_planned} actual={ms.budget_actual} label="Budget" />
          </div>
          <div className="flex items-center gap-3 text-xs shrink-0">
            {submittals.length > 0 && (
              <Link
                href={`/projects/${projectId}/submittals`}
                className="flex items-center gap-1 text-rc-blue hover:underline"
              >
                <FileCheck className="size-3.5" />
                {submittals.length} submittal{submittals.length !== 1 ? 's' : ''}
              </Link>
            )}
            {rfis.length > 0 && (
              <Link
                href={`/projects/${projectId}/rfis`}
                className="flex items-center gap-1 text-rc-blue hover:underline"
              >
                <MessageSquareMore className="size-3.5" />
                {rfis.length} RFI{rfis.length !== 1 ? 's' : ''}
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

