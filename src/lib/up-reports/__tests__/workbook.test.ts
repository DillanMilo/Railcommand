import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  emptyUpReportInputs,
  type UpReportDetail,
  type UpWorkbookMapping,
} from '../model';
import {
  fillUpWorkbookTemplate,
  inspectUpWorkbookTemplate,
} from '../workbook';
import { RAILCOMMAND_STANDARD_WORKBOOK_MAPPING } from '../standard';
import { RAILCOMMAND_STANDARD_WORKBOOK_BASE64 } from '../standard-workbook-base64';

const projectId = '11111111-1111-4111-8111-111111111111';
const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function fixtureWorkbook(extraFiles: Record<string, Uint8Array> = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Override PartName="/xl/workbook.xml" '
      + 'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" '
      + 'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '</Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" '
      + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
      + 'Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
      + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<workbookPr date1904="0"/>'
      + '<sheets><sheet name="Weekly Report" sheetId="1" r:id="rId1"/></sheets>'
      + '<calcPr calcId="1"/></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" '
      + 'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
      + 'Target="worksheets/sheet1.xml"/></Relationships>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?>'
      + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
      + '<sheetData>'
      + '<row r="1"><c r="A1" s="5" t="inlineStr"><is><t>Project</t></is></c></row>'
      + '<row r="2"><c r="A2" s="6"/><c r="B2" s="7"><f>1+1</f><v>2</v></c></row>'
      + '<row r="5"><c r="B5" s="8"/><c r="C5" s="9"/><c r="D5" s="10"/></row>'
      + '<row r="6"><c r="B6" s="8"/><c r="C6" s="9"/><c r="D6" s="10"/></row>'
      + '</sheetData>'
      + '<dataValidations count="1"><dataValidation type="list" sqref="C5:C6">'
      + '<formula1>"Not Started,On Track,At Risk,Behind,Complete"</formula1>'
      + '</dataValidation></dataValidations>'
      + '</worksheet>',
    ),
    'xl/styles.xml': strToU8('<styleSheet><marker>unchanged</marker></styleSheet>'),
    ...extraFiles,
  };
  return zipSync(files, { level: 6 });
}

function detail(): UpReportDetail {
  const inputs = emptyUpReportInputs();
  inputs.projectManager = 'Dillan';
  inputs.milestones = [
    {
      name: 'Track 1',
      targetDate: '2026-08-15',
      status: 'on_track',
      percentComplete: 50,
      notes: '',
    },
  ];
  return {
    report_id: '44444444-4444-4444-8444-444444444444',
    project_id: projectId,
    organization_id: organizationId,
    template_variant_id: '33333333-3333-4333-8333-333333333333',
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
    report_inputs: inputs,
    review_status: 'reviewed',
    created_by: 'user-1',
    reviewed_by: 'user-1',
    reviewed_at: '2026-07-30T13:00:00.000Z',
    created_at: '2026-07-30T12:00:00.000Z',
    updated_at: '2026-07-30T13:00:00.000Z',
  };
}

const mapping: UpWorkbookMapping = {
  projectName: "'Weekly Report'!A1",
  weekEndDate: "'Weekly Report'!A2",
  'milestones.name': "'Weekly Report'!B5:B6",
  'milestones.status': "'Weekly Report'!C5:C6",
};

describe('UP trusted workbook handling', () => {
  it('validates mapped cells without accepting formula destinations', () => {
    const inspection = inspectUpWorkbookTemplate(fixtureWorkbook(), mapping);
    assert.deepEqual(inspection.sheetNames, ['Weekly Report']);
    assert.equal(inspection.mappedFieldCount, 4);
    assert.equal(inspection.mappedCellCount, 6);

    assert.throws(
      () =>
        inspectUpWorkbookTemplate(fixtureWorkbook(), {
          projectName: "'Weekly Report'!B2",
        }),
      /contains a formula/,
    );
  });

  it('generates the RailCommand standard workbook without a client upload', () => {
    const standardBytes = new Uint8Array(
      Buffer.from(RAILCOMMAND_STANDARD_WORKBOOK_BASE64, 'base64'),
    );
    const inspection = inspectUpWorkbookTemplate(
      standardBytes,
      RAILCOMMAND_STANDARD_WORKBOOK_MAPPING,
    );
    assert.deepEqual(inspection.sheetNames, ['Weekly Construction Report']);
    assert.ok(inspection.mappedFieldCount > 20);

    const reportDetail = detail();
    reportDetail.report_inputs.contractAmount = 1_000_000;
    reportDetail.report_inputs.billedToDate = 500_000;
    reportDetail.report_inputs.risks = [
      {
        category: 'Schedule',
        description: 'Coordinate track outage.',
        champion: 'Project Manager',
        severity: 'high',
        status: 'monitoring',
      },
    ];
    const outputBytes = fillUpWorkbookTemplate({
      templateBytes: standardBytes,
      mapping: RAILCOMMAND_STANDARD_WORKBOOK_MAPPING,
      report: {
        id: reportDetail.report_id,
        project_id: projectId,
        number: 'WR-001',
        title: 'Weekly Construction Report — Week Ending August 2',
        week_start_date: '2026-07-27',
        week_end_date: '2026-08-02',
      },
      detail: reportDetail,
    });
    const outputFiles = unzipSync(outputBytes);
    const sheetXml = strFromU8(outputFiles['xl/worksheets/sheet1.xml']);

    assert.match(sheetXml, /Weekly Construction Report — Week Ending August 2/);
    assert.match(sheetXml, /G2 Weekly Construction/);
    assert.match(
      sheetXml,
      /<(?:\w+:)?c r="A22"[^>]*><(?:\w+:)?v>1000000<\/(?:\w+:)?v><\/(?:\w+:)?c>/,
    );
    assert.match(
      sheetXml,
      /<(?:\w+:)?c r="C22"[^>]*><(?:\w+:)?v>500000<\/(?:\w+:)?v><\/(?:\w+:)?c>/,
    );
    assert.match(sheetXml, /Track 1/);
    assert.match(sheetXml, /On Track/);
    assert.match(sheetXml, /Coordinate track outage\./);
    assert.match(sheetXml, /High/);
    assert.match(sheetXml, /Monitoring/);
    assert.match(
      sheetXml,
      /<(?:\w+:)?f>IF\(A22&gt;0,C22\/A22,0\)<\/(?:\w+:)?f>/,
    );
    assert.match(sheetXml, /Not Started,On Track,At Risk,Behind,Complete/);
    assert.match(sheetXml, /Low,Medium,High,Critical/);
  });

  it('fills mapped cells while preserving styles, formulas, and validation XML', () => {
    const inputBytes = fixtureWorkbook();
    const inputFiles = unzipSync(inputBytes);
    const outputBytes = fillUpWorkbookTemplate({
      templateBytes: inputBytes,
      mapping,
      report: {
        id: '44444444-4444-4444-8444-444444444444',
        project_id: projectId,
        number: 'WR-001',
        title: 'Week ending August 2',
        week_start_date: '2026-07-27',
        week_end_date: '2026-08-02',
      },
      detail: detail(),
    });
    const outputFiles = unzipSync(outputBytes);
    const sheetXml = strFromU8(outputFiles['xl/worksheets/sheet1.xml']);
    const workbookXml = strFromU8(outputFiles['xl/workbook.xml']);

    assert.match(
      sheetXml,
      /<c r="A1" s="5" t="inlineStr"><is><t xml:space="preserve">G2 Weekly Construction<\/t><\/is><\/c>/,
    );
    assert.match(sheetXml, /<c r="A2" s="6"><v>46236<\/v><\/c>/);
    assert.match(sheetXml, /<c r="B2" s="7"><f>1\+1<\/f><v>2<\/v><\/c>/);
    assert.match(sheetXml, /sqref="C5:C6"/);
    assert.match(sheetXml, /Not Started,On Track,At Risk,Behind,Complete/);
    assert.match(sheetXml, /<c r="B5" s="8" t="inlineStr">/);
    assert.match(sheetXml, /Track 1/);
    assert.match(sheetXml, /<c r="B6" s="8"><\/c>/);
    assert.match(workbookXml, /calcMode="auto"/);
    assert.match(workbookXml, /fullCalcOnLoad="1"/);
    assert.equal(
      strFromU8(outputFiles['xl/styles.xml']),
      strFromU8(inputFiles['xl/styles.xml']),
    );
  });

  it('fails closed instead of omitting repeating rows beyond workbook capacity', () => {
    const reportDetail = detail();
    reportDetail.report_inputs.milestones = [
      ...reportDetail.report_inputs.milestones,
      {
        name: 'Track 2',
        targetDate: '2026-08-22',
        status: 'not_started',
        percentComplete: 0,
        notes: '',
      },
      {
        name: 'Track 3',
        targetDate: '2026-08-29',
        status: 'not_started',
        percentComplete: 0,
        notes: '',
      },
    ];

    assert.throws(
      () =>
        fillUpWorkbookTemplate({
          templateBytes: fixtureWorkbook(),
          mapping,
          report: {
            id: reportDetail.report_id,
            project_id: projectId,
            number: 'WR-001',
            title: 'Week ending August 2',
            week_start_date: '2026-07-27',
            week_end_date: '2026-08-02',
          },
          detail: reportDetail,
        }),
      /has 3 values but the template reserves only 2 rows/,
    );
  });

  it('rejects unsafe workbook capabilities and missing mapped cells', () => {
    assert.throws(
      () =>
        inspectUpWorkbookTemplate(
          fixtureWorkbook({ 'xl/vbaProject.bin': new Uint8Array([1, 2, 3]) }),
          mapping,
        ),
      /Macro-enabled files/,
    );
    assert.throws(
      () =>
        inspectUpWorkbookTemplate(fixtureWorkbook(), {
          projectName: "'Weekly Report'!Z99",
        }),
      /does not exist/,
    );
  });

  it('rejects duplicate and inconsistent repeating destinations', () => {
    assert.throws(
      () =>
        inspectUpWorkbookTemplate(fixtureWorkbook(), {
          projectName: "'Weekly Report'!A1",
          projectClient: "'Weekly Report'!A1",
        }),
      /more than one Railcommand field/,
    );
    assert.throws(
      () =>
        inspectUpWorkbookTemplate(fixtureWorkbook(), {
          'milestones.name': "'Weekly Report'!B5:B6",
          'milestones.status': "'Weekly Report'!C5",
        }),
      /same number of rows/,
    );
  });
});
