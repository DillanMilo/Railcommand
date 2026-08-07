import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import {
  assertTemplateAssignmentScope,
  buildProjectScopedPrefill,
  buildUpReportDataPackage,
  emptyUpReportInputs,
  type ProjectUpReportConfig,
  type UpReportDetail,
  type UpTemplateVariant,
} from '../model';

const projectId = '11111111-1111-4111-8111-111111111111';
const otherProjectId = '22222222-2222-4222-8222-222222222222';
const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherOrganizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const templateId = '33333333-3333-4333-8333-333333333333';
const reportId = '44444444-4444-4444-8444-444444444444';

function template(overrides: Partial<UpTemplateVariant> = {}): UpTemplateVariant {
  return {
    id: templateId,
    project_id: projectId,
    organization_id: organizationId,
    variant_key: 'g2-weekly-construction',
    name: 'G2 Weekly Construction',
    version: '1',
    status: 'metadata_only',
    artifact_capability: 'data_package',
    template_storage_path: null,
    template_sha256: null,
    template_file_name: null,
    template_size_bytes: null,
    mapping_schema: {},
    created_by: 'user-1',
    created_at: '2026-07-30T12:00:00.000Z',
    updated_at: '2026-07-30T12:00:00.000Z',
    ...overrides,
  };
}

function config(
  overrides: Partial<ProjectUpReportConfig> = {},
): ProjectUpReportConfig {
  return {
    project_id: projectId,
    organization_id: organizationId,
    template_variant_id: templateId,
    project_mapping: {},
    manual_defaults: {},
    created_by: 'user-1',
    updated_by: 'user-1',
    created_at: '2026-07-30T12:00:00.000Z',
    updated_at: '2026-07-30T12:00:00.000Z',
    ...overrides,
  };
}

function detail(overrides: Partial<UpReportDetail> = {}): UpReportDetail {
  return {
    report_id: reportId,
    project_id: projectId,
    organization_id: organizationId,
    template_variant_id: templateId,
    template_version: '1',
    source_snapshot: {
      organizationId,
      projectId,
      capturedAt: '2026-07-30T12:00:00.000Z',
      weekStartDate: '2026-07-27',
      weekEndDate: '2026-08-02',
      project: {
        id: projectId,
        name: 'G2 Weekly Construction',
        client: 'Union Pacific',
        location: 'Chicago',
        status: 'active',
        targetEndDate: '2026-12-31',
        projectCompletionDate: '',
      },
      sourceIds: {
        dailyLogs: [],
        milestones: [],
        rfis: [],
        priorWeeklyReport: null,
      },
      warnings: [],
    },
    report_inputs: emptyUpReportInputs(),
    review_status: 'reviewed',
    created_by: 'user-1',
    reviewed_by: 'user-1',
    reviewed_at: '2026-07-30T13:00:00.000Z',
    created_at: '2026-07-30T12:00:00.000Z',
    updated_at: '2026-07-30T13:00:00.000Z',
    ...overrides,
  };
}

describe('UP reporting project/account isolation', () => {
  it('rejects a template assignment from another project', () => {
    assert.throws(
      () =>
        assertTemplateAssignmentScope(
          projectId,
          organizationId,
          config(),
          template({ project_id: otherProjectId }),
        ),
      /selected project/,
    );
  });

  it('rejects a template assignment from another account', () => {
    assert.throws(
      () =>
        assertTemplateAssignmentScope(
          projectId,
          organizationId,
          config(),
          template({ organization_id: otherOrganizationId }),
        ),
      /selected account/,
    );
  });

  it('rejects prefill rows from another project', () => {
    assert.throws(
      () =>
        buildProjectScopedPrefill({
          organizationId,
          projectId,
          weekStartDate: '2026-07-27',
          weekEndDate: '2026-08-02',
          project: {
            id: projectId,
            organization_id: organizationId,
            name: 'G2 Weekly Construction',
            client: 'Union Pacific',
            location: 'Chicago',
            status: 'active',
            target_end_date: '2026-12-31',
          },
          members: [],
          milestones: [],
          dailyLogs: [
            {
              id: 'foreign-log',
              project_id: otherProjectId,
              log_date: '2026-07-28',
              work_summary: 'This must never be included.',
            },
          ],
          rfis: [],
          priorReport: null,
          defaults: {},
        }),
      /another project/,
    );
  });

  it('builds prefill only from the selected project and records source ids', () => {
    const result = buildProjectScopedPrefill({
      organizationId,
      projectId,
      weekStartDate: '2026-07-27',
      weekEndDate: '2026-08-02',
      project: {
        id: projectId,
        organization_id: organizationId,
        name: 'G2 Weekly Construction',
        client: 'Union Pacific',
        location: 'Chicago',
        status: 'active',
        target_end_date: '2026-12-31',
      },
      members: [
        {
          project_id: projectId,
          project_role: 'manager',
          profile: { full_name: 'Project Manager' },
        },
      ],
      milestones: [
        {
          id: 'milestone-1',
          project_id: projectId,
          name: 'Track construction',
          description: 'Main track',
          target_date: '2026-09-01',
          status: 'on_track',
          percent_complete: 40,
        },
      ],
      dailyLogs: [
        {
          id: 'log-1',
          project_id: projectId,
          log_date: '2026-07-28',
          work_summary: 'Installed rail.',
        },
      ],
      rfis: [],
      priorReport: null,
      defaults: {},
      capturedAt: '2026-07-30T12:00:00.000Z',
    });

    assert.equal(result.inputs.projectManager, 'Project Manager');
    assert.match(result.inputs.trackConstructionProgress, /40%/);
    assert.deepEqual(result.sourceSnapshot.sourceIds.dailyLogs, ['log-1']);
    assert.deepEqual(result.sourceSnapshot.sourceIds.milestones, ['milestone-1']);
  });
});

describe('UP report artifact capability boundary', () => {
  const report = {
    id: reportId,
    project_id: projectId,
    number: 'WR-001',
    title: 'Week ending August 2',
    week_start_date: '2026-07-27',
    week_end_date: '2026-08-02',
    status: 'draft',
  };

  it('requires human review before download', () => {
    assert.throws(
      () =>
        buildUpReportDataPackage({
          organizationId,
          projectId,
          report,
          detail: detail({
            review_status: 'draft',
            reviewed_by: null,
            reviewed_at: null,
          }),
          template: template(),
          generatedBy: 'Project Manager',
        }),
      /must be reviewed/,
    );
  });

  it('rejects an out-of-project frozen source snapshot', () => {
    assert.throws(
      () =>
        buildUpReportDataPackage({
          organizationId,
          projectId,
          report,
          detail: detail({
            source_snapshot: {
              ...detail().source_snapshot,
              projectId: otherProjectId,
            },
          }),
          template: template(),
          generatedBy: 'Project Manager',
        }),
      /outside the selected project/,
    );
  });

  it('fails closed when an XLSX capability is declared but not installed', () => {
    assert.throws(
      () =>
        buildUpReportDataPackage({
          organizationId,
          projectId,
          report,
          detail: detail(),
          template: template({
            status: 'trusted',
            artifact_capability: 'xlsx_template',
            template_storage_path:
              `${organizationId}/${projectId}/${templateId}/up-template.xlsx`,
            template_sha256: 'a'.repeat(64),
            template_file_name: 'up-template.xlsx',
            template_size_bytes: 1_024,
          }),
          generatedBy: 'Project Manager',
        }),
      /Excel generation is not installed/,
    );
  });

  it('emits a reviewed, explicitly scoped data package with no delivery fields', () => {
    const artifact = JSON.parse(
      buildUpReportDataPackage({
        organizationId,
        projectId,
        report,
        detail: detail(),
        template: template(),
        generatedBy: 'Project Manager',
        generatedAt: '2026-07-30T14:00:00.000Z',
      }),
    );

    assert.equal(artifact.scope.projectId, projectId);
    assert.equal(artifact.scope.organizationId, organizationId);
    assert.equal(artifact.template.capability, 'data_package');
    assert.match(artifact.template.notice, /No Union Pacific Excel template/);
    assert.equal('email' in artifact, false);
    assert.equal('recipients' in artifact, false);
  });
});
