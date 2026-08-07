'use server';

import { createHash, randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { ACTIONS } from '@/lib/permissions';
import {
  type ActionResult,
  checkPermission,
  getAuthenticatedUser,
  logActivity,
} from './permissions-helper';
import {
  assertProjectScopedEntity,
  assertTemplateAssignmentScope,
  buildProjectScopedPrefill,
  projectMappingSchema,
  sanitizeArtifactFileName,
  upManualDefaultsSchema,
  upWorkbookMappingSchema,
  upReportInputsSchema,
  type PrefillDailyLog,
  type PrefillMember,
  type PrefillMilestone,
  type PrefillPriorReport,
  type PrefillProject,
  type PrefillRfi,
  type ProjectUpMapping,
  type ProjectUpReportConfig,
  type UpManualDefaults,
  type UpReportDetail,
  type UpReportInputs,
  type UpReportPrefill,
  type UpTemplateVariant,
  type UpWorkbookMapping,
} from '@/lib/up-reports/model';
import {
  fillUpWorkbookTemplate,
  inspectUpWorkbookTemplate,
  MAX_UP_TEMPLATE_BYTES,
  UP_TEMPLATE_BUCKET,
} from '@/lib/up-reports/workbook';
import {
  RAILCOMMAND_STANDARD_TEMPLATE_FILE_NAME,
  RAILCOMMAND_STANDARD_TEMPLATE_KEY,
  RAILCOMMAND_STANDARD_TEMPLATE_NAME,
  RAILCOMMAND_STANDARD_TEMPLATE_VERSION,
  RAILCOMMAND_STANDARD_WORKBOOK_MAPPING,
} from '@/lib/up-reports/standard';
import { RAILCOMMAND_STANDARD_WORKBOOK_BASE64 } from '@/lib/up-reports/standard-workbook-base64';

const templateRegistrationSchema = z.object({
  variantKey: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9_-]*$/i, 'Use letters, numbers, hyphens, or underscores'),
  name: z.string().trim().min(1).max(160),
  version: z.string().trim().min(1).max(40),
});

const dateRangeSchema = z
  .object({
    weekStartDate: z.iso.date(),
    weekEndDate: z.iso.date(),
  })
  .refine(
    (value) => value.weekEndDate >= value.weekStartDate,
    'Week end date must be on or after week start date',
  )
  .refine(
    (value) => {
      const start = Date.parse(`${value.weekStartDate}T00:00:00Z`);
      const end = Date.parse(`${value.weekEndDate}T00:00:00Z`);
      return end - start <= 14 * 24 * 60 * 60 * 1_000;
    },
    'UP weekly report date ranges cannot exceed 14 days',
  );

const draftSchema = dateRangeSchema.extend({
  title: z.string().trim().min(1).max(240),
  inputs: upReportInputsSchema,
});

function upReportingErrorMessage(error: unknown, fallback: string): string {
  const message =
    error instanceof Error
      ? error.message
      : error
        && typeof error === 'object'
        && 'message' in error
        ? String(error.message)
        : String(error ?? '');
  if (
    /schema cache/i.test(message)
    && /up_report_template_variants|project_up_report_configs|up_weekly_report_details/i.test(
      message,
    )
  ) {
    return (
      'UP reporting database setup is not installed in this environment. '
      + 'Apply the UP weekly reporting migration before enabling report generation.'
    );
  }
  return message || fallback;
}

function safeTemplateFileName(value: string): string {
  const baseName = value
    .replace(/\.xlsx$/i, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  return `${baseName || 'up-weekly-report-template'}.xlsx`;
}

interface ProjectScope {
  project: PrefillProject;
  organizationId: string;
  userId: string;
  profileName: string;
  projectRole: string;
}

export interface UpReportListItem {
  id: string;
  number: string;
  title: string;
  week_start_date: string;
  week_end_date: string;
  status: string;
  review_status: 'draft' | 'reviewed';
  template_name: string;
  template_version: string;
}

export interface UpReportingWorkspace {
  variants: UpTemplateVariant[];
  config: ProjectUpReportConfig | null;
  selectedTemplate: UpTemplateVariant | null;
  reports: UpReportListItem[];
}

export interface UpReportWorkspaceDetail {
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
}

async function loadStrictProjectScope(
  projectId: string,
): Promise<
  | { ok: true; scope: ProjectScope }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { user, error: authError } = await getAuthenticatedUser(supabase);
  if (authError || !user) return { ok: false, error: authError ?? 'Not authenticated' };

  const [{ data: profile, error: profileError }, { data: project, error: projectError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('organization_id, full_name')
        .eq('id', user.id)
        .single(),
      supabase
        .from('projects')
        .select(
          'id, organization_id, name, client, location, status, target_end_date, project_completion_date',
        )
        .eq('id', projectId)
        .single(),
    ]);

  if (profileError || !profile?.organization_id) {
    return { ok: false, error: 'Your profile is not linked to an account' };
  }
  if (projectError || !project?.organization_id) {
    return { ok: false, error: 'Project not found or not linked to an account' };
  }
  if (profile.organization_id !== project.organization_id) {
    return { ok: false, error: 'Account/project scope mismatch' };
  }

  // Unlike the broad admin fallback used elsewhere, UP reporting requires an
  // explicit project membership so a selected project is never inferred.
  const { data: membership, error: membershipError } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('profile_id', user.id)
    .single();

  if (membershipError || !membership) {
    return { ok: false, error: 'Explicit project membership is required for UP reporting' };
  }

  return {
    ok: true,
    scope: {
      project: project as PrefillProject,
      organizationId: project.organization_id,
      userId: user.id,
      profileName: profile.full_name ?? 'Railcommand user',
      projectRole: membership.project_role,
    },
  };
}

async function requireProjectPermission(
  scope: ProjectScope,
  projectId: string,
  action: Parameters<typeof checkPermission>[3],
): Promise<string | null> {
  const supabase = await createClient();
  const result = await checkPermission(supabase, scope.userId, projectId, action);
  return result.allowed ? null : result.error;
}

async function requireBudgetAccess(
  scope: ProjectScope,
  projectId: string,
): Promise<string | null> {
  return requireProjectPermission(scope, projectId, ACTIONS.BUDGET_VIEW);
}

async function loadProjectConfigAndTemplate(
  projectId: string,
  organizationId: string,
): Promise<
  | {
      ok: true;
      config: ProjectUpReportConfig;
      template: UpTemplateVariant;
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data: configData, error: configError } = await supabase
    .from('project_up_report_configs')
    .select('*')
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .single();

  if (configError || !configData) {
    if (
      configError
      && /schema cache/i.test(configError.message)
      && /project_up_report_configs/i.test(configError.message)
    ) {
      return {
        ok: false,
        error: upReportingErrorMessage(configError, 'UP reporting setup is unavailable'),
      };
    }
    return { ok: false, error: 'No UP report template is assigned to this project' };
  }
  const config = configData as ProjectUpReportConfig;
  assertProjectScopedEntity('UP report configuration', projectId, organizationId, config);

  const { data: templateData, error: templateError } = await supabase
    .from('up_report_template_variants')
    .select('*')
    .eq('id', config.template_variant_id)
    .eq('project_id', projectId)
    .eq('organization_id', organizationId)
    .single();

  if (templateError || !templateData) {
    return { ok: false, error: 'Selected UP report template is missing or outside this project' };
  }
  const template = templateData as UpTemplateVariant;
  assertTemplateAssignmentScope(projectId, organizationId, config, template);
  if (
    template.status !== 'trusted'
    || template.artifact_capability !== 'xlsx_template'
    || !template.template_storage_path
    || !template.template_sha256
  ) {
    return {
      ok: false,
      error: 'This project does not have a trusted Excel template assigned',
    };
  }
  upWorkbookMappingSchema.parse(template.mapping_schema);
  return { ok: true, config, template };
}

async function buildServerPrefill(
  scope: ProjectScope,
  projectId: string,
  weekStartDate: string,
  weekEndDate: string,
): Promise<
  | {
      ok: true;
      prefill: UpReportPrefill;
      config: ProjectUpReportConfig;
      template: UpTemplateVariant;
    }
  | { ok: false; error: string }
> {
  const selection = await loadProjectConfigAndTemplate(projectId, scope.organizationId);
  if (!selection.ok) return selection;

  const supabase = await createClient();
  const [membersResult, milestonesResult, logsResult, rfisResult, priorReportResult] =
    await Promise.all([
      supabase
        .from('project_members')
        .select(`
          project_id,
          project_role,
          profile:profiles(
            full_name,
            organization:organizations(name)
          )
        `)
        .eq('project_id', projectId),
      supabase
        .from('milestones')
        .select('id, project_id, name, description, target_date, status, percent_complete')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true })
        .limit(200),
      supabase
        .from('daily_logs')
        .select(`
          id,
          project_id,
          log_date,
          work_summary,
          work_items:daily_log_work_items(description, quantity, unit, location)
        `)
        .eq('project_id', projectId)
        .gte('log_date', weekStartDate)
        .lte('log_date', weekEndDate)
        .order('log_date', { ascending: true })
        .limit(100),
      supabase
        .from('rfis')
        .select(`
          id,
          project_id,
          number,
          subject,
          priority,
          status,
          assigned_to_profile:profiles!rfis_assigned_to_fkey(full_name)
        `)
        .eq('project_id', projectId)
        .in('status', ['open', 'overdue'])
        .order('due_date', { ascending: true })
        .limit(40),
      supabase
        .from('weekly_reports')
        .select('id, project_id, upcoming_work')
        .eq('project_id', projectId)
        .lt('week_end_date', weekStartDate)
        .order('week_end_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const firstError = [
    membersResult,
    milestonesResult,
    logsResult,
    rfisResult,
    priorReportResult,
  ].find((result) => result.error);
  if (firstError?.error) return { ok: false, error: firstError.error.message };

  const defaults = upManualDefaultsSchema.parse(selection.config.manual_defaults ?? {});
  const prefill = buildProjectScopedPrefill({
    organizationId: scope.organizationId,
    projectId,
    weekStartDate,
    weekEndDate,
    project: scope.project,
    members: (membersResult.data ?? []) as unknown as PrefillMember[],
    milestones: (milestonesResult.data ?? []) as unknown as PrefillMilestone[],
    dailyLogs: (logsResult.data ?? []) as unknown as PrefillDailyLog[],
    rfis: (rfisResult.data ?? []) as unknown as PrefillRfi[],
    priorReport: (priorReportResult.data ?? null) as PrefillPriorReport | null,
    defaults,
  });

  return {
    ok: true,
    prefill,
    config: selection.config,
    template: selection.template,
  };
}

export async function getUpReportingWorkspace(
  projectId: string,
): Promise<ActionResult<UpReportingWorkspace>> {
  try {
    const scopeResult = await loadStrictProjectScope(projectId);
    if (!scopeResult.ok) return { error: scopeResult.error };
    const budgetError = await requireBudgetAccess(scopeResult.scope, projectId);
    if (budgetError) return { error: budgetError };

    const supabase = await createClient();
    const [variantsResult, configResult, detailsResult] = await Promise.all([
      supabase
        .from('up_report_template_variants')
        .select('*')
        .eq('project_id', projectId)
        .eq('organization_id', scopeResult.scope.organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('project_up_report_configs')
        .select('*')
        .eq('project_id', projectId)
        .eq('organization_id', scopeResult.scope.organizationId)
        .maybeSingle(),
      supabase
        .from('up_weekly_report_details')
        .select('report_id, template_variant_id, template_version, review_status')
        .eq('project_id', projectId)
        .eq('organization_id', scopeResult.scope.organizationId)
        .order('created_at', { ascending: false })
        .limit(100),
    ]);

    const firstError = [variantsResult, configResult, detailsResult].find(
      (result) => result.error,
    );
    if (firstError?.error) {
      return {
        error: upReportingErrorMessage(
          firstError.error,
          'Failed to load UP reporting workspace',
        ),
      };
    }

    const allVariants = (variantsResult.data ?? []) as UpTemplateVariant[];
    const variants = allVariants.filter((variant) => variant.status !== 'retired');
    const config = (configResult.data ?? null) as ProjectUpReportConfig | null;
    if (config) {
      assertProjectScopedEntity(
        'UP report configuration',
        projectId,
        scopeResult.scope.organizationId,
        config,
      );
    }
    const selectedTemplate = config
      ? allVariants.find((variant) => variant.id === config.template_variant_id) ?? null
      : null;
    if (config && !selectedTemplate) {
      return { error: 'Selected UP report template is missing or ambiguous' };
    }
    if (config && selectedTemplate) {
      assertTemplateAssignmentScope(
        projectId,
        scopeResult.scope.organizationId,
        config,
        selectedTemplate,
      );
    }

    const details = detailsResult.data ?? [];
    const reportIds = details.map((detail) => detail.report_id);
    const { data: reportRows, error: reportError } = reportIds.length
      ? await supabase
          .from('weekly_reports')
          .select('id, project_id, number, title, week_start_date, week_end_date, status')
          .eq('project_id', projectId)
          .in('id', reportIds)
      : { data: [], error: null };
    if (reportError) return { error: reportError.message };

    const reportsById = new Map((reportRows ?? []).map((report) => [report.id, report]));
    const templatesById = new Map(allVariants.map((variant) => [variant.id, variant]));
    const reports: UpReportListItem[] = details.map((detail) => {
      const report = reportsById.get(detail.report_id);
      const template = templatesById.get(detail.template_variant_id);
      if (!report || report.project_id !== projectId || !template) {
        throw new Error('UP report list contains an out-of-scope or missing record');
      }
      return {
        id: report.id,
        number: report.number,
        title: report.title,
        week_start_date: report.week_start_date,
        week_end_date: report.week_end_date,
        status: report.status,
        review_status: detail.review_status as 'draft' | 'reviewed',
        template_name: template.name,
        template_version: detail.template_version,
      };
    });

    return {
      success: true,
      data: { variants, config, selectedTemplate, reports },
    };
  } catch (error) {
    return {
      error: upReportingErrorMessage(error, 'Failed to load UP reporting workspace'),
    };
  }
}

function isStandardWorkbookMapping(value: unknown): boolean {
  const mapping = upWorkbookMappingSchema.parse(value);
  const expectedEntries = Object.entries(RAILCOMMAND_STANDARD_WORKBOOK_MAPPING);
  return (
    Object.keys(mapping).length === expectedEntries.length
    && expectedEntries.every(([field, reference]) => mapping[field as keyof UpWorkbookMapping] === reference)
  );
}

async function readRailCommandStandardWorkbook(): Promise<Uint8Array> {
  const bytes = new Uint8Array(
    Buffer.from(RAILCOMMAND_STANDARD_WORKBOOK_BASE64, 'base64'),
  );
  inspectUpWorkbookTemplate(bytes, RAILCOMMAND_STANDARD_WORKBOOK_MAPPING);
  return bytes;
}

export async function configureProjectRailCommandWorkbook(
  projectId: string,
  input: { manualDefaults?: UpManualDefaults },
): Promise<ActionResult<ProjectUpReportConfig>> {
  try {
    const manualDefaults = upManualDefaultsSchema.parse(input.manualDefaults ?? {});
    const scopeResult = await loadStrictProjectScope(projectId);
    if (!scopeResult.ok) return { error: scopeResult.error };
    const permissionError = await requireProjectPermission(
      scopeResult.scope,
      projectId,
      ACTIONS.PROJECT_EDIT,
    );
    if (permissionError) return { error: permissionError };
    const budgetError = await requireBudgetAccess(scopeResult.scope, projectId);
    if (budgetError) return { error: budgetError };

    const workbookBytes = await readRailCommandStandardWorkbook();
    const workbookSha256 = createHash('sha256')
      .update(workbookBytes)
      .digest('hex');
    const supabase = await createClient();
    const { data: existingTemplateData, error: existingTemplateError } = await supabase
      .from('up_report_template_variants')
      .select('*')
      .eq('project_id', projectId)
      .eq('organization_id', scopeResult.scope.organizationId)
      .eq('variant_key', RAILCOMMAND_STANDARD_TEMPLATE_KEY)
      .eq('version', RAILCOMMAND_STANDARD_TEMPLATE_VERSION)
      .maybeSingle();
    if (existingTemplateError) return { error: existingTemplateError.message };

    let template = existingTemplateData as UpTemplateVariant | null;
    if (template) {
      assertProjectScopedEntity(
        'RailCommand standard workbook',
        projectId,
        scopeResult.scope.organizationId,
        template,
      );
      const expectedPrefix =
        `${scopeResult.scope.organizationId}/${projectId}/${template.id}/`;
      if (
        template.status !== 'trusted'
        || template.artifact_capability !== 'xlsx_template'
        || template.template_sha256 !== workbookSha256
        || template.template_file_name !== RAILCOMMAND_STANDARD_TEMPLATE_FILE_NAME
        || template.template_size_bytes !== workbookBytes.byteLength
        || !template.template_storage_path?.startsWith(expectedPrefix)
        || !isStandardWorkbookMapping(template.mapping_schema)
      ) {
        return {
          error:
            'The installed RailCommand workbook does not match this application version. '
            + 'A new workbook version is required before the project can be configured.',
        };
      }
    } else {
      const templateId = randomUUID();
      const storagePath =
        `${scopeResult.scope.organizationId}/${projectId}/${templateId}/`
        + RAILCOMMAND_STANDARD_TEMPLATE_FILE_NAME;
      const { error: uploadError } = await supabase.storage
        .from(UP_TEMPLATE_BUCKET)
        .upload(storagePath, workbookBytes, {
          cacheControl: '3600',
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        });
      if (uploadError) {
        return {
          error: upReportingErrorMessage(
            uploadError,
            'Failed to install the RailCommand workbook for this project',
          ),
        };
      }

      const { data: insertedTemplate, error: insertError } = await supabase
        .from('up_report_template_variants')
        .insert({
          id: templateId,
          project_id: projectId,
          organization_id: scopeResult.scope.organizationId,
          variant_key: RAILCOMMAND_STANDARD_TEMPLATE_KEY,
          name: RAILCOMMAND_STANDARD_TEMPLATE_NAME,
          version: RAILCOMMAND_STANDARD_TEMPLATE_VERSION,
          status: 'trusted',
          artifact_capability: 'xlsx_template',
          template_storage_path: storagePath,
          template_sha256: workbookSha256,
          template_file_name: RAILCOMMAND_STANDARD_TEMPLATE_FILE_NAME,
          template_size_bytes: workbookBytes.byteLength,
          mapping_schema: RAILCOMMAND_STANDARD_WORKBOOK_MAPPING,
          created_by: scopeResult.scope.userId,
        })
        .select()
        .single();
      if (insertError || !insertedTemplate) {
        await supabase.storage.from(UP_TEMPLATE_BUCKET).remove([storagePath]);
        return {
          error: upReportingErrorMessage(
            insertError,
            'Failed to register the RailCommand workbook for this project',
          ),
        };
      }
      template = insertedTemplate as UpTemplateVariant;
    }

    const { data: existingConfig, error: existingConfigError } = await supabase
      .from('project_up_report_configs')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('organization_id', scopeResult.scope.organizationId)
      .maybeSingle();
    if (existingConfigError) return { error: existingConfigError.message };

    const configWrite = existingConfig
      ? supabase
          .from('project_up_report_configs')
          .update({
            template_variant_id: template.id,
            project_mapping: {},
            manual_defaults: manualDefaults,
            updated_by: scopeResult.scope.userId,
          })
          .eq('project_id', projectId)
          .eq('organization_id', scopeResult.scope.organizationId)
      : supabase
          .from('project_up_report_configs')
          .insert({
            project_id: projectId,
            organization_id: scopeResult.scope.organizationId,
            template_variant_id: template.id,
            project_mapping: {},
            manual_defaults: manualDefaults,
            created_by: scopeResult.scope.userId,
            updated_by: scopeResult.scope.userId,
          });
    const { data: configData, error: configError } = await configWrite
      .select()
      .single();
    if (configError || !configData) {
      return {
        error: configError?.message ?? 'Failed to configure the RailCommand workbook',
      };
    }

    const config = configData as ProjectUpReportConfig;
    assertTemplateAssignmentScope(
      projectId,
      scopeResult.scope.organizationId,
      config,
      template,
    );
    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'updated',
      `enabled ${RAILCOMMAND_STANDARD_TEMPLATE_NAME} ${RAILCOMMAND_STANDARD_TEMPLATE_VERSION}`,
      scopeResult.scope.userId,
    );
    revalidatePath(`/projects/${projectId}/weekly-reports`);
    return { success: true, data: config };
  } catch (error) {
    return {
      error: upReportingErrorMessage(
        error,
        'Failed to enable the RailCommand standard workbook',
      ),
    };
  }
}

export async function uploadProjectUpTemplateVariant(
  projectId: string,
  formData: FormData,
): Promise<
  ActionResult<{
    template: UpTemplateVariant;
    inspection: {
      sheetNames: string[];
      mappedCellCount: number;
      mappedFieldCount: number;
    };
  }>
> {
  try {
    const parsed = templateRegistrationSchema.parse({
      variantKey: formData.get('variantKey'),
      name: formData.get('name'),
      version: formData.get('version'),
    });
    const scopeResult = await loadStrictProjectScope(projectId);
    if (!scopeResult.ok) return { error: scopeResult.error };
    const permissionError = await requireProjectPermission(
      scopeResult.scope,
      projectId,
      ACTIONS.PROJECT_EDIT,
    );
    if (permissionError) return { error: permissionError };
    const budgetError = await requireBudgetAccess(scopeResult.scope, projectId);
    if (budgetError) return { error: budgetError };

    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return { error: 'Select a non-empty .xlsx template file' };
    }
    if (!/\.xlsx$/i.test(file.name)) {
      return { error: 'Only .xlsx template files are accepted' };
    }
    if (file.size > MAX_UP_TEMPLATE_BYTES) {
      return { error: 'UP Excel templates cannot exceed 8 MB' };
    }
    const allowedMimeTypes = new Set([
      '',
      'application/octet-stream',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    if (!allowedMimeTypes.has(file.type)) {
      return { error: 'The selected file is not recognized as a standard .xlsx workbook' };
    }

    const rawMapping = formData.get('mapping');
    if (typeof rawMapping !== 'string') {
      return { error: 'Workbook cell mapping is required' };
    }
    let mappingJson: unknown;
    try {
      mappingJson = JSON.parse(rawMapping);
    } catch {
      return { error: 'Workbook cell mapping must be valid JSON' };
    }
    const mapping = upWorkbookMappingSchema.parse(mappingJson);
    const templateBytes = new Uint8Array(await file.arrayBuffer());
    const inspection = inspectUpWorkbookTemplate(templateBytes, mapping);

    const templateId = randomUUID();
    const fileName = safeTemplateFileName(file.name);
    const storagePath =
      `${scopeResult.scope.organizationId}/${projectId}/${templateId}/${fileName}`;
    const templateSha256 = createHash('sha256')
      .update(templateBytes)
      .digest('hex');
    const supabase = await createClient();
    const { error: uploadError } = await supabase.storage
      .from(UP_TEMPLATE_BUCKET)
      .upload(storagePath, templateBytes, {
        cacheControl: '3600',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      });
    if (uploadError) {
      return {
        error: upReportingErrorMessage(
          uploadError,
          'Failed to store the project template',
        ),
      };
    }

    const { data, error: insertError } = await supabase
      .from('up_report_template_variants')
      .insert({
        id: templateId,
        project_id: projectId,
        organization_id: scopeResult.scope.organizationId,
        variant_key: parsed.variantKey.toLowerCase(),
        name: parsed.name,
        version: parsed.version,
        status: 'trusted',
        artifact_capability: 'xlsx_template',
        template_storage_path: storagePath,
        template_sha256: templateSha256,
        template_file_name: fileName,
        template_size_bytes: templateBytes.byteLength,
        mapping_schema: mapping,
        created_by: scopeResult.scope.userId,
      })
      .select()
      .single();

    if (insertError || !data) {
      await supabase.storage.from(UP_TEMPLATE_BUCKET).remove([storagePath]);
      return {
        error: upReportingErrorMessage(
          insertError,
          'Failed to register the project template',
        ),
      };
    }
    const template = data as UpTemplateVariant;
    assertProjectScopedEntity(
      'Uploaded UP report template',
      projectId,
      scopeResult.scope.organizationId,
      template,
    );
    await logActivity(
      supabase,
      projectId,
      'project',
      template.id,
      'created',
      `uploaded trusted UP report template ${template.name} ${template.version}`,
      scopeResult.scope.userId,
    );
    revalidatePath(`/projects/${projectId}/weekly-reports`);
    return { success: true, data: { template, inspection } };
  } catch (error) {
    return {
      error: upReportingErrorMessage(error, 'Failed to import the UP Excel template'),
    };
  }
}

export async function assignProjectUpTemplateVariant(
  projectId: string,
  input: {
    templateVariantId: string;
    projectMapping?: ProjectUpMapping;
    manualDefaults?: UpManualDefaults;
  },
): Promise<ActionResult<ProjectUpReportConfig>> {
  try {
    const projectMapping = projectMappingSchema.parse(input.projectMapping ?? {});
    const manualDefaults = upManualDefaultsSchema.parse(input.manualDefaults ?? {});
    const scopeResult = await loadStrictProjectScope(projectId);
    if (!scopeResult.ok) return { error: scopeResult.error };
    const permissionError = await requireProjectPermission(
      scopeResult.scope,
      projectId,
      ACTIONS.PROJECT_EDIT,
    );
    if (permissionError) return { error: permissionError };
    const budgetError = await requireBudgetAccess(scopeResult.scope, projectId);
    if (budgetError) return { error: budgetError };

    const supabase = await createClient();
    const { data: templateData, error: templateError } = await supabase
      .from('up_report_template_variants')
      .select('*')
      .eq('id', input.templateVariantId)
      .eq('project_id', projectId)
      .eq('organization_id', scopeResult.scope.organizationId)
      .neq('status', 'retired')
      .single();
    if (templateError || !templateData) {
      return { error: 'Template is missing or outside the selected project/account' };
    }
    const template = templateData as UpTemplateVariant;
    assertProjectScopedEntity(
      'UP report template',
      projectId,
      scopeResult.scope.organizationId,
      template,
    );
    if (
      template.status !== 'trusted'
      || template.artifact_capability !== 'xlsx_template'
      || !template.template_storage_path
      || !template.template_sha256
    ) {
      return { error: 'Select a trusted project Excel template before creating reports' };
    }
    upWorkbookMappingSchema.parse(template.mapping_schema);

    const { data: existingConfig } = await supabase
      .from('project_up_report_configs')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('organization_id', scopeResult.scope.organizationId)
      .maybeSingle();

    const configWrite = existingConfig
      ? supabase
          .from('project_up_report_configs')
          .update({
            template_variant_id: template.id,
            project_mapping: projectMapping,
            manual_defaults: manualDefaults,
            updated_by: scopeResult.scope.userId,
          })
          .eq('project_id', projectId)
          .eq('organization_id', scopeResult.scope.organizationId)
      : supabase
          .from('project_up_report_configs')
          .insert({
          project_id: projectId,
          organization_id: scopeResult.scope.organizationId,
          template_variant_id: template.id,
          project_mapping: projectMapping,
          manual_defaults: manualDefaults,
          created_by: scopeResult.scope.userId,
          updated_by: scopeResult.scope.userId,
          });

    const { data, error } = await configWrite.select().single();

    if (error) return { error: error.message };
    const config = data as ProjectUpReportConfig;
    assertTemplateAssignmentScope(
      projectId,
      scopeResult.scope.organizationId,
      config,
      template,
    );
    await logActivity(
      supabase,
      projectId,
      'project',
      projectId,
      'updated',
      `assigned UP report template ${template.name} ${template.version}`,
      scopeResult.scope.userId,
    );
    revalidatePath(`/projects/${projectId}/weekly-reports`);
    return { success: true, data: config };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to assign UP report template',
    };
  }
}

export async function getProjectUpReportPrefill(
  projectId: string,
  range: { weekStartDate: string; weekEndDate: string },
): Promise<ActionResult<UpReportPrefill & { template: UpTemplateVariant }>> {
  try {
    const parsedRange = dateRangeSchema.parse(range);
    const scopeResult = await loadStrictProjectScope(projectId);
    if (!scopeResult.ok) return { error: scopeResult.error };
    const createError = await requireProjectPermission(
      scopeResult.scope,
      projectId,
      ACTIONS.WEEKLY_REPORT_CREATE,
    );
    if (createError) return { error: createError };
    const budgetError = await requireBudgetAccess(scopeResult.scope, projectId);
    if (budgetError) return { error: budgetError };

    const result = await buildServerPrefill(
      scopeResult.scope,
      projectId,
      parsedRange.weekStartDate,
      parsedRange.weekEndDate,
    );
    if (!result.ok) return { error: result.error };
    return {
      success: true,
      data: { ...result.prefill, template: result.template },
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to prefill UP report',
    };
  }
}

export async function createProjectUpWeeklyReport(
  projectId: string,
  input: {
    title: string;
    weekStartDate: string;
    weekEndDate: string;
    inputs: UpReportInputs;
  },
): Promise<ActionResult<{ reportId: string }>> {
  try {
    const parsed = draftSchema.parse(input);
    const scopeResult = await loadStrictProjectScope(projectId);
    if (!scopeResult.ok) return { error: scopeResult.error };
    const createError = await requireProjectPermission(
      scopeResult.scope,
      projectId,
      ACTIONS.WEEKLY_REPORT_CREATE,
    );
    if (createError) return { error: createError };
    const budgetError = await requireBudgetAccess(scopeResult.scope, projectId);
    if (budgetError) return { error: budgetError };

    // Rebuild the source snapshot server-side. Client-provided source IDs are
    // never trusted.
    const prefillResult = await buildServerPrefill(
      scopeResult.scope,
      projectId,
      parsed.weekStartDate,
      parsed.weekEndDate,
    );
    if (!prefillResult.ok) return { error: prefillResult.error };

    const supabase = await createClient();
    const { data: report, error: reportError } = await supabase
      .from('weekly_reports')
      .insert({
        project_id: projectId,
        number: 'WR-PENDING',
        report_type: 'cm',
        week_start_date: parsed.weekStartDate,
        week_end_date: parsed.weekEndDate,
        title: parsed.title,
        status: 'draft',
        work_summary: parsed.inputs.thisWeekActivities,
        safety_summary: '',
        schedule_summary: parsed.inputs.projectSnapshot,
        issues_concerns: parsed.inputs.risks
          .map((risk) => `${risk.severity.toUpperCase()}: ${risk.description}`)
          .join('\n'),
        upcoming_work: parsed.inputs.nextWeekActivities,
        weather_summary: '',
        manpower_total: 0,
        equipment_hours: 0,
        submitted_by: scopeResult.scope.userId,
        submit_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (reportError || !report) {
      return { error: reportError?.message ?? 'Failed to create weekly report' };
    }
    if (report.project_id !== projectId) {
      await supabase.from('weekly_reports').delete().eq('id', report.id);
      return { error: 'Created report scope did not match the selected project' };
    }

    const { error: detailError } = await supabase
      .from('up_weekly_report_details')
      .insert({
        report_id: report.id,
        project_id: projectId,
        organization_id: scopeResult.scope.organizationId,
        template_variant_id: prefillResult.template.id,
        template_version: prefillResult.template.version,
        source_snapshot: prefillResult.prefill.sourceSnapshot,
        report_inputs: parsed.inputs,
        review_status: 'draft',
        created_by: scopeResult.scope.userId,
        reviewed_by: null,
        reviewed_at: null,
      });

    if (detailError) {
      // Compensating rollback: an ordinary weekly report must not remain if
      // its project-scoped UP extension failed to persist.
      await supabase
        .from('weekly_reports')
        .delete()
        .eq('id', report.id)
        .eq('project_id', projectId);
      return { error: detailError.message };
    }

    await logActivity(
      supabase,
      projectId,
      'project',
      report.id,
      'created',
      `created project-scoped UP weekly report ${report.number}`,
      scopeResult.scope.userId,
    );
    revalidatePath(`/projects/${projectId}/weekly-reports`);
    return { success: true, data: { reportId: report.id } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to create UP weekly report',
    };
  }
}

async function loadScopedReport(
  scope: ProjectScope,
  projectId: string,
  reportId: string,
): Promise<
  | { ok: true; data: UpReportWorkspaceDetail }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const [{ data: reportData, error: reportError }, { data: detailData, error: detailError }] =
    await Promise.all([
      supabase
        .from('weekly_reports')
        .select('id, project_id, number, title, week_start_date, week_end_date, status')
        .eq('id', reportId)
        .eq('project_id', projectId)
        .single(),
      supabase
        .from('up_weekly_report_details')
        .select('*')
        .eq('report_id', reportId)
        .eq('project_id', projectId)
        .eq('organization_id', scope.organizationId)
        .single(),
    ]);

  if (reportError || !reportData) return { ok: false, error: 'UP weekly report not found' };
  if (detailError || !detailData) return { ok: false, error: 'Project-scoped UP report detail not found' };
  const detail = detailData as UpReportDetail;
  assertProjectScopedEntity('Weekly report', projectId, scope.organizationId, reportData);
  assertProjectScopedEntity('UP report detail', projectId, scope.organizationId, detail);
  if (detail.report_id !== reportData.id) {
    return { ok: false, error: 'UP report detail does not match the selected report' };
  }

  const { data: templateData, error: templateError } = await supabase
    .from('up_report_template_variants')
    .select('*')
    .eq('id', detail.template_variant_id)
    .eq('project_id', projectId)
    .eq('organization_id', scope.organizationId)
    .single();
  if (templateError || !templateData) {
    return { ok: false, error: 'Frozen UP report template is missing or outside this project' };
  }
  const template = templateData as UpTemplateVariant;
  assertProjectScopedEntity('UP report template', projectId, scope.organizationId, template);

  return {
    ok: true,
    data: {
      report: reportData,
      detail: {
        ...detail,
        report_inputs: upReportInputsSchema.parse(detail.report_inputs),
      },
      template,
    },
  };
}

export async function getProjectUpWeeklyReport(
  projectId: string,
  reportId: string,
): Promise<ActionResult<UpReportWorkspaceDetail>> {
  try {
    const scopeResult = await loadStrictProjectScope(projectId);
    if (!scopeResult.ok) return { error: scopeResult.error };
    const budgetError = await requireBudgetAccess(scopeResult.scope, projectId);
    if (budgetError) return { error: budgetError };
    const result = await loadScopedReport(scopeResult.scope, projectId, reportId);
    if (!result.ok) return { error: result.error };
    return { success: true, data: result.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to load UP weekly report',
    };
  }
}

export async function updateProjectUpWeeklyReport(
  projectId: string,
  reportId: string,
  input: { title: string; inputs: UpReportInputs; markReviewed: boolean },
): Promise<ActionResult<UpReportWorkspaceDetail>> {
  try {
    const parsed = z
      .object({
        title: z.string().trim().min(1).max(240),
        inputs: upReportInputsSchema,
        markReviewed: z.boolean(),
      })
      .parse(input);
    const scopeResult = await loadStrictProjectScope(projectId);
    if (!scopeResult.ok) return { error: scopeResult.error };
    const createError = await requireProjectPermission(
      scopeResult.scope,
      projectId,
      ACTIONS.WEEKLY_REPORT_CREATE,
    );
    if (createError) return { error: createError };
    const budgetError = await requireBudgetAccess(scopeResult.scope, projectId);
    if (budgetError) return { error: budgetError };

    const existing = await loadScopedReport(scopeResult.scope, projectId, reportId);
    if (!existing.ok) return { error: existing.error };

    const supabase = await createClient();
    const { error: reportError } = await supabase
      .from('weekly_reports')
      .update({
        title: parsed.title,
        status: parsed.markReviewed ? 'approved' : 'draft',
        work_summary: parsed.inputs.thisWeekActivities,
        schedule_summary: parsed.inputs.projectSnapshot,
        issues_concerns: parsed.inputs.risks
          .map((risk) => `${risk.severity.toUpperCase()}: ${risk.description}`)
          .join('\n'),
        upcoming_work: parsed.inputs.nextWeekActivities,
      })
      .eq('id', reportId)
      .eq('project_id', projectId);
    if (reportError) return { error: reportError.message };

    const reviewData = parsed.markReviewed
      ? {
          review_status: 'reviewed',
          reviewed_by: scopeResult.scope.userId,
          reviewed_at: new Date().toISOString(),
        }
      : {
          review_status: 'draft',
          reviewed_by: null,
          reviewed_at: null,
        };
    const { error: detailError } = await supabase
      .from('up_weekly_report_details')
      .update({
        report_inputs: parsed.inputs,
        ...reviewData,
      })
      .eq('report_id', reportId)
      .eq('project_id', projectId)
      .eq('organization_id', scopeResult.scope.organizationId);
    if (detailError) return { error: detailError.message };

    await logActivity(
      supabase,
      projectId,
      'project',
      reportId,
      parsed.markReviewed ? 'approved' : 'updated',
      parsed.markReviewed
        ? `reviewed UP weekly report ${existing.data.report.number}`
        : `updated UP weekly report ${existing.data.report.number}`,
      scopeResult.scope.userId,
    );
    revalidatePath(`/projects/${projectId}/weekly-reports`);
    revalidatePath(`/projects/${projectId}/weekly-reports/up/${reportId}`);

    const updated = await loadScopedReport(scopeResult.scope, projectId, reportId);
    if (!updated.ok) return { error: updated.error };
    return { success: true, data: updated.data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to update UP weekly report',
    };
  }
}

export async function generateProjectUpReportArtifact(
  projectId: string,
  reportId: string,
): Promise<
  ActionResult<{
    fileName: string;
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    contentBase64: string;
  }>
> {
  try {
    const scopeResult = await loadStrictProjectScope(projectId);
    if (!scopeResult.ok) return { error: scopeResult.error };
    const budgetError = await requireBudgetAccess(scopeResult.scope, projectId);
    if (budgetError) return { error: budgetError };

    const scopedReport = await loadScopedReport(scopeResult.scope, projectId, reportId);
    if (!scopedReport.ok) return { error: scopedReport.error };
    const { detail, template, report } = scopedReport.data;
    if (detail.review_status !== 'reviewed') {
      return { error: 'UP report must be reviewed before the workbook can be downloaded' };
    }
    if (
      detail.source_snapshot.projectId !== projectId
      || detail.source_snapshot.organizationId !== scopeResult.scope.organizationId
    ) {
      return { error: 'UP report source snapshot is outside the selected project/account' };
    }
    if (
      template.status !== 'trusted'
      || template.artifact_capability !== 'xlsx_template'
      || !template.template_storage_path
      || !template.template_sha256
    ) {
      return { error: 'The frozen report template is not a trusted Excel workbook' };
    }
    if (detail.template_version !== template.version) {
      return { error: 'The frozen report template version no longer matches' };
    }
    const expectedStoragePrefix =
      `${scopeResult.scope.organizationId}/${projectId}/${template.id}/`;
    if (!template.template_storage_path.startsWith(expectedStoragePrefix)) {
      return { error: 'The template storage path is outside the selected project/account' };
    }

    const mapping = upWorkbookMappingSchema.parse(
      template.mapping_schema,
    ) as UpWorkbookMapping;
    const supabase = await createClient();
    const { data: templateFile, error: downloadError } = await supabase.storage
      .from(UP_TEMPLATE_BUCKET)
      .download(template.template_storage_path);
    if (downloadError || !templateFile) {
      return { error: downloadError?.message ?? 'The trusted workbook could not be loaded' };
    }
    const templateBytes = new Uint8Array(await templateFile.arrayBuffer());
    const actualSha256 = createHash('sha256').update(templateBytes).digest('hex');
    if (actualSha256 !== template.template_sha256) {
      return {
        error: 'The stored workbook failed its integrity check and was not generated',
      };
    }
    const workbookBytes = fillUpWorkbookTemplate({
      templateBytes,
      mapping,
      report,
      detail,
    });
    const date = scopedReport.data.report.week_end_date;
    const fileName = `${sanitizeArtifactFileName(
      `${scopedReport.data.report.number}-${scopedReport.data.report.title}`,
    )}-${date}.xlsx`;

    return {
      success: true,
      data: {
        fileName,
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        contentBase64: Buffer.from(workbookBytes).toString('base64'),
      },
    };
  } catch (error) {
    return {
      error: upReportingErrorMessage(
        error,
        'Failed to generate the completed UP workbook',
      ),
    };
  }
}
