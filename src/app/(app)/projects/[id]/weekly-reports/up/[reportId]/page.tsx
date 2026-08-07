'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import UpReportEditor from '@/components/weekly-reports/UpReportEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProject } from '@/components/providers/ProjectProvider';
import { usePermissions } from '@/hooks/usePermissions';
import { ACTIONS } from '@/lib/permissions';
import {
  generateProjectUpReportArtifact,
  getProjectUpWeeklyReport,
  type UpReportWorkspaceDetail,
} from '@/lib/actions/up-weekly-reports';

function downloadBase64(contentBase64: string, mimeType: string, fileName: string) {
  const binary = window.atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ProjectUpWeeklyReportPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id: projectId, reportId } = use(params);
  const { isDemo } = useProject();
  const { can } = usePermissions(projectId);
  const [data, setData] = useState<UpReportWorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (isDemo) return;
    setLoading(true);
    const result = await getProjectUpWeeklyReport(projectId, reportId);
    if (result.success !== true) {
      setError(result.error);
      setData(null);
    } else {
      setError(null);
      setData(result.data);
    }
    setLoading(false);
  }, [isDemo, projectId, reportId]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    const result = await generateProjectUpReportArtifact(projectId, reportId);
    if (result.success !== true) {
      setError(result.error);
    } else {
      downloadBase64(
        result.data.contentBase64,
        result.data.mimeType,
        result.data.fileName,
      );
    }
    setDownloading(false);
  }

  if (isDemo || !can(ACTIONS.BUDGET_VIEW)) {
    return (
      <p className="py-20 text-center text-muted-foreground">
        This project-scoped report requires authenticated budget access.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="size-6 animate-spin rounded-full border-2 border-rc-orange/30 border-t-rc-orange" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', href: '/dashboard' },
            {
              label: 'Reports',
              href: `/projects/${projectId}/weekly-reports`,
            },
            { label: 'Construction Report' },
          ]}
        />
        <p className="py-20 text-center text-red-700">
          {error ?? 'Project-scoped construction report not found.'}
        </p>
      </div>
    );
  }

  const canEdit =
    can(ACTIONS.WEEKLY_REPORT_CREATE) && can(ACTIONS.BUDGET_VIEW);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/dashboard' },
          {
            label: 'Reports',
            href: `/projects/${projectId}/weekly-reports`,
          },
          { label: data.report.number },
        ]}
      />
      <Link
        href={`/projects/${projectId}/weekly-reports`}
        className="inline-flex items-center gap-1 py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to reports
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-2xl font-bold">
              {data.report.number} — {data.report.title}
            </h1>
            <Badge variant={data.detail.review_status === 'reviewed' ? 'default' : 'secondary'}>
              {data.detail.review_status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.template.name} v{data.detail.template_version}
          </p>
        </div>
        {data.detail.review_status === 'reviewed' && (
          <Button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="bg-rc-blue text-white hover:bg-rc-blue/90"
          >
            <Download className="mr-2 size-4" />
            {downloading ? 'Preparing…' : 'Download completed Excel report'}
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 size-4 text-rc-emerald" />
            <div>
              <p className="text-sm font-medium">Frozen project scope</p>
              <p className="text-xs text-muted-foreground">
                Account, project, workbook, and version are immutable.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileSpreadsheet className="mt-0.5 size-4 text-rc-blue" />
            <div>
              <p className="text-sm font-medium">Versioned Excel workbook</p>
              <p className="text-xs text-muted-foreground">
                RailCommand generates an editable workbook from reviewed project data.
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Download-only delivery</p>
            <p className="text-xs text-muted-foreground">
              This workflow has no email or external delivery action.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {canEdit ? (
        <UpReportEditor
          mode="edit"
          projectId={projectId}
          reportId={reportId}
          initialTitle={data.report.title}
          initialInputs={data.detail.report_inputs}
          weekStartDate={data.report.week_start_date}
          weekEndDate={data.report.week_end_date}
          templateLabel={`${data.template.name} — v${data.detail.template_version}`}
          reviewStatus={data.detail.review_status}
          warnings={data.detail.source_snapshot.warnings}
          onSaved={setData}
        />
      ) : (
        <p className="rounded-md border p-4 text-sm text-muted-foreground">
          You can view and download this reviewed report, but your project role cannot
          edit weekly report content.
        </p>
      )}
    </div>
  );
}
