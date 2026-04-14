'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import { addWeeklyReport as storeAddWeeklyReport } from '@/lib/store';
import { createWeeklyReport } from '@/lib/actions/weekly-reports';
import type { WeeklyReportType } from '@/lib/types';

const REPORT_TYPES: { label: string; value: WeeklyReportType }[] = [
  { label: 'CM Report', value: 'cm' },
  { label: 'Contractor Report', value: 'contractor' },
];

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function NewWeeklyReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { isDemo } = useProject();
  const { can } = usePermissions(projectId);
  const basePath = `/projects/${projectId}/weekly-reports`;

  const [reportType, setReportType] = useState<WeeklyReportType>('cm');
  const [title, setTitle] = useState('');
  const [weekStartDate, setWeekStartDate] = useState(() => {
    // Default to the most recent Monday
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    now.setDate(now.getDate() - diff);
    return now.toISOString().split('T')[0];
  });
  const [weekEndDate, setWeekEndDate] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    now.setDate(now.getDate() - diff + 6);
    return now.toISOString().split('T')[0];
  });
  const [workSummary, setWorkSummary] = useState('');
  const [scheduleSummary, setScheduleSummary] = useState('');
  const [upcomingWork, setUpcomingWork] = useState('');
  const [safetySummary, setSafetySummary] = useState('');
  const [weatherSummary, setWeatherSummary] = useState('');
  const [issuesConcerns, setIssuesConcerns] = useState('');
  const [manpowerTotal, setManpowerTotal] = useState<number>(0);
  const [equipmentHours, setEquipmentHours] = useState<number>(0);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleStartDateChange(value: string) {
    setWeekStartDate(value);
    setWeekEndDate(addDays(value, 6));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const payload = {
      report_type: reportType,
      title,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      work_summary: workSummary,
      schedule_summary: scheduleSummary,
      upcoming_work: upcomingWork,
      safety_summary: safetySummary,
      weather_summary: weatherSummary,
      issues_concerns: issuesConcerns,
      manpower_total: manpowerTotal,
      equipment_hours: equipmentHours,
    };

    if (isDemo) {
      const report = storeAddWeeklyReport(projectId, payload);
      setSuccess(true);
      setTimeout(() => router.push(`${basePath}/${report.id}`), 1200);
      return;
    }

    const result = await createWeeklyReport(projectId, payload);

    if (result.error) {
      setErrorMsg(result.error);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    if (result.data) {
      setTimeout(() => router.push(`${basePath}/${result.data!.id}`), 1200);
    } else {
      setTimeout(() => router.push(basePath), 1200);
    }
  }

  if (!can(ACTIONS.WEEKLY_REPORT_CREATE)) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reports', href: basePath }, { label: 'New Report' }]} />
        <p className="py-20 text-center text-muted-foreground">You do not have permission to create weekly reports.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CheckCircle2 className="size-12 text-rc-emerald" />
        <p className="text-lg font-medium">Weekly report created!</p>
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Reports', href: basePath },
        { label: 'New Report' },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to Reports
      </Link>

      <h1 className="font-heading text-2xl font-bold">New Weekly Report</h1>

      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Section 1: Report Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Report Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Report Type <span className="text-red-500">*</span></label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as WeeklyReportType)}>
                <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Week of March 3 — Siding 1 Progress" required className="mt-1" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Week Start Date <span className="text-red-500">*</span></label>
                <Input type="date" value={weekStartDate} onChange={(e) => handleStartDateChange(e.target.value)} required className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Week End Date</label>
                <Input type="date" value={weekEndDate} readOnly className="mt-1 bg-muted" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Work Summary */}
        <Card>
          <CardHeader><CardTitle className="text-base">Work Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Work Summary</label>
              <Textarea value={workSummary} onChange={(e) => setWorkSummary(e.target.value)} placeholder="Summarize work completed this week..." rows={4} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Schedule Summary</label>
              <Textarea value={scheduleSummary} onChange={(e) => setScheduleSummary(e.target.value)} placeholder="Schedule status, delays, milestones reached..." rows={3} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Upcoming Work</label>
              <Textarea value={upcomingWork} onChange={(e) => setUpcomingWork(e.target.value)} placeholder="Planned work for next week..." rows={3} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Safety & Weather */}
        <Card>
          <CardHeader><CardTitle className="text-base">Safety & Weather</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Safety Summary</label>
              <Textarea value={safetySummary} onChange={(e) => setSafetySummary(e.target.value)} placeholder="Safety incidents, observations, toolbox talks..." rows={3} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Weather Summary</label>
              <Textarea value={weatherSummary} onChange={(e) => setWeatherSummary(e.target.value)} placeholder="Weather conditions and impact on work..." rows={2} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Issues & Concerns</label>
              <Textarea value={issuesConcerns} onChange={(e) => setIssuesConcerns(e.target.value)} placeholder="Issues, risks, or concerns to flag..." rows={3} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Metrics */}
        <Card>
          <CardHeader><CardTitle className="text-base">Metrics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Manpower Total</label>
                <Input type="number" min={0} value={manpowerTotal} onChange={(e) => setManpowerTotal(Number(e.target.value))} placeholder="Total headcount for the week" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Equipment Hours</label>
                <Input type="number" min={0} value={equipmentHours} onChange={(e) => setEquipmentHours(Number(e.target.value))} placeholder="Total equipment hours" className="mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit / Cancel */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button type="submit" disabled={submitting || success} className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto">
            {submitting ? 'Submitting...' : 'Create Report'}
          </Button>
          <Button type="button" variant="outline" className="w-full sm:w-auto" asChild><Link href={basePath}>Cancel</Link></Button>
        </div>
      </form>
    </div>
  );
}
