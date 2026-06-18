'use client';

import React, { useMemo, useState } from 'react';
import { Download, FileDown, FileText, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getActivityLog as fetchActivityLog } from '@/lib/actions/activity-log';
import { cn } from '@/lib/utils';
import * as store from '@/lib/store';
import type { ChangeOrder, Milestone, Modification, Project } from '@/lib/types';
import {
  ALL_HISTORY_EXPORT_SECTIONS,
  CHANGE_ORDER_PACKAGE_SECTIONS,
  HISTORY_EXPORT_SECTIONS,
  buildProjectHistoryCsv,
  getHistoryExportFileName,
  type HistoryExportFormat,
  type HistoryExportSection,
  type ProjectHistoryExportData,
} from '@/lib/project-history-export';

interface ProjectHistoryExportButtonProps {
  projectId: string;
  project: Project | null | undefined;
  milestones: Milestone[];
  changeOrders: ChangeOrder[];
  modifications: Modification[];
  generatedBy: string;
  isDemo: boolean;
}

function orderSections(sections: HistoryExportSection[]) {
  return HISTORY_EXPORT_SECTIONS.map((section) => section.id).filter((section) => sections.includes(section));
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  window.document.body.appendChild(link);
  link.click();
  window.document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ProjectHistoryExportButton({
  projectId,
  project,
  milestones,
  changeOrders,
  modifications,
  generatedBy,
  isDemo,
}: ProjectHistoryExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<HistoryExportFormat>('pdf');
  const [selectedSections, setSelectedSections] = useState<HistoryExportSection[]>(ALL_HISTORY_EXPORT_SECTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSet = useMemo(() => new Set(selectedSections), [selectedSections]);
  const canExport = Boolean(project) && selectedSections.length > 0 && !loading;

  const toggleSection = (section: HistoryExportSection) => {
    setSelectedSections((current) => {
      if (current.includes(section)) {
        return current.filter((item) => item !== section);
      }
      return orderSections([...current, section]);
    });
  };

  const loadActivityLog = async () => {
    if (!selectedSet.has('activity')) return [];
    if (isDemo) return store.getActivityLog(projectId);

    const result = await fetchActivityLog(projectId, 'all');
    if (result.error) throw new Error(result.error);
    return result.data ?? [];
  };

  const buildExportData = async (): Promise<ProjectHistoryExportData> => {
    if (!project) throw new Error('Project data is not available yet.');
    return {
      project,
      milestones,
      changeOrders,
      modifications,
      activityLog: await loadActivityLog(),
    };
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const orderedSections = orderSections(selectedSections);
      const data = await buildExportData();
      const fileName = getHistoryExportFileName(data.project.name, format);

      if (format === 'csv') {
        const csv = buildProjectHistoryCsv(data, orderedSections);
        downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), fileName);
      } else {
        const [{ pdf }, { default: ProjectHistoryPDF }] = await Promise.all([
          import('@react-pdf/renderer'),
          import('@/lib/pdf/ProjectHistoryPDF'),
        ]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blob = await pdf(<ProjectHistoryPDF data={data} sections={orderedSections} generatedBy={generatedBy} /> as any).toBlob();
        downloadBlob(blob, fileName);
      }

      setOpen(false);
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : 'Failed to export project history.';
      setError(message);
      console.error('Failed to export project history:', exportError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={!project}>
        <FileDown />
        History Export
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Export Project History</DialogTitle>
            <DialogDescription>
              Build a project package from current schedule data and historical activity.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium">Format</label>
              <div className="mt-2 grid grid-cols-2 rounded-md border p-1">
                <button
                  type="button"
                  aria-pressed={format === 'pdf'}
                  onClick={() => setFormat('pdf')}
                  className={cn(
                    'inline-flex h-9 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors',
                    format === 'pdf'
                      ? 'bg-rc-orange text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <FileText className="size-4" />
                  PDF
                </button>
                <button
                  type="button"
                  aria-pressed={format === 'csv'}
                  onClick={() => setFormat('csv')}
                  className={cn(
                    'inline-flex h-9 items-center justify-center gap-2 rounded-sm text-sm font-medium transition-colors',
                    format === 'csv'
                      ? 'bg-rc-orange text-white'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Table className="size-4" />
                  CSV
                </button>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-sm font-medium">Package Contents</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSections(CHANGE_ORDER_PACKAGE_SECTIONS)}
                  >
                    CO Package
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedSections(ALL_HISTORY_EXPORT_SECTIONS)}
                  >
                    Entire History
                  </Button>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {HISTORY_EXPORT_SECTIONS.map((section) => (
                  <label
                    key={section.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(section.id)}
                      onChange={() => toggleSection(section.id)}
                      className="mt-1 size-4 accent-rc-orange"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{section.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{section.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={!canExport} className="bg-rc-orange hover:bg-rc-orange-dark text-white">
              <Download className="size-4" />
              {loading ? 'Exporting...' : `Export ${format.toUpperCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
