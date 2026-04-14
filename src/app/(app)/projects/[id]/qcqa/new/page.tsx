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
import { usePunchListItems } from '@/hooks/useData';
import { createQCQAReport } from '@/lib/actions/qcqa';
import * as store from '@/lib/store';
import { QCQA_TYPE_LABELS, QCQA_SEVERITY_LABELS } from '@/lib/constants';
import type { QCQAReportType } from '@/lib/types';

const REPORT_TYPES: { label: string; value: QCQAReportType }[] = [
  { label: 'Inspection', value: 'inspection' },
  { label: 'Nonconformance', value: 'nonconformance' },
  { label: 'Test', value: 'test' },
  { label: 'Audit', value: 'audit' },
];

const SEVERITIES: { label: string; value: 'minor' | 'major' | 'critical' }[] = [
  { label: 'Critical', value: 'critical' },
  { label: 'Major', value: 'major' },
  { label: 'Minor', value: 'minor' },
];

export default function NewQCQAReportPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id: projectId } = use(params);
  use(searchParams);
  const router = useRouter();
  const { isDemo } = useProject();
  const basePath = `/projects/${projectId}/qcqa`;

  const [reportType, setReportType] = useState<QCQAReportType>('inspection');
  const [title, setTitle] = useState('');
  const [specReference, setSpecReference] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<'minor' | 'major' | 'critical'>('minor');
  const [description, setDescription] = useState('');
  const [findings, setFindings] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [isNonconformance, setIsNonconformance] = useState(false);
  const [linkedPunchListIds, setLinkedPunchListIds] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch open punch list items for linking
  const { data: punchListItems } = usePunchListItems(projectId);
  const openPunchItems = punchListItems.filter((p) => p.status === 'open' || p.status === 'in_progress');

  function togglePunchItem(id: string) {
    setLinkedPunchListIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    const payload = {
      report_type: reportType,
      title,
      description,
      spec_reference: specReference,
      location,
      severity,
      findings,
      corrective_action: correctiveAction,
      is_nonconformance: isNonconformance,
      linked_punch_list_ids: linkedPunchListIds,
    };

    if (isDemo) {
      const report = store.addQCQAReport(projectId, payload);
      setSuccess(true);
      setTimeout(() => router.push(`${basePath}/${report.id}`), 1200);
      return;
    }

    const result = await createQCQAReport(projectId, payload);

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

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <CheckCircle2 className="size-12 text-rc-emerald" />
        <p className="text-lg font-medium">QC/QA report created!</p>
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'QC/QA', href: basePath },
        { label: 'New Report' },
      ]} />

      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground py-2">
        <ArrowLeft className="size-4" />Back to QC/QA
      </Link>

      <h1 className="font-heading text-2xl font-bold">New QC/QA Report</h1>

      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800 text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Report Details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Report Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the report" required className="mt-1" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Report Type <span className="text-red-500">*</span></label>
                <Select value={reportType} onValueChange={(v) => setReportType(v as QCQAReportType)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Severity <span className="text-red-500">*</span></label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as 'minor' | 'major' | 'critical')}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SEVERITIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Spec Reference</label>
                <Input value={specReference} onChange={(e) => setSpecReference(e.target.value)} placeholder="e.g. 34 11 13 Section 3.2" className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Location</label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Siding 1, STA 12+50" className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the scope and purpose of this report..." rows={3} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isNonconformance"
                checked={isNonconformance}
                onChange={(e) => setIsNonconformance(e.target.checked)}
                className="size-4 rounded border-gray-300"
              />
              <label htmlFor="isNonconformance" className="text-sm font-medium">This is a Nonconformance Report (NCR)</label>
            </div>
          </CardContent>
        </Card>

        {/* Findings */}
        <Card>
          <CardHeader><CardTitle className="text-base">Findings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Findings</label>
              <Textarea value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Document inspection findings, test results, or audit observations..." rows={4} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Corrective Action</label>
              <Textarea value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} placeholder="Required corrective actions, if any..." rows={3} className="mt-1" />
            </div>
          </CardContent>
        </Card>

        {/* Punch List Linking */}
        {openPunchItems.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Link Punch List Items</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">Select open punch list items related to this report.</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {openPunchItems.map((pl) => (
                  <label key={pl.id} className="flex items-start gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkedPunchListIds.includes(pl.id)}
                      onChange={() => togglePunchItem(pl.id)}
                      className="size-4 rounded border-gray-300 mt-0.5"
                    />
                    <div className="text-sm">
                      <span className="font-medium text-rc-blue">{pl.number}</span>
                      <span className="mx-1">&mdash;</span>
                      <span>{pl.title}</span>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button type="submit" disabled={submitting || success} className="bg-rc-orange hover:bg-rc-orange-dark text-white w-full sm:w-auto">
            {submitting ? 'Creating...' : 'Create Report'}
          </Button>
          <Button type="button" variant="outline" className="w-full sm:w-auto" asChild><Link href={basePath}>Cancel</Link></Button>
        </div>
      </form>
    </div>
  );
}
