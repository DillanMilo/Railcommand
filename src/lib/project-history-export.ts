import type { ActivityLogEntry, ChangeOrder, Milestone, Modification, Project } from '@/lib/types';

export type HistoryExportSection =
  | 'project'
  | 'changeOrders'
  | 'modifications'
  | 'milestones'
  | 'activity';

export type HistoryExportFormat = 'pdf' | 'csv';

export interface ProjectHistoryExportData {
  project: Project;
  milestones: Milestone[];
  changeOrders: ChangeOrder[];
  modifications: Modification[];
  activityLog: ActivityLogEntry[];
}

export interface HistoryExportSectionConfig {
  id: HistoryExportSection;
  label: string;
  description: string;
}

export const HISTORY_EXPORT_SECTIONS: HistoryExportSectionConfig[] = [
  {
    id: 'project',
    label: 'Project snapshot',
    description: 'Current project dates, budget, client, status, and benchmarks.',
  },
  {
    id: 'changeOrders',
    label: 'Change orders',
    description: 'CO numbers, status, amount, approval dates, reason, and linked milestone.',
  },
  {
    id: 'modifications',
    label: 'Modifications',
    description: 'Plan revisions, amendments, affected documents, and milestone links.',
  },
  {
    id: 'milestones',
    label: 'Milestones',
    description: 'Schedule status, target dates, progress, and budget rollup.',
  },
  {
    id: 'activity',
    label: 'Activity history',
    description: 'Full chronological project activity log.',
  },
];

export const ALL_HISTORY_EXPORT_SECTIONS = HISTORY_EXPORT_SECTIONS.map((section) => section.id);

export const CHANGE_ORDER_PACKAGE_SECTIONS: HistoryExportSection[] = [
  'project',
  'changeOrders',
  'modifications',
  'milestones',
];

export interface NormalizedHistoryRow {
  section: string;
  record_type: string;
  record_id: string;
  number: string;
  title: string;
  status: string;
  date: string;
  secondary_date: string;
  actor: string;
  amount: string;
  linked_milestone: string;
  description: string;
  details: string;
}

const CSV_COLUMNS: (keyof NormalizedHistoryRow)[] = [
  'section',
  'record_type',
  'record_id',
  'number',
  'title',
  'status',
  'date',
  'secondary_date',
  'actor',
  'amount',
  'linked_milestone',
  'description',
  'details',
];

export function hasExportSection(sections: HistoryExportSection[], section: HistoryExportSection) {
  return sections.includes(section);
}

export function formatHistoryLabel(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatHistoryDate(value: string | null | undefined): string {
  if (!value) return '';
  return value.split('T')[0];
}

export function formatHistoryDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString();
}

export function formatHistoryCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function sanitizeExportFileName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'project';
}

export function getHistoryExportFileName(
  projectName: string,
  format: HistoryExportFormat,
  exportedAt = new Date(),
): string {
  return `${sanitizeExportFileName(projectName)}-history-export-${exportedAt.toISOString().split('T')[0]}.${format}`;
}

function compareDateAsc(a: string | null | undefined, b: string | null | undefined) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return aTime - bTime;
}

function compactDetails(parts: Array<[string, string | number | null | undefined]>) {
  return parts
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `${label}: ${value}`)
    .join(' | ');
}

function getMilestoneNames(milestones: Milestone[]) {
  return new Map(milestones.map((milestone) => [milestone.id, milestone.name]));
}

export function buildNormalizedHistoryRows(
  data: ProjectHistoryExportData,
  sections: HistoryExportSection[],
): NormalizedHistoryRow[] {
  const rows: NormalizedHistoryRow[] = [];
  const milestoneNames = getMilestoneNames(data.milestones);

  if (hasExportSection(sections, 'project')) {
    rows.push({
      section: 'Project Snapshot',
      record_type: 'Project',
      record_id: data.project.id,
      number: '',
      title: data.project.name,
      status: formatHistoryLabel(data.project.status),
      date: formatHistoryDate(data.project.start_date),
      secondary_date: formatHistoryDate(data.project.target_end_date),
      actor: '',
      amount: String(data.project.budget_total),
      linked_milestone: '',
      description: data.project.description,
      details: compactDetails([
        ['Client', data.project.client],
        ['Location', data.project.location],
        ['Budget spent', data.project.budget_spent],
        ['Actual end', formatHistoryDate(data.project.actual_end_date)],
        ['Turnover', formatHistoryDate(data.project.turnover_date)],
        ['Substantial completion', formatHistoryDate(data.project.substantial_completion_date)],
        ['Project completion', formatHistoryDate(data.project.project_completion_date)],
        ['Created at', formatHistoryDateTime(data.project.created_at)],
      ]),
    });
  }

  if (hasExportSection(sections, 'changeOrders')) {
    [...data.changeOrders]
      .sort((a, b) => compareDateAsc(a.submit_date ?? a.created_at, b.submit_date ?? b.created_at))
      .forEach((changeOrder) => {
        rows.push({
          section: 'Change Orders',
          record_type: 'Change Order',
          record_id: changeOrder.id,
          number: changeOrder.number,
          title: changeOrder.title,
          status: formatHistoryLabel(changeOrder.status),
          date: formatHistoryDate(changeOrder.submit_date),
          secondary_date: formatHistoryDate(changeOrder.approval_date),
          actor: changeOrder.submitted_by_profile?.full_name ?? '',
          amount: String(changeOrder.amount),
          linked_milestone: changeOrder.linked_milestone_id
            ? milestoneNames.get(changeOrder.linked_milestone_id) ?? changeOrder.linked_milestone_id
            : '',
          description: changeOrder.description,
          details: compactDetails([
            ['Reason', changeOrder.reason],
            ['Approved by', changeOrder.approved_by_profile?.full_name],
            ['Created at', formatHistoryDateTime(changeOrder.created_at)],
          ]),
        });
      });
  }

  if (hasExportSection(sections, 'modifications')) {
    [...data.modifications]
      .sort((a, b) => compareDateAsc(a.issued_date ?? a.created_at, b.issued_date ?? b.created_at))
      .forEach((modification) => {
        rows.push({
          section: 'Modifications',
          record_type: 'Modification',
          record_id: modification.id,
          number: modification.number,
          title: modification.title,
          status: formatHistoryLabel(modification.status),
          date: formatHistoryDate(modification.issued_date),
          secondary_date: formatHistoryDate(modification.effective_date ?? modification.acknowledged_date),
          actor: modification.issued_by_profile?.full_name ?? '',
          amount: '',
          linked_milestone: modification.linked_milestone_id
            ? milestoneNames.get(modification.linked_milestone_id) ?? modification.linked_milestone_id
            : '',
          description: modification.description,
          details: compactDetails([
            ['Type', formatHistoryLabel(modification.modification_type)],
            ['Revision', modification.revision_number],
            ['Affected documents', modification.affected_documents],
            ['Acknowledged by', modification.acknowledged_by_profile?.full_name],
            ['Acknowledged date', formatHistoryDate(modification.acknowledged_date)],
            ['Created at', formatHistoryDateTime(modification.created_at)],
          ]),
        });
      });
  }

  if (hasExportSection(sections, 'milestones')) {
    [...data.milestones]
      .sort((a, b) => compareDateAsc(a.target_date, b.target_date) || a.sort_order - b.sort_order)
      .forEach((milestone) => {
        rows.push({
          section: 'Milestones',
          record_type: 'Milestone',
          record_id: milestone.id,
          number: '',
          title: milestone.name,
          status: formatHistoryLabel(milestone.status),
          date: formatHistoryDate(milestone.target_date),
          secondary_date: formatHistoryDate(milestone.actual_date),
          actor: '',
          amount: String(milestone.budget_actual),
          linked_milestone: '',
          description: milestone.description,
          details: compactDetails([
            ['Percent complete', `${milestone.percent_complete}%`],
            ['Budget planned', milestone.budget_planned],
            ['Budget actual', milestone.budget_actual],
            ['Linked submittals', milestone.linked_submittals?.length],
            ['Linked RFIs', milestone.linked_rfis?.length],
            ['Created at', formatHistoryDateTime(milestone.created_at)],
          ]),
        });
      });
  }

  if (hasExportSection(sections, 'activity')) {
    [...data.activityLog]
      .sort((a, b) => compareDateAsc(a.created_at, b.created_at))
      .forEach((activity) => {
        rows.push({
          section: 'Activity History',
          record_type: formatHistoryLabel(activity.entity_type),
          record_id: activity.entity_id,
          number: '',
          title: formatHistoryLabel(activity.action),
          status: '',
          date: formatHistoryDateTime(activity.created_at),
          secondary_date: '',
          actor: activity.performed_by_profile?.full_name ?? activity.performed_by,
          amount: '',
          linked_milestone: '',
          description: activity.description,
          details: compactDetails([
            ['Activity ID', activity.id],
            ['Entity type', activity.entity_type],
            ['Action', activity.action],
          ]),
        });
      });
  }

  return rows;
}

function csvEscape(value: string | number | null | undefined): string {
  const stringValue = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function buildProjectHistoryCsv(
  data: ProjectHistoryExportData,
  sections: HistoryExportSection[],
): string {
  const rows = buildNormalizedHistoryRows(data, sections);
  return [
    CSV_COLUMNS.join(','),
    ...rows.map((row) => CSV_COLUMNS.map((column) => csvEscape(row[column])).join(',')),
  ].join('\n');
}
