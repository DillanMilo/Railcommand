'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  configureProjectRailCommandWorkbook,
  getUpReportingWorkspace,
  type UpReportingWorkspace,
} from '@/lib/actions/up-weekly-reports';
import type { UpManualDefaults } from '@/lib/up-reports/model';
import {
  RAILCOMMAND_STANDARD_TEMPLATE_KEY,
  RAILCOMMAND_STANDARD_TEMPLATE_VERSION,
} from '@/lib/up-reports/standard';

interface Props {
  projectId: string;
  isDemo: boolean;
  canConfigure: boolean;
  canCreate: boolean;
}

export default function UpReportingWorkspaceCard({
  projectId,
  isDemo,
  canConfigure,
  canCreate,
}: Props) {
  const [workspace, setWorkspace] = useState<UpReportingWorkspace | null>(null);
  const [loading, setLoading] = useState(!isDemo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectManager, setProjectManager] = useState('');
  const [contractor, setContractor] = useState('');
  const [ntpDate, setNtpDate] = useState('');
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState('');

  const refresh = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    const result = await getUpReportingWorkspace(projectId);
    if (result.success !== true) {
      setError(result.error);
      setWorkspace(null);
    } else {
      setError(null);
      setWorkspace(result.data);
      const config = result.data.config;
      setProjectManager(config?.manual_defaults.projectManager ?? '');
      setContractor(config?.manual_defaults.contractor ?? '');
      setNtpDate(config?.manual_defaults.ntpDate ?? '');
      setEstimatedCompletionDate(
        config?.manual_defaults.estimatedCompletionDate ?? '',
      );
    }
    setLoading(false);
  }, [isDemo, projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleConfigure() {
    setSaving(true);
    setError(null);
    try {
      const manualDefaults: UpManualDefaults = {
        projectManager,
        contractor,
        ntpDate,
        estimatedCompletionDate,
      };
      const result = await configureProjectRailCommandWorkbook(projectId, {
        manualDefaults,
      });
      if (result.success !== true) setError(result.error);
      else await refresh();
    } catch {
      setError('RailCommand could not save the workbook setup. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (isDemo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly construction workbook</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Project-scoped workbook generation is available only for authenticated
          account projects, not shared demo data.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <span className="size-4 animate-spin rounded-full border-2 border-rc-orange/30 border-t-rc-orange" />
          Loading project-scoped reporting…
        </CardContent>
      </Card>
    );
  }

  const setupMissing = error?.includes(
    'UP reporting database setup is not installed',
  ) ?? false;
  const selectedTemplate = workspace?.selectedTemplate ?? null;
  const standardEnabled =
    selectedTemplate?.variant_key === RAILCOMMAND_STANDARD_TEMPLATE_KEY
    && selectedTemplate.version === RAILCOMMAND_STANDARD_TEMPLATE_VERSION;
  const differentTemplateAssigned = Boolean(selectedTemplate && !standardEnabled);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-5 text-rc-emerald" />
          RailCommand weekly construction workbook
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0 text-rc-blue" />
            <div>
              <p className="font-medium">No client spreadsheet is required.</p>
              <p className="mt-1 text-blue-900/80">
                RailCommand builds a formatted, editable Excel workbook from this
                project&apos;s reviewed report data. The file is download-only and is
                never emailed automatically.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className={
              setupMissing
                ? 'rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'
                : 'rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700'
            }
          >
            <p className="font-medium">
              {setupMissing ? 'Database setup required' : 'Reporting unavailable'}
            </p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {canConfigure && !setupMissing && (
          <div className="space-y-4 rounded-md border p-4">
            <div>
              <h3 className="text-sm font-semibold">Project report defaults</h3>
              <p className="text-xs text-muted-foreground">
                These values stay inside this project and remain editable during every
                report review.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="report-project-manager" className="text-sm font-medium">
                  Project manager default
                </label>
                <Input
                  id="report-project-manager"
                  value={projectManager}
                  onChange={(event) => setProjectManager(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="report-contractor" className="text-sm font-medium">
                  Contractor default
                </label>
                <Input
                  id="report-contractor"
                  value={contractor}
                  onChange={(event) => setContractor(event.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label htmlFor="report-ntp-date" className="text-sm font-medium">
                  Notice to proceed
                </label>
                <Input
                  id="report-ntp-date"
                  type="date"
                  value={ntpDate}
                  onChange={(event) => setNtpDate(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="report-estimated-completion" className="text-sm font-medium">
                  Estimated completion
                </label>
                <Input
                  id="report-estimated-completion"
                  type="date"
                  value={estimatedCompletionDate}
                  onChange={(event) => setEstimatedCompletionDate(event.target.value)}
                />
              </div>
            </div>

            {differentTemplateAssigned && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                This project currently uses an earlier or custom workbook. Enabling
                the current RailCommand workbook affects new reports only; existing
                reviewed reports keep their frozen workbook version.
              </div>
            )}

            <Button type="button" onClick={handleConfigure} disabled={saving}>
              {standardEnabled ? (
                <Save className="mr-2 size-4" />
              ) : (
                <Sparkles className="mr-2 size-4" />
              )}
              {saving
                ? 'Saving…'
                : standardEnabled
                  ? 'Save report defaults'
                  : 'Enable RailCommand workbook'}
            </Button>
          </div>
        )}

        {!setupMissing && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              {standardEnabled ? (
                <CheckCircle2 className="mt-0.5 size-4 text-rc-emerald" />
              ) : (
                <FileSpreadsheet className="mt-0.5 size-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {standardEnabled
                    ? 'RailCommand standard workbook enabled'
                    : differentTemplateAssigned
                      ? 'Earlier or custom workbook assigned'
                      : 'Workbook generation is not enabled'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {standardEnabled
                    ? `Editable .xlsx · standard version ${RAILCOMMAND_STANDARD_TEMPLATE_VERSION}`
                    : canConfigure
                      ? 'Enable the standard workbook to create construction reports without uploading a template.'
                      : 'A project manager must enable the standard workbook first.'}
                </p>
              </div>
            </div>
            {canCreate && standardEnabled && (
              <Button asChild className="bg-rc-blue text-white hover:bg-rc-blue/90">
                <Link href={`/projects/${projectId}/weekly-reports/up/new`}>
                  <FileSpreadsheet className="mr-2 size-4" />
                  New construction report
                </Link>
              </Button>
            )}
          </div>
        )}

        {!setupMissing && workspace && workspace.reports.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Construction reports</h3>
            {workspace.reports.map((report) => (
              <Link
                key={report.id}
                href={`/projects/${projectId}/weekly-reports/up/${report.id}`}
                className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {report.number} — {report.title}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {report.week_start_date} to {report.week_end_date} ·{' '}
                    {report.template_name} v{report.template_version}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs">
                  {report.review_status === 'reviewed' && <Download className="size-3" />}
                  {report.review_status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
