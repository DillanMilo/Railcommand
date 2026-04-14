'use client';

import { useState, useMemo, use } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Flag, Calendar, DollarSign, TrendingUp, AlertTriangle, FileCheck, MessageSquareMore, Plus, Pencil, Trash2, Receipt, FileText } from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import StatusBadge from '@/components/shared/StatusBadge';
import KPICard from '@/components/dashboard/KPICard';
import BudgetTracker from '@/components/schedule/BudgetTracker';
import TimelineView from '@/components/schedule/TimelineView';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useMilestones, useChangeOrders, useModifications } from '@/hooks/useData';
import { useProject } from '@/components/providers/ProjectProvider';
import ExportPDFButton from '@/components/shared/ExportPDFButton';
import { getCurrentUserId, getProfileWithOrg } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import { createMilestone as serverCreateMilestone, updateMilestone as serverUpdateMilestone, deleteMilestone as serverDeleteMilestone } from '@/lib/actions/milestones';
import { createChangeOrder as serverCreateCO, updateChangeOrder as serverUpdateCO, deleteChangeOrder as serverDeleteCO } from '@/lib/actions/change-orders';
import { createModification as serverCreateMod, updateModification as serverUpdateMod, deleteModification as serverDeleteMod } from '@/lib/actions/modifications';
import { addMilestone as storeAddMilestone, updateMilestone as storeUpdateMilestone, deleteMilestone as storeDeleteMilestone } from '@/lib/store';
import { addChangeOrder as storeAddCO, updateChangeOrder as storeUpdateCO, deleteChangeOrder as storeDeleteCO } from '@/lib/store';
import { addModification as storeAddMod, updateModification as storeUpdateMod, deleteModification as storeDeleteMod } from '@/lib/store';
import { CHANGE_ORDER_STATUS_COLORS, CHANGE_ORDER_STATUS_LABELS, MODIFICATION_STATUS_COLORS, MODIFICATION_STATUS_LABELS, MODIFICATION_TYPE_LABELS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import type { Milestone, MilestoneStatus, ChangeOrder, ChangeOrderStatus, Modification, ModificationType, ModificationStatus } from '@/lib/types';

const STATUS_BAR_COLOR: Record<MilestoneStatus, string> = {
  on_track: 'bg-emerald-500', complete: 'bg-emerald-500',
  at_risk: 'bg-amber-500', behind: 'bg-red-500', not_started: 'bg-gray-300',
};

const STATUS_OPTIONS: { label: string; value: MilestoneStatus }[] = [
  { label: 'Not Started', value: 'not_started' },
  { label: 'On Track', value: 'on_track' },
  { label: 'At Risk', value: 'at_risk' },
  { label: 'Behind', value: 'behind' },
  { label: 'Complete', value: 'complete' },
];

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
export default function SchedulePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const { currentProject, isDemo } = useProject();
  const { can } = usePermissions(projectId);
  const currentProfile = getProfileWithOrg(getCurrentUserId());
  const { data: rawMilestones, loading: loadingMs, refetch } = useMilestones(projectId);
  const milestones = [...rawMilestones].sort((a, b) => a.sort_order - b.sort_order);
  const { data: changeOrders, loading: loadingCOs, refetch: refetchCOs } = useChangeOrders(projectId);
  const { data: modifications, loading: loadingMods, refetch: refetchMods } = useModifications(projectId);
  const scheduleLoading = loadingMs || loadingCOs || loadingMods;
  const kpis = useKPIs(milestones);

  const approvedTotal = useMemo(() =>
    changeOrders.filter(co => co.status === 'approved').reduce((sum, co) => sum + co.amount, 0),
    [changeOrders]
  );

  // Add milestone dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addTargetDate, setAddTargetDate] = useState('');
  const [addStatus, setAddStatus] = useState<MilestoneStatus>('not_started');
  const [addPercent, setAddPercent] = useState(0);
  const [addBudgetPlanned, setAddBudgetPlanned] = useState(0);
  const [addBudgetActual, setAddBudgetActual] = useState(0);
  const [addSaving, setAddSaving] = useState(false);

  // Add change order dialog state
  const [addCOOpen, setAddCOOpen] = useState(false);
  const [addCOTitle, setAddCOTitle] = useState('');
  const [addCODescription, setAddCODescription] = useState('');
  const [addCOReason, setAddCOReason] = useState('');
  const [addCOAmount, setAddCOAmount] = useState(0);
  const [addCOMilestoneId, setAddCOMilestoneId] = useState('');
  const [addCOSaving, setAddCOSaving] = useState(false);

  // Add modification dialog state
  const [addModOpen, setAddModOpen] = useState(false);
  const [addModTitle, setAddModTitle] = useState('');
  const [addModDescription, setAddModDescription] = useState('');
  const [addModType, setAddModType] = useState<ModificationType>('plan_revision');
  const [addModRevision, setAddModRevision] = useState('');
  const [addModAffectedDocs, setAddModAffectedDocs] = useState('');
  const [addModMilestoneId, setAddModMilestoneId] = useState('');
  const [addModSaving, setAddModSaving] = useState(false);

  function resetAddForm() {
    setAddName('');
    setAddDescription('');
    setAddTargetDate('');
    setAddStatus('not_started');
    setAddPercent(0);
    setAddBudgetPlanned(0);
    setAddBudgetActual(0);
  }

  function resetAddCOForm() {
    setAddCOTitle('');
    setAddCODescription('');
    setAddCOReason('');
    setAddCOAmount(0);
    setAddCOMilestoneId('');
  }

  function resetAddModForm() {
    setAddModTitle('');
    setAddModDescription('');
    setAddModType('plan_revision');
    setAddModRevision('');
    setAddModAffectedDocs('');
    setAddModMilestoneId('');
  }

  async function handleAddMilestone() {
    if (!addName || !addTargetDate) return;
    setAddSaving(true);
    const data = {
      name: addName,
      description: addDescription,
      target_date: addTargetDate,
      status: addStatus,
      percent_complete: addPercent,
      budget_planned: addBudgetPlanned,
      budget_actual: addBudgetActual,
    };
    if (isDemo) {
      storeAddMilestone(projectId, data);
      refetch();
    } else {
      const result = await serverCreateMilestone(projectId, data);
      if (result.error) { setAddSaving(false); return; }
      refetch();
    }
    setAddSaving(false);
    setAddOpen(false);
    resetAddForm();
  }

  async function handleAddCO() {
    if (!addCOTitle || !addCOReason) return;
    setAddCOSaving(true);
    const data = {
      title: addCOTitle,
      description: addCODescription,
      reason: addCOReason,
      amount: addCOAmount,
      linked_milestone_id: addCOMilestoneId || null,
    };
    if (isDemo) {
      storeAddCO(projectId, data);
      refetchCOs();
    } else {
      const result = await serverCreateCO(projectId, data);
      if (result.error) { setAddCOSaving(false); return; }
      refetchCOs();
    }
    setAddCOSaving(false);
    setAddCOOpen(false);
    resetAddCOForm();
  }

  async function handleAddMod() {
    if (!addModTitle) return;
    setAddModSaving(true);
    const data = {
      title: addModTitle,
      description: addModDescription,
      modification_type: addModType,
      revision_number: addModRevision,
      affected_documents: addModAffectedDocs,
      linked_milestone_id: addModMilestoneId || null,
    };
    if (isDemo) {
      storeAddMod(projectId, data);
      refetchMods();
    } else {
      const result = await serverCreateMod(projectId, data);
      if (result.error) { setAddModSaving(false); return; }
      refetchMods();
    }
    setAddModSaving(false);
    setAddModOpen(false);
    resetAddModForm();
  }

  if (scheduleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="size-6 border-2 border-rc-orange/30 border-t-rc-orange rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Schedule' },
        ]}
      />

      <div className="flex items-center justify-between mt-4">
        <h1 className="font-heading text-2xl font-bold">Schedule &amp; Milestones</h1>
        <div className="flex items-center gap-2">
          <ExportPDFButton
            getDocument={async () => {
              const { default: SchedulePDF } = await import('@/lib/pdf/SchedulePDF');
              return <SchedulePDF milestones={milestones} projectName={currentProject?.name ?? 'Project'} generatedBy={currentProfile?.full_name ?? 'User'} budgetPlanned={kpis.budgetPlanned} budgetActual={kpis.budgetActual} />;
            }}
            fileName={`schedule-report-${projectId}`}
          />
          {can(ACTIONS.SCHEDULE_EDIT) && (
            <Button onClick={() => setAddOpen(true)} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              <Plus className="size-4 mr-1" />Add Milestone
            </Button>
          )}
        </div>
      </div>

      {/* Benchmark Dates */}
      {currentProject && (currentProject.turnover_date || currentProject.substantial_completion_date || currentProject.project_completion_date) && (
        <Card className="mt-6 py-4">
          <CardContent className="px-4">
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Benchmark Dates</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Turnover</p>
                <p className="text-sm font-semibold mt-0.5">
                  {currentProject.turnover_date ? format(parseISO(currentProject.turnover_date), 'MMM d, yyyy') : '\u2014'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Substantial Completion</p>
                <p className="text-sm font-semibold mt-0.5">
                  {currentProject.substantial_completion_date ? format(parseISO(currentProject.substantial_completion_date), 'MMM d, yyyy') : '\u2014'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Project Completion</p>
                <p className="text-sm font-semibold mt-0.5">
                  {currentProject.project_completion_date ? format(parseISO(currentProject.project_completion_date), 'MMM d, yyyy') : '\u2014'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-6">
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
          <TabsTrigger value="change-orders">Change Orders</TabsTrigger>
          <TabsTrigger value="modifications">Modifications</TabsTrigger>
        </TabsList>

        <TabsContent value="milestones" className="mt-4 space-y-4">
          {milestones.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-lg font-medium">No milestones yet</p>
              <p className="text-sm mt-1">Add your first milestone to start tracking schedule progress.</p>
            </div>
          )}
          {milestones.map((ms) => (
            <MilestoneCard key={ms.id} milestone={ms} projectId={projectId} isDemo={isDemo} canEdit={can(ACTIONS.SCHEDULE_EDIT)} refetch={refetch} />
          ))}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {currentProject?.start_date && currentProject?.target_end_date ? (
            <TimelineView
              milestones={milestones}
              startDate={currentProject.start_date}
              endDate={currentProject.target_end_date}
            />
          ) : (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-lg font-medium">No timeline data</p>
              <p className="text-sm mt-1">Set project start and end dates to view the timeline.</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="change-orders" className="mt-4 space-y-4">
          {changeOrders.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Approved:</span>{' '}
                <span className={`font-semibold ${approvedTotal >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {approvedTotal >= 0 ? '+' : ''}{fmtCurrency(Math.abs(approvedTotal))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Pending:</span>{' '}
                <span className="font-semibold">{changeOrders.filter(co => co.status === 'submitted' || co.status === 'draft').length}</span>
              </div>
            </div>
          )}

          {can(ACTIONS.CHANGE_ORDER_MANAGE) && (
            <Button onClick={() => setAddCOOpen(true)} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              <Plus className="size-4 mr-1" />Add Change Order
            </Button>
          )}

          {changeOrders.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-lg font-medium">No change orders yet</p>
              <p className="text-sm mt-1">Track budget modifications with change orders.</p>
            </div>
          )}

          {changeOrders.map((co) => (
            <ChangeOrderCard key={co.id} changeOrder={co} projectId={projectId} isDemo={isDemo} canManage={can(ACTIONS.CHANGE_ORDER_MANAGE)} refetch={refetchCOs} milestones={milestones} />
          ))}
        </TabsContent>

        <TabsContent value="modifications" className="mt-4 space-y-4">
          {modifications.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Issued:</span>{' '}
                <span className="font-semibold">{modifications.filter(m => m.status === 'issued').length}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Pending Acknowledgment:</span>{' '}
                <span className="font-semibold">{modifications.filter(m => m.status === 'issued').length}</span>
              </div>
            </div>
          )}

          {can(ACTIONS.SCHEDULE_EDIT) && (
            <Button onClick={() => setAddModOpen(true)} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              <Plus className="size-4 mr-1" />Add Modification
            </Button>
          )}

          {modifications.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-lg font-medium">No modifications yet</p>
              <p className="text-sm mt-1">Track plan revisions, spec amendments, and contract modifications.</p>
            </div>
          )}

          {modifications.map((mod) => (
            <ModificationCard key={mod.id} modification={mod} projectId={projectId} isDemo={isDemo} canEdit={can(ACTIONS.SCHEDULE_EDIT)} refetch={refetchMods} milestones={milestones} />
          ))}
        </TabsContent>
      </Tabs>

      {/* Add Milestone Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Milestone</DialogTitle>
            <DialogDescription>Create a new milestone for this project.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Name <span className="text-red-500">*</span></label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Foundation Complete" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={addDescription} onChange={(e) => setAddDescription(e.target.value)} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Target Date <span className="text-red-500">*</span></label>
                <Input type="date" value={addTargetDate} onChange={(e) => setAddTargetDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={addStatus} onValueChange={(v) => setAddStatus(v as MilestoneStatus)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">% Complete</label>
                <Input type="number" min={0} max={100} value={addPercent} onChange={(e) => setAddPercent(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Budget Planned</label>
                <Input type="number" min={0} value={addBudgetPlanned} onChange={(e) => setAddBudgetPlanned(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Budget Actual</label>
                <Input type="number" min={0} value={addBudgetActual} onChange={(e) => setAddBudgetActual(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); resetAddForm(); }}>Cancel</Button>
            <Button onClick={handleAddMilestone} disabled={addSaving || !addName || !addTargetDate} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              {addSaving ? 'Creating...' : 'Create Milestone'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Change Order Dialog */}
      <Dialog open={addCOOpen} onOpenChange={setAddCOOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Change Order</DialogTitle>
            <DialogDescription>Create a new change order for budget modification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
              <Input value={addCOTitle} onChange={(e) => setAddCOTitle(e.target.value)} placeholder="e.g. Additional foundation work" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Reason <span className="text-red-500">*</span></label>
              <Input value={addCOReason} onChange={(e) => setAddCOReason(e.target.value)} placeholder="e.g. Scope change, Unforeseen conditions" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Amount <span className="text-red-500">*</span></label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" value={addCOAmount} onChange={(e) => setAddCOAmount(Number(e.target.value))} className="pl-7" placeholder="Positive = cost increase, negative = savings" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={addCODescription} onChange={(e) => setAddCODescription(e.target.value)} rows={2} className="mt-1" placeholder="Additional details..." />
            </div>
            <div>
              <label className="text-sm font-medium">Linked Milestone</label>
              <Select value={addCOMilestoneId} onValueChange={setAddCOMilestoneId}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {milestones.map((ms) => <SelectItem key={ms.id} value={ms.id}>{ms.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddCOOpen(false); resetAddCOForm(); }}>Cancel</Button>
            <Button onClick={handleAddCO} disabled={addCOSaving || !addCOTitle || !addCOReason} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              {addCOSaving ? 'Creating...' : 'Create Change Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Modification Dialog */}
      <Dialog open={addModOpen} onOpenChange={setAddModOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Modification</DialogTitle>
            <DialogDescription>Create a new plan revision, spec amendment, or contract modification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
              <Input value={addModTitle} onChange={(e) => setAddModTitle(e.target.value)} placeholder="e.g. Revised drainage plan" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={addModType} onValueChange={(v) => setAddModType(v as ModificationType)}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MODIFICATION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Revision Number</label>
              <Input value={addModRevision} onChange={(e) => setAddModRevision(e.target.value)} placeholder='e.g. "Rev 2", "Amendment A"' className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Affected Documents</label>
              <Input value={addModAffectedDocs} onChange={(e) => setAddModAffectedDocs(e.target.value)} placeholder='e.g. "Sheet C-101, C-102, Spec 34 11 13"' className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={addModDescription} onChange={(e) => setAddModDescription(e.target.value)} rows={2} className="mt-1" placeholder="Additional details..." />
            </div>
            <div>
              <label className="text-sm font-medium">Linked Milestone</label>
              <Select value={addModMilestoneId} onValueChange={setAddModMilestoneId}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {milestones.map((ms) => <SelectItem key={ms.id} value={ms.id}>{ms.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddModOpen(false); resetAddModForm(); }}>Cancel</Button>
            <Button onClick={handleAddMod} disabled={addModSaving || !addModTitle} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              {addModSaving ? 'Creating...' : 'Create Modification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Milestone card ---------- */
function MilestoneCard({ milestone: ms, projectId, isDemo, canEdit, refetch }: { milestone: Milestone; projectId: string; isDemo: boolean; canEdit: boolean; refetch: () => void }) {
  const submittals = ms.linked_submittals ?? [];
  const rfis = ms.linked_rfis ?? [];

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTargetDate, setEditTargetDate] = useState('');
  const [editStatus, setEditStatus] = useState<MilestoneStatus>('not_started');
  const [editPercent, setEditPercent] = useState(0);
  const [editBudgetPlanned, setEditBudgetPlanned] = useState(0);
  const [editBudgetActual, setEditBudgetActual] = useState(0);
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function openEditDialog() {
    setEditName(ms.name);
    setEditDescription(ms.description ?? '');
    setEditTargetDate(ms.target_date ? ms.target_date.split('T')[0] : '');
    setEditStatus(ms.status);
    setEditPercent(ms.percent_complete);
    setEditBudgetPlanned(ms.budget_planned);
    setEditBudgetActual(ms.budget_actual);
    setEditOpen(true);
  }

  async function handleEditSave() {
    setSaving(true);
    const data = {
      name: editName,
      description: editDescription,
      target_date: editTargetDate,
      status: editStatus,
      percent_complete: editPercent,
      budget_planned: editBudgetPlanned,
      budget_actual: editBudgetActual,
    };
    if (isDemo) {
      storeUpdateMilestone(ms.id, data);
      refetch();
    } else {
      const result = await serverUpdateMilestone(projectId, ms.id, data);
      if (result.error) { setSaving(false); return; }
      refetch();
    }
    setSaving(false);
    setEditOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    if (isDemo) {
      storeDeleteMilestone(ms.id);
      refetch();
    } else {
      const result = await serverDeleteMilestone(projectId, ms.id);
      if (result.error) { setDeleting(false); return; }
      refetch();
    }
    setDeleting(false);
    setDeleteOpen(false);
  }

  return (
    <>
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
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <>
                  <Button variant="ghost" size="sm" onClick={openEditDialog} className="h-7 w-7 p-0">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
              <div className="text-xs text-muted-foreground text-right space-y-0.5 ml-1">
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

      {/* Edit Milestone Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Milestone</DialogTitle>
            <DialogDescription>Update milestone details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Target Date</label>
                <Input type="date" value={editTargetDate} onChange={(e) => setEditTargetDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as MilestoneStatus)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">% Complete</label>
                <Input type="number" min={0} max={100} value={editPercent} onChange={(e) => setEditPercent(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Budget Planned</label>
                <Input type="number" min={0} value={editBudgetPlanned} onChange={(e) => setEditBudgetPlanned(Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Budget Actual</label>
                <Input type="number" min={0} value={editBudgetActual} onChange={(e) => setEditBudgetActual(Number(e.target.value))} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Milestone Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Milestone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{ms.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- Change Order card ---------- */
function ChangeOrderCard({ changeOrder: co, projectId, isDemo, canManage, refetch, milestones }: {
  changeOrder: ChangeOrder;
  projectId: string;
  isDemo: boolean;
  canManage: boolean;
  refetch: () => void;
  milestones: Milestone[];
}) {
  const linkedMilestone = milestones.find((ms) => ms.id === co.linked_milestone_id);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editAmount, setEditAmount] = useState(0);
  const [editMilestoneId, setEditMilestoneId] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function openEditDialog() {
    setEditTitle(co.title);
    setEditDescription(co.description ?? '');
    setEditReason(co.reason ?? '');
    setEditAmount(co.amount);
    setEditMilestoneId(co.linked_milestone_id ?? '');
    setEditOpen(true);
  }

  async function handleEditSave() {
    setSaving(true);
    const data = {
      title: editTitle,
      description: editDescription,
      reason: editReason,
      amount: editAmount,
      linked_milestone_id: editMilestoneId || null,
    };
    if (isDemo) {
      storeUpdateCO(co.id, data);
      refetch();
    } else {
      const result = await serverUpdateCO(projectId, co.id, data);
      if (result.error) { setSaving(false); return; }
      refetch();
    }
    setSaving(false);
    setEditOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    if (isDemo) {
      storeDeleteCO(co.id);
      refetch();
    } else {
      const result = await serverDeleteCO(projectId, co.id);
      if (result.error) { setDeleting(false); return; }
      refetch();
    }
    setDeleting(false);
    setDeleteOpen(false);
  }

  async function handleStatusChange(newStatus: ChangeOrderStatus) {
    setSaving(true);
    if (isDemo) {
      const updateData: Partial<ChangeOrder> = { status: newStatus };
      if (newStatus === 'approved') {
        updateData.approval_date = new Date().toISOString().split('T')[0];
      }
      storeUpdateCO(co.id, updateData);
      refetch();
    } else {
      const result = await serverUpdateCO(projectId, co.id, { status: newStatus });
      if (result.error) { setSaving(false); return; }
      refetch();
    }
    setSaving(false);
  }

  return (
    <>
      <Card className="gap-0 py-4">
        <CardContent className="px-4 space-y-3">
          {/* header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Receipt className="size-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono text-muted-foreground">{co.number}</span>
                <h3 className="font-semibold text-sm leading-tight">{co.title}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CHANGE_ORDER_STATUS_COLORS[co.status]}`}>
                  {CHANGE_ORDER_STATUS_LABELS[co.status]}
                </span>
              </div>
              {co.reason && (
                <p className="text-xs text-muted-foreground mt-1">Reason: {co.reason}</p>
              )}
              {co.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{co.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canManage && (
                <>
                  <Button variant="ghost" size="sm" onClick={openEditDialog} className="h-7 w-7 p-0">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
              <div className={`text-lg font-bold ${co.amount >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {co.amount >= 0 ? '+' : ''}{fmtCurrency(Math.abs(co.amount))}
              </div>
            </div>
          </div>

          {/* details row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {linkedMilestone && (
              <span className="flex items-center gap-1">
                <Flag className="size-3" />
                {linkedMilestone.name}
              </span>
            )}
            {co.submit_date && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                Submitted: {format(parseISO(co.submit_date), 'MMM d, yyyy')}
              </span>
            )}
            {co.approval_date && (
              <span className="text-emerald-700 font-medium">
                Approved: {format(parseISO(co.approval_date), 'MMM d, yyyy')}
              </span>
            )}
            {co.submitted_by_profile && (
              <span>By: {co.submitted_by_profile.full_name}</span>
            )}
          </div>

          {/* status transition buttons */}
          {canManage && (
            <div className="flex items-center gap-2">
              {co.status === 'draft' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('submitted')} disabled={saving} className="h-7 text-xs">
                  Submit for Review
                </Button>
              )}
              {co.status === 'submitted' && (
                <>
                  <Button size="sm" onClick={() => handleStatusChange('approved')} disabled={saving} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleStatusChange('rejected')} disabled={saving} className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">
                    Reject
                  </Button>
                </>
              )}
              {(co.status === 'approved' || co.status === 'rejected') && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('void')} disabled={saving} className="h-7 text-xs">
                  Void
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Change Order Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Change Order</DialogTitle>
            <DialogDescription>Update change order details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Reason</label>
              <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Amount</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input type="number" value={editAmount} onChange={(e) => setEditAmount(Number(e.target.value))} className="pl-7" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Linked Milestone</label>
              <Select value={editMilestoneId} onValueChange={setEditMilestoneId}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {milestones.map((ms) => <SelectItem key={ms.id} value={ms.id}>{ms.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Change Order Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Change Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{co.number} - {co.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- Modification card ---------- */
function ModificationCard({ modification: mod, projectId, isDemo, canEdit, refetch, milestones }: {
  modification: Modification;
  projectId: string;
  isDemo: boolean;
  canEdit: boolean;
  refetch: () => void;
  milestones: Milestone[];
}) {
  const linkedMilestone = milestones.find((ms) => ms.id === mod.linked_milestone_id);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<ModificationType>('plan_revision');
  const [editRevision, setEditRevision] = useState('');
  const [editAffectedDocs, setEditAffectedDocs] = useState('');
  const [editMilestoneId, setEditMilestoneId] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function openEditDialog() {
    setEditTitle(mod.title);
    setEditDescription(mod.description ?? '');
    setEditType(mod.modification_type);
    setEditRevision(mod.revision_number ?? '');
    setEditAffectedDocs(mod.affected_documents ?? '');
    setEditMilestoneId(mod.linked_milestone_id ?? '');
    setEditOpen(true);
  }

  async function handleEditSave() {
    setSaving(true);
    const data = {
      title: editTitle,
      description: editDescription,
      modification_type: editType,
      revision_number: editRevision,
      affected_documents: editAffectedDocs,
      linked_milestone_id: editMilestoneId || null,
    };
    if (isDemo) {
      storeUpdateMod(mod.id, data);
      refetch();
    } else {
      const result = await serverUpdateMod(projectId, mod.id, data);
      if (result.error) { setSaving(false); return; }
      refetch();
    }
    setSaving(false);
    setEditOpen(false);
  }

  async function handleDelete() {
    setDeleting(true);
    if (isDemo) {
      storeDeleteMod(mod.id);
      refetch();
    } else {
      const result = await serverDeleteMod(projectId, mod.id);
      if (result.error) { setDeleting(false); return; }
      refetch();
    }
    setDeleting(false);
    setDeleteOpen(false);
  }

  async function handleStatusChange(newStatus: ModificationStatus) {
    setSaving(true);
    const updateData: Partial<Modification> = { status: newStatus };
    if (newStatus === 'acknowledged') {
      updateData.acknowledged_date = new Date().toISOString().split('T')[0];
    }
    if (newStatus === 'implemented') {
      updateData.effective_date = new Date().toISOString().split('T')[0];
    }
    if (isDemo) {
      storeUpdateMod(mod.id, updateData);
      refetch();
    } else {
      const result = await serverUpdateMod(projectId, mod.id, updateData);
      if (result.error) { setSaving(false); return; }
      refetch();
    }
    setSaving(false);
  }

  return (
    <>
      <Card className="gap-0 py-4">
        <CardContent className="px-4 space-y-3">
          {/* header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <span className="text-xs font-mono text-muted-foreground">{mod.number}</span>
                <h3 className="font-semibold text-sm leading-tight">{mod.title}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${MODIFICATION_STATUS_COLORS[mod.status]}`}>
                  {MODIFICATION_STATUS_LABELS[mod.status]}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  {MODIFICATION_TYPE_LABELS[mod.modification_type]}
                </span>
                {mod.revision_number && (
                  <span className="text-xs text-muted-foreground">Rev: {mod.revision_number}</span>
                )}
              </div>
              {mod.affected_documents && (
                <p className="text-xs text-muted-foreground mt-1">Affected: {mod.affected_documents}</p>
              )}
              {mod.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{mod.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canEdit && (
                <>
                  <Button variant="ghost" size="sm" onClick={openEditDialog} className="h-7 w-7 p-0">
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* details row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {linkedMilestone && (
              <span className="flex items-center gap-1">
                <Flag className="size-3" />
                {linkedMilestone.name}
              </span>
            )}
            {mod.issued_date && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                Issued: {format(parseISO(mod.issued_date), 'MMM d, yyyy')}
              </span>
            )}
            {mod.effective_date && (
              <span className="text-emerald-700 font-medium">
                Effective: {format(parseISO(mod.effective_date), 'MMM d, yyyy')}
              </span>
            )}
            {mod.acknowledged_date && (
              <span className="text-amber-700 font-medium">
                Acknowledged: {format(parseISO(mod.acknowledged_date), 'MMM d, yyyy')}
              </span>
            )}
            {mod.issued_by_profile && (
              <span>By: {mod.issued_by_profile.full_name}</span>
            )}
          </div>

          {/* status transition buttons */}
          {canEdit && (
            <div className="flex items-center gap-2">
              {mod.status === 'draft' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('issued')} disabled={saving} className="h-7 text-xs">
                  Issue
                </Button>
              )}
              {mod.status === 'issued' && (
                <Button size="sm" onClick={() => handleStatusChange('acknowledged')} disabled={saving} className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white">
                  Acknowledge
                </Button>
              )}
              {mod.status === 'acknowledged' && (
                <Button size="sm" onClick={() => handleStatusChange('implemented')} disabled={saving} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  Implement
                </Button>
              )}
              {mod.status !== 'void' && mod.status !== 'implemented' && (
                <Button size="sm" variant="outline" onClick={() => handleStatusChange('void')} disabled={saving} className="h-7 text-xs">
                  Void
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modification Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Modification</DialogTitle>
            <DialogDescription>Update modification details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Type</label>
              <Select value={editType} onValueChange={(v) => setEditType(v as ModificationType)}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MODIFICATION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Revision Number</label>
              <Input value={editRevision} onChange={(e) => setEditRevision(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Affected Documents</label>
              <Input value={editAffectedDocs} onChange={(e) => setEditAffectedDocs(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Linked Milestone</label>
              <Select value={editMilestoneId} onValueChange={setEditMilestoneId}>
                <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {milestones.map((ms) => <SelectItem key={ms.id} value={ms.id}>{ms.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modification Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Modification</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{mod.number} - {mod.title}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
