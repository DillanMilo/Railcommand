'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import UpReportEditor from '@/components/weekly-reports/UpReportEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import { getProjectUpReportPrefill } from '@/lib/actions/up-weekly-reports';
import {
  emptyUpReportInputs,
  type UpReportInputs,
  type UpTemplateVariant,
} from '@/lib/up-reports/model';

function currentReportingWeek() {
  const date = new Date();
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

export default function NewProjectUpWeeklyReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = use(params);
  const { isDemo } = useProject();
  const { can } = usePermissions(projectId);
  const initialWeek = currentReportingWeek();
  const [weekStartDate, setWeekStartDate] = useState(initialWeek.start);
  const [weekEndDate, setWeekEndDate] = useState(initialWeek.end);
  const [inputs, setInputs] = useState<UpReportInputs>(emptyUpReportInputs());
  const [template, setTemplate] = useState<UpTemplateVariant | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPrefill = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getProjectUpReportPrefill(projectId, {
      weekStartDate,
      weekEndDate,
    });
    if (result.success !== true) {
      setError(result.error);
      setLoaded(false);
    } else {
      setInputs(result.data.inputs);
      setTemplate(result.data.template);
      setWarnings(result.data.sourceSnapshot.warnings);
      setLoaded(true);
    }
    setLoading(false);
  }, [projectId, weekEndDate, weekStartDate]);

  useEffect(() => {
    if (
      !isDemo
      && can(ACTIONS.WEEKLY_REPORT_CREATE)
      && can(ACTIONS.BUDGET_VIEW)
    ) {
      void loadPrefill();
    }
  }, [can, isDemo, loadPrefill]);

  if (
    isDemo
    || !can(ACTIONS.WEEKLY_REPORT_CREATE)
    || !can(ACTIONS.BUDGET_VIEW)
  ) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            {
              label: 'Reports',
              href: `/projects/${projectId}/weekly-reports`,
            },
            { label: 'New Construction Report' },
          ]}
        />
        <p className="py-20 text-center text-muted-foreground">
          This workflow requires an authenticated project membership with weekly
          report and budget permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          {
            label: 'Reports',
            href: `/projects/${projectId}/weekly-reports`,
          },
          { label: 'New Construction Report' },
        ]}
      />
      <Link
        href={`/projects/${projectId}/weekly-reports`}
        className="inline-flex items-center gap-1 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to reports
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-bold">New weekly construction report</h1>
        <p className="text-sm text-muted-foreground">
          Prefill from this project, review every field, and generate an editable Excel workbook.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div>
            <label className="text-sm font-medium">Week start</label>
            <Input
              type="date"
              value={weekStartDate}
              onChange={(event) => {
                setWeekStartDate(event.target.value);
                setLoaded(false);
              }}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Week end</label>
            <Input
              type="date"
              value={weekEndDate}
              onChange={(event) => {
                setWeekEndDate(event.target.value);
                setLoaded(false);
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={loadPrefill} disabled={loading}>
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading…' : loaded ? 'Refresh project prefill' : 'Load project prefill'}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loaded && template && (
        <UpReportEditor
          mode="create"
          projectId={projectId}
          initialTitle={`Weekly Construction Report — Week Ending ${weekEndDate}`}
          initialInputs={inputs}
          weekStartDate={weekStartDate}
          weekEndDate={weekEndDate}
          templateLabel={`${template.name} — v${template.version}`}
          warnings={warnings}
        />
      )}
    </div>
  );
}
