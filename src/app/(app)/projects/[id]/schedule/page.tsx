'use client';

import { useState, useMemo, use } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Flag, Calendar, DollarSign, TrendingUp, AlertTriangle, FileCheck, MessageSquareMore, Plus, Pencil, Trash2 } from 'lucide-react';
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
import { useMilestones } from '@/hooks/useData';
import { useProject } from '@/components/providers/ProjectProvider';
import ExportPDFButton from '@/components/shared/ExportPDFButton';
import { getCurrentUserId, getProfileWithOrg } from '@/lib/store';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import { createMilestone as serverCreateMilestone, updateMilestone as serverUpdateMilestone, deleteMilestone as serverDeleteMilestone } from '@/lib/actions/milestones';
import { addMilestone as storeAddMilestone, updateMilestone as storeUpdateMilestone, deleteMilestone as storeDeleteMilestone } from '@/lib/store';
import type { Milestone, MilestoneStatus } from '@/lib/types';

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
  const { data: rawMilestones, refetch } = useMilestones(projectId);
  const milestones = [...rawMilestones].sort((a, b) => a.sort_order - b.sort_order);
  const kpis = useKPIs(milestones);

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

  function resetAddForm() {
    setAddName('');
    setAddDescription('');
    setAddTargetDate('');
    setAddStatus('not_started');
    setAddPercent(0);
    setAddBudgetPlanned(0);
    setAddBudgetActual(0);
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
