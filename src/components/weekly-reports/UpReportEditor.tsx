'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createProjectUpWeeklyReport,
  updateProjectUpWeeklyReport,
  type UpReportWorkspaceDetail,
} from '@/lib/actions/up-weekly-reports';
import {
  UP_MILESTONE_STATUSES,
  UP_RISK_SEVERITIES,
  UP_RISK_STATUSES,
  type UpReportInputs,
} from '@/lib/up-reports/model';

interface Props {
  mode: 'create' | 'edit';
  projectId: string;
  reportId?: string;
  initialTitle: string;
  initialInputs: UpReportInputs;
  weekStartDate: string;
  weekEndDate: string;
  templateLabel: string;
  reviewStatus?: 'draft' | 'reviewed';
  warnings?: string[];
  onSaved?: (detail: UpReportWorkspaceDetail) => void;
}

type MoneyKey =
  | 'contractAmount'
  | 'billedToDate'
  | 'billingThisPeriod'
  | 'workOrderAuthorization'
  | 'workOrderSpend';

const MONEY_FIELDS: Array<{ key: MoneyKey; label: string }> = [
  { key: 'contractAmount', label: 'Contract amount' },
  { key: 'billedToDate', label: 'Billed to date' },
  { key: 'billingThisPeriod', label: 'Billing this period' },
  { key: 'workOrderAuthorization', label: 'Work-order authorization' },
  { key: 'workOrderSpend', label: 'Work-order spend' },
];

function labelValue(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function UpReportEditor({
  mode,
  projectId,
  reportId,
  initialTitle,
  initialInputs,
  weekStartDate,
  weekEndDate,
  templateLabel,
  reviewStatus = 'draft',
  warnings = [],
  onSaved,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [inputs, setInputs] = useState<UpReportInputs>(initialInputs);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(initialTitle);
    setInputs(initialInputs);
  }, [initialInputs, initialTitle]);

  function update<K extends keyof UpReportInputs>(key: K, value: UpReportInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  function updateMoney(key: MoneyKey, value: string) {
    update(key, value === '' ? null : Number(value));
  }

  async function handleSave(markReviewed: boolean) {
    setSaving(true);
    setError(null);
    if (mode === 'create') {
      const result = await createProjectUpWeeklyReport(projectId, {
        title,
        weekStartDate,
        weekEndDate,
        inputs,
      });
      if (result.success !== true) {
        setError(result.error);
      } else {
        router.push(`/projects/${projectId}/weekly-reports/up/${result.data.reportId}`);
      }
      setSaving(false);
      return;
    }

    if (!reportId) {
      setError('Report identity is missing');
      setSaving(false);
      return;
    }
    const result = await updateProjectUpWeeklyReport(projectId, reportId, {
      title,
      inputs,
      markReviewed,
    });
    if (result.success !== true) {
      setError(result.error);
    } else {
      onSaved?.(result.data);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Report identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{templateLabel}</p>
            <p className="text-xs text-muted-foreground">
              Project/account scope is frozen with the report. Week: {weekStartDate} to{' '}
              {weekEndDate}.
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Report title</label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Dashboard number</label>
              <Input
                value={inputs.dashboardNumber}
                onChange={(event) => update('dashboardNumber', event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Project manager</label>
              <Input
                value={inputs.projectManager}
                onChange={(event) => update('projectManager', event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Contractor</label>
              <Input
                value={inputs.contractor}
                onChange={(event) => update('contractor', event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">NTP</label>
                <Input
                  type="date"
                  value={inputs.ntpDate}
                  onChange={(event) => update('ntpDate', event.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Est. completion</label>
                <Input
                  type="date"
                  value={inputs.estimatedCompletionDate}
                  onChange={(event) =>
                    update('estimatedCompletionDate', event.target.value)
                  }
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">Review required</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress and project snapshot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Track-construction progress</label>
            <Textarea
              value={inputs.trackConstructionProgress}
              onChange={(event) =>
                update('trackConstructionProgress', event.target.value)
              }
              rows={5}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Project snapshot</label>
            <Textarea
              value={inputs.projectSnapshot}
              onChange={(event) => update('projectSnapshot', event.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contract, billings, and work orders</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-muted-foreground">
            These values are manual reviewed inputs in this phase. RailCommand project
            budget fields are not treated as authoritative billings or work-order spend.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MONEY_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="text-sm font-medium">{field.label}</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={inputs[field.key] ?? ''}
                  onChange={(event) => updateMoney(field.key, event.target.value)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly activities</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">This week</label>
            <Textarea
              value={inputs.thisWeekActivities}
              onChange={(event) => update('thisWeekActivities', event.target.value)}
              rows={10}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Next week</label>
            <Textarea
              value={inputs.nextWeekActivities}
              onChange={(event) => update('nextWeekActivities', event.target.value)}
              rows={10}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            Milestones
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update('milestones', [
                  ...inputs.milestones,
                  {
                    name: '',
                    targetDate: '',
                    status: 'not_started',
                    percentComplete: 0,
                    notes: '',
                  },
                ])
              }
            >
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inputs.milestones.length === 0 && (
            <p className="text-sm text-muted-foreground">No milestones selected.</p>
          )}
          {inputs.milestones.map((milestone, index) => (
            <div key={`${milestone.sourceId ?? 'new'}-${index}`} className="rounded-md border p-3">
              <div className="grid gap-3 md:grid-cols-4">
                <Input
                  value={milestone.name}
                  onChange={(event) => {
                    const next = [...inputs.milestones];
                    next[index] = { ...milestone, name: event.target.value };
                    update('milestones', next);
                  }}
                  placeholder="Milestone"
                  className="md:col-span-2"
                />
                <Input
                  type="date"
                  value={milestone.targetDate}
                  onChange={(event) => {
                    const next = [...inputs.milestones];
                    next[index] = { ...milestone, targetDate: event.target.value };
                    update('milestones', next);
                  }}
                />
                <Select
                  value={milestone.status}
                  onValueChange={(value) => {
                    const next = [...inputs.milestones];
                    next[index] = {
                      ...milestone,
                      status: value as (typeof UP_MILESTONE_STATUSES)[number],
                    };
                    update('milestones', next);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UP_MILESTONE_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>{labelValue(status)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[140px_1fr_auto]">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={milestone.percentComplete}
                  onChange={(event) => {
                    const next = [...inputs.milestones];
                    next[index] = {
                      ...milestone,
                      percentComplete: Number(event.target.value),
                    };
                    update('milestones', next);
                  }}
                  aria-label="Percent complete"
                />
                <Input
                  value={milestone.notes}
                  onChange={(event) => {
                    const next = [...inputs.milestones];
                    next[index] = { ...milestone, notes: event.target.value };
                    update('milestones', next);
                  }}
                  placeholder="Notes"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    update(
                      'milestones',
                      inputs.milestones.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label="Remove milestone"
                >
                  <Trash2 className="size-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3 text-base">
            Risks
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                update('risks', [
                  ...inputs.risks,
                  {
                    category: '',
                    description: '',
                    champion: '',
                    severity: 'medium',
                    status: 'open',
                  },
                ])
              }
            >
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inputs.risks.length === 0 && (
            <p className="text-sm text-muted-foreground">No risks selected.</p>
          )}
          {inputs.risks.map((risk, index) => (
            <div key={`${risk.sourceId ?? 'new'}-${index}`} className="rounded-md border p-3">
              <div className="grid gap-3 md:grid-cols-4">
                <Input
                  value={risk.category}
                  onChange={(event) => {
                    const next = [...inputs.risks];
                    next[index] = { ...risk, category: event.target.value };
                    update('risks', next);
                  }}
                  placeholder="Category"
                />
                <Input
                  value={risk.champion}
                  onChange={(event) => {
                    const next = [...inputs.risks];
                    next[index] = { ...risk, champion: event.target.value };
                    update('risks', next);
                  }}
                  placeholder="Champion"
                />
                <Select
                  value={risk.severity}
                  onValueChange={(value) => {
                    const next = [...inputs.risks];
                    next[index] = {
                      ...risk,
                      severity: value as (typeof UP_RISK_SEVERITIES)[number],
                    };
                    update('risks', next);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UP_RISK_SEVERITIES.map((severity) => (
                      <SelectItem key={severity} value={severity}>
                        {labelValue(severity)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={risk.status}
                  onValueChange={(value) => {
                    const next = [...inputs.risks];
                    next[index] = {
                      ...risk,
                      status: value as (typeof UP_RISK_STATUSES)[number],
                    };
                    update('risks', next);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UP_RISK_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {labelValue(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 flex gap-3">
                <Textarea
                  value={risk.description}
                  onChange={(event) => {
                    const next = [...inputs.risks];
                    next[index] = { ...risk, description: event.target.value };
                    update('risks', next);
                  }}
                  rows={2}
                  placeholder="Risk description"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    update(
                      'risks',
                      inputs.risks.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  aria-label="Remove risk"
                >
                  <Trash2 className="size-4 text-red-600" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => handleSave(false)}
          disabled={saving || !title.trim()}
        >
          <Save className="mr-2 size-4" />
          {saving ? 'Saving…' : mode === 'create' ? 'Create draft' : 'Save draft'}
        </Button>
        {mode === 'edit' && (
          <Button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving || !title.trim()}
            className="bg-rc-emerald text-white hover:bg-rc-emerald/90"
          >
            <ShieldCheck className="mr-2 size-4" />
            {saving
              ? 'Saving…'
              : reviewStatus === 'reviewed'
                ? 'Save reviewed report'
                : 'Save and mark reviewed'}
          </Button>
        )}
      </div>
    </div>
  );
}
