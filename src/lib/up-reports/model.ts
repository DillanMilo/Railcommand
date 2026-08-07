import { z } from 'zod';

export const UP_RISK_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const UP_RISK_STATUSES = ['open', 'monitoring', 'mitigated', 'closed'] as const;
export const UP_MILESTONE_STATUSES = [
  'not_started',
  'on_track',
  'at_risk',
  'behind',
  'complete',
] as const;

export const UP_WORKBOOK_SCALAR_FIELDS = [
  'reportNumber',
  'reportTitle',
  'projectName',
  'projectClient',
  'projectLocation',
  'weekStartDate',
  'weekEndDate',
  'dashboardNumber',
  'projectManager',
  'contractor',
  'ntpDate',
  'estimatedCompletionDate',
  'trackConstructionProgress',
  'contractAmount',
  'billedToDate',
  'billingThisPeriod',
  'workOrderAuthorization',
  'workOrderSpend',
  'projectSnapshot',
  'thisWeekActivities',
  'nextWeekActivities',
] as const;

export const UP_WORKBOOK_MILESTONE_FIELDS = [
  'milestones.name',
  'milestones.targetDate',
  'milestones.status',
  'milestones.percentComplete',
  'milestones.notes',
] as const;

export const UP_WORKBOOK_RISK_FIELDS = [
  'risks.category',
  'risks.description',
  'risks.champion',
  'risks.severity',
  'risks.status',
] as const;

export const UP_WORKBOOK_MAPPING_FIELDS = [
  ...UP_WORKBOOK_SCALAR_FIELDS,
  ...UP_WORKBOOK_MILESTONE_FIELDS,
  ...UP_WORKBOOK_RISK_FIELDS,
] as const;

const workbookCellReference = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(
    /^(?:'(?:[^']|'')+'|[^![\]]+)!\$?[A-Z]{1,3}\$?[1-9]\d*(?::\$?[A-Z]{1,3}\$?[1-9]\d*)?$/,
    "Use an Excel reference such as 'Weekly Report'!B4 or 'Weekly Report'!B20:B29",
  );

export const upWorkbookMappingSchema = z
  .partialRecord(z.enum(UP_WORKBOOK_MAPPING_FIELDS), workbookCellReference)
  .refine(
    (value) => Object.keys(value).length > 0,
    'Map at least one Railcommand field to the workbook',
  )
  .refine(
    (value) => Object.keys(value).length <= UP_WORKBOOK_MAPPING_FIELDS.length,
    'Workbook mapping contains too many fields',
  );

export type UpWorkbookMapping = z.infer<typeof upWorkbookMappingSchema>;

const optionalDate = z.union([z.literal(''), z.iso.date()]);
const optionalMoney = z.number().finite().nonnegative().nullable();

export const upRiskSchema = z.object({
  category: z.string().trim().max(120),
  description: z.string().trim().min(1).max(2_000),
  champion: z.string().trim().max(160),
  severity: z.enum(UP_RISK_SEVERITIES),
  status: z.enum(UP_RISK_STATUSES),
  sourceId: z.string().trim().max(120).optional(),
});

export const upMilestoneSchema = z.object({
  name: z.string().trim().min(1).max(240),
  targetDate: optionalDate,
  status: z.enum(UP_MILESTONE_STATUSES),
  percentComplete: z.number().finite().min(0).max(100),
  notes: z.string().trim().max(1_000),
  sourceId: z.string().trim().max(120).optional(),
});

export const upReportInputsSchema = z.object({
  dashboardNumber: z.string().trim().max(80),
  projectManager: z.string().trim().max(160),
  contractor: z.string().trim().max(240),
  ntpDate: optionalDate,
  estimatedCompletionDate: optionalDate,
  trackConstructionProgress: z.string().trim().max(8_000),
  contractAmount: optionalMoney,
  billedToDate: optionalMoney,
  billingThisPeriod: optionalMoney,
  workOrderAuthorization: optionalMoney,
  workOrderSpend: optionalMoney,
  projectSnapshot: z.string().trim().max(8_000),
  thisWeekActivities: z.string().trim().max(12_000),
  nextWeekActivities: z.string().trim().max(8_000),
  milestones: z.array(upMilestoneSchema).max(40),
  risks: z.array(upRiskSchema).max(40),
});

export type UpReportInputs = z.infer<typeof upReportInputsSchema>;
export type UpReportRisk = z.infer<typeof upRiskSchema>;
export type UpReportMilestone = z.infer<typeof upMilestoneSchema>;

export const upManualDefaultsSchema = upReportInputsSchema
  .pick({
    dashboardNumber: true,
    projectManager: true,
    contractor: true,
    ntpDate: true,
    estimatedCompletionDate: true,
    contractAmount: true,
    billedToDate: true,
    billingThisPeriod: true,
    workOrderAuthorization: true,
    workOrderSpend: true,
  })
  .partial()
  .strict();

export type UpManualDefaults = z.infer<typeof upManualDefaultsSchema>;

export const projectMappingSchema = z
  .record(
    z.string().trim().min(1).max(120),
    z.union([
      z.string().trim().max(500),
      z.number().finite(),
      z.boolean(),
      z.null(),
    ]),
  )
  .refine((value) => Object.keys(value).length <= 80, 'Mapping is limited to 80 keys');

export type ProjectUpMapping = z.infer<typeof projectMappingSchema>;

export interface UpTemplateVariant {
  id: string;
  project_id: string;
  organization_id: string;
  variant_key: string;
  name: string;
  version: string;
  status: 'metadata_only' | 'trusted' | 'retired';
  artifact_capability: 'data_package' | 'xlsx_template';
  template_storage_path: string | null;
  template_sha256: string | null;
  template_file_name: string | null;
  template_size_bytes: number | null;
  mapping_schema: UpWorkbookMapping | Record<string, never>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectUpReportConfig {
  project_id: string;
  organization_id: string;
  template_variant_id: string;
  project_mapping: ProjectUpMapping;
  manual_defaults: UpManualDefaults;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface UpReportSourceSnapshot {
  organizationId: string;
  projectId: string;
  capturedAt: string;
  weekStartDate: string;
  weekEndDate: string;
  project: {
    id: string;
    name: string;
    client: string;
    location: string;
    status: string;
    targetEndDate: string;
    projectCompletionDate: string;
  };
  sourceIds: {
    dailyLogs: string[];
    milestones: string[];
    rfis: string[];
    priorWeeklyReport: string | null;
  };
  warnings: string[];
}

export interface UpReportDetail {
  report_id: string;
  project_id: string;
  organization_id: string;
  template_variant_id: string;
  template_version: string;
  source_snapshot: UpReportSourceSnapshot;
  report_inputs: UpReportInputs;
  review_status: 'draft' | 'reviewed';
  created_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectScopedRow {
  project_id: string;
}

export interface PrefillProject {
  id: string;
  organization_id: string;
  name: string;
  client: string;
  location: string;
  status: string;
  target_end_date: string;
  project_completion_date?: string | null;
}

export interface PrefillMember extends ProjectScopedRow {
  project_role: string;
  profile?: {
    full_name?: string | null;
    organization?: { name?: string | null } | null;
  } | null;
}

export interface PrefillMilestone extends ProjectScopedRow {
  id: string;
  name: string;
  description: string;
  target_date: string;
  status: (typeof UP_MILESTONE_STATUSES)[number];
  percent_complete: number;
}

export interface PrefillDailyLog extends ProjectScopedRow {
  id: string;
  log_date: string;
  work_summary: string;
  work_items?: Array<{
    description: string;
    quantity: number;
    unit: string;
    location: string;
  }>;
}

export interface PrefillRfi extends ProjectScopedRow {
  id: string;
  number: string;
  subject: string;
  priority: (typeof UP_RISK_SEVERITIES)[number];
  status: string;
  assigned_to_profile?: { full_name?: string | null } | null;
}

export interface PrefillPriorReport extends ProjectScopedRow {
  id: string;
  upcoming_work: string;
}

export interface BuildPrefillInput {
  organizationId: string;
  projectId: string;
  weekStartDate: string;
  weekEndDate: string;
  project: PrefillProject;
  members: PrefillMember[];
  milestones: PrefillMilestone[];
  dailyLogs: PrefillDailyLog[];
  rfis: PrefillRfi[];
  priorReport: PrefillPriorReport | null;
  defaults: UpManualDefaults;
  capturedAt?: string;
}

export interface UpReportPrefill {
  inputs: UpReportInputs;
  sourceSnapshot: UpReportSourceSnapshot;
}

export function emptyUpReportInputs(): UpReportInputs {
  return {
    dashboardNumber: '',
    projectManager: '',
    contractor: '',
    ntpDate: '',
    estimatedCompletionDate: '',
    trackConstructionProgress: '',
    contractAmount: null,
    billedToDate: null,
    billingThisPeriod: null,
    workOrderAuthorization: null,
    workOrderSpend: null,
    projectSnapshot: '',
    thisWeekActivities: '',
    nextWeekActivities: '',
    milestones: [],
    risks: [],
  };
}

export function assertProjectScopedEntity(
  label: string,
  requestedProjectId: string,
  requestedOrganizationId: string,
  entity: { project_id: string; organization_id?: string },
): void {
  if (entity.project_id !== requestedProjectId) {
    throw new Error(`${label} is not scoped to the selected project`);
  }
  if (
    entity.organization_id !== undefined
    && entity.organization_id !== requestedOrganizationId
  ) {
    throw new Error(`${label} is not scoped to the selected account`);
  }
}

export function assertRowsProjectScoped(
  label: string,
  projectId: string,
  rows: ProjectScopedRow[],
): void {
  if (rows.some((row) => row.project_id !== projectId)) {
    throw new Error(`${label} contains data from another project`);
  }
}

export function assertTemplateAssignmentScope(
  projectId: string,
  organizationId: string,
  config: ProjectUpReportConfig,
  template: UpTemplateVariant,
): void {
  assertProjectScopedEntity('UP report configuration', projectId, organizationId, config);
  assertProjectScopedEntity('UP report template', projectId, organizationId, template);
  if (config.template_variant_id !== template.id) {
    throw new Error('Selected UP report template is missing or ambiguous');
  }
  if (template.status === 'retired') {
    throw new Error('Selected UP report template is retired');
  }
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function joinActivities(logs: PrefillDailyLog[]): string {
  const lines: string[] = [];
  for (const log of logs) {
    if (log.work_summary.trim()) {
      lines.push(`${log.log_date}: ${log.work_summary.trim()}`);
    }
    for (const item of log.work_items ?? []) {
      const quantity = item.quantity
        ? ` — ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
        : '';
      const location = item.location ? ` at ${item.location}` : '';
      lines.push(`${log.log_date}: ${item.description.trim()}${quantity}${location}`);
    }
  }
  return lines.join('\n');
}

export function buildProjectScopedPrefill(input: BuildPrefillInput): UpReportPrefill {
  if (input.project.id !== input.projectId) {
    throw new Error('Project prefill source does not match the selected project');
  }
  if (input.project.organization_id !== input.organizationId) {
    throw new Error('Project prefill source does not match the selected account');
  }
  assertRowsProjectScoped('Team members', input.projectId, input.members);
  assertRowsProjectScoped('Milestones', input.projectId, input.milestones);
  assertRowsProjectScoped('Daily logs', input.projectId, input.dailyLogs);
  assertRowsProjectScoped('RFIs', input.projectId, input.rfis);
  if (input.priorReport) {
    assertRowsProjectScoped('Prior weekly report', input.projectId, [input.priorReport]);
  }

  const warnings: string[] = [];
  const managerNames = uniqueNonEmpty(
    input.members
      .filter((member) => member.project_role === 'manager')
      .map((member) => member.profile?.full_name),
  );
  const contractorNames = uniqueNonEmpty(
    input.members
      .filter((member) => member.project_role === 'contractor')
      .map(
        (member) =>
          member.profile?.organization?.name
          ?? member.profile?.full_name,
      ),
  );

  if (!input.defaults.projectManager && managerNames.length !== 1) {
    warnings.push(
      managerNames.length === 0
        ? 'No project manager is assigned; enter one during review.'
        : 'Multiple project managers are assigned; select one during review.',
    );
  }
  if (!input.defaults.contractor && contractorNames.length !== 1) {
    warnings.push(
      contractorNames.length === 0
        ? 'No unambiguous contractor is available; enter one during review.'
        : 'Multiple contractor candidates exist; select one during review.',
    );
  }
  if (!input.defaults.ntpDate) {
    warnings.push('Notice-to-proceed date is not captured in current project data.');
  }

  const milestones: UpReportMilestone[] = input.milestones.slice(0, 40).map((milestone) => ({
    name: milestone.name,
    targetDate: milestone.target_date,
    status: milestone.status,
    percentComplete: milestone.percent_complete,
    notes: milestone.description,
    sourceId: milestone.id,
  }));

  const trackMilestones = input.milestones.filter((milestone) =>
    /\b(track|rail|turnout|ballast|tie|crossing)\b/i.test(
      `${milestone.name} ${milestone.description}`,
    ),
  );
  const trackConstructionProgress = trackMilestones
    .map(
      (milestone) =>
        `${milestone.name}: ${milestone.percent_complete}% (${milestone.status.replaceAll('_', ' ')})`,
    )
    .join('\n');

  const risks: UpReportRisk[] = input.rfis.slice(0, 40).map((rfi) => ({
    category: 'RFI',
    description: `${rfi.number}: ${rfi.subject}`,
    champion: rfi.assigned_to_profile?.full_name?.trim() ?? '',
    severity: rfi.priority,
    status: 'open',
    sourceId: rfi.id,
  }));

  const projectSnapshot = [
    `${input.project.name} is ${input.project.status.replaceAll('_', ' ')}.`,
    input.project.location ? `Location: ${input.project.location}.` : '',
    input.project.client ? `Client: ${input.project.client}.` : '',
    input.project.target_end_date
      ? `Current target completion: ${input.project.target_end_date}.`
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  const base = emptyUpReportInputs();
  const inputs = upReportInputsSchema.parse({
    ...base,
    ...input.defaults,
    projectManager:
      input.defaults.projectManager
      ?? (managerNames.length === 1 ? managerNames[0] : ''),
    contractor:
      input.defaults.contractor
      ?? (contractorNames.length === 1 ? contractorNames[0] : ''),
    estimatedCompletionDate:
      input.defaults.estimatedCompletionDate
      ?? input.project.project_completion_date
      ?? input.project.target_end_date
      ?? '',
    trackConstructionProgress,
    projectSnapshot,
    thisWeekActivities: joinActivities(input.dailyLogs),
    nextWeekActivities: input.priorReport?.upcoming_work ?? '',
    milestones,
    risks,
  });

  return {
    inputs,
    sourceSnapshot: {
      organizationId: input.organizationId,
      projectId: input.projectId,
      capturedAt: input.capturedAt ?? new Date().toISOString(),
      weekStartDate: input.weekStartDate,
      weekEndDate: input.weekEndDate,
      project: {
        id: input.project.id,
        name: input.project.name,
        client: input.project.client,
        location: input.project.location,
        status: input.project.status,
        targetEndDate: input.project.target_end_date,
        projectCompletionDate: input.project.project_completion_date ?? '',
      },
      sourceIds: {
        dailyLogs: input.dailyLogs.map((log) => log.id),
        milestones: input.milestones.map((milestone) => milestone.id),
        rfis: input.rfis.map((rfi) => rfi.id),
        priorWeeklyReport: input.priorReport?.id ?? null,
      },
      warnings,
    },
  };
}

interface DataPackageInput {
  organizationId: string;
  projectId: string;
  report: {
    id: string;
    project_id: string;
    number: string;
    title: string;
    week_start_date: string;
    week_end_date: string;
    status: string;
  };
  detail: UpReportDetail;
  template: UpTemplateVariant;
  generatedBy: string;
  generatedAt?: string;
}

export function buildUpReportDataPackage(input: DataPackageInput): string {
  assertProjectScopedEntity(
    'Weekly report',
    input.projectId,
    input.organizationId,
    input.report,
  );
  assertProjectScopedEntity(
    'UP weekly report detail',
    input.projectId,
    input.organizationId,
    input.detail,
  );
  assertProjectScopedEntity(
    'UP report template',
    input.projectId,
    input.organizationId,
    input.template,
  );
  if (input.detail.report_id !== input.report.id) {
    throw new Error('UP report detail does not match the selected weekly report');
  }
  if (input.detail.template_variant_id !== input.template.id) {
    throw new Error('UP report template does not match the reviewed report');
  }
  if (
    input.detail.source_snapshot.projectId !== input.projectId
    || input.detail.source_snapshot.organizationId !== input.organizationId
  ) {
    throw new Error('UP report source snapshot is outside the selected project/account');
  }
  if (input.detail.review_status !== 'reviewed') {
    throw new Error('UP report must be reviewed before an artifact can be downloaded');
  }
  if (input.template.artifact_capability !== 'data_package') {
    throw new Error(
      'Trusted Excel generation is not installed for this template version',
    );
  }

  return JSON.stringify(
    {
      schemaVersion: 1,
      artifactType: 'railcommand.up-weekly-report-data-package',
      generatedAt: input.generatedAt ?? new Date().toISOString(),
      generatedBy: input.generatedBy,
      scope: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        reportId: input.report.id,
      },
      template: {
        id: input.template.id,
        key: input.template.variant_key,
        name: input.template.name,
        version: input.detail.template_version,
        capability: input.template.artifact_capability,
        notice:
          'This is a reviewed data package. No Union Pacific Excel template was installed or modified.',
      },
      report: {
        number: input.report.number,
        title: input.report.title,
        weekStartDate: input.report.week_start_date,
        weekEndDate: input.report.week_end_date,
        workflowStatus: input.report.status,
        reviewStatus: input.detail.review_status,
        reviewedAt: input.detail.reviewed_at,
      },
      inputs: upReportInputsSchema.parse(input.detail.report_inputs),
      sourceSnapshot: input.detail.source_snapshot,
    },
    null,
    2,
  );
}

export function sanitizeArtifactFileName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
    || 'up-weekly-report'
  );
}
