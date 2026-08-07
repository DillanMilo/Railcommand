import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import {
  UP_WORKBOOK_MILESTONE_FIELDS,
  UP_WORKBOOK_RISK_FIELDS,
  UP_WORKBOOK_SCALAR_FIELDS,
  upWorkbookMappingSchema,
  type UpReportDetail,
  type UpWorkbookMapping,
} from './model';

export const UP_TEMPLATE_BUCKET = 'up-report-templates';
export const MAX_UP_TEMPLATE_BYTES = 8 * 1024 * 1024;
const MAX_UP_TEMPLATE_EXPANDED_BYTES = 64 * 1024 * 1024;
const MAX_UP_TEMPLATE_ENTRIES = 2_000;

type WorkbookScalar = string | number | null;
type WorkbookFieldValue = WorkbookScalar | WorkbookScalar[];

interface CellAddress {
  column: string;
  row: number;
  coordinate: string;
}

interface WorkbookReference {
  sheetName: string;
  cells: CellAddress[];
}

interface WorkbookParts {
  files: Record<string, Uint8Array>;
  workbookXml: string;
  sheetPaths: Map<string, string>;
  date1904: boolean;
}

export interface UpWorkbookReportIdentity {
  id: string;
  project_id: string;
  number: string;
  title: string;
  week_start_date: string;
  week_end_date: string;
}

export interface UpWorkbookTemplateInspection {
  sheetNames: string[];
  mappedCellCount: number;
  mappedFieldCount: number;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function unescapeXml(value: string): string {
  return value
    .replaceAll('&apos;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');
}

function xmlAttribute(tag: string, name: string): string | null {
  const match = tag.match(
    new RegExp(`\\b${escapeRegex(name)}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'),
  );
  return match ? unescapeXml(match[1] ?? match[2] ?? '') : null;
}

function normalizeZipPath(basePath: string, target: string): string {
  const raw = target.startsWith('/')
    ? target.slice(1)
    : `${basePath.slice(0, basePath.lastIndexOf('/') + 1)}${target}`;
  const parts: string[] = [];
  for (const part of raw.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) throw new Error('Workbook relationship escapes the archive');
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join('/');
}

function columnNumber(column: string): number {
  let value = 0;
  for (const character of column) {
    value = value * 26 + character.charCodeAt(0) - 64;
  }
  return value;
}

function columnName(value: number): string {
  let remaining = value;
  let result = '';
  while (remaining > 0) {
    const index = (remaining - 1) % 26;
    result = String.fromCharCode(65 + index) + result;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return result;
}

export function parseUpWorkbookReference(value: string): WorkbookReference {
  const match = value.trim().match(
    /^(?:'((?:[^']|'')+)'|([^![\]]+))!\$?([A-Z]{1,3})\$?([1-9]\d*)(?::\$?([A-Z]{1,3})\$?([1-9]\d*))?$/,
  );
  if (!match) {
    throw new Error(
      `Invalid workbook mapping reference "${value}". Use 'Sheet Name'!B4 or 'Sheet Name'!B20:B29`,
    );
  }

  const sheetName = (match[1]?.replaceAll("''", "'") ?? match[2]).trim();
  const startColumn = match[3];
  const startRow = Number(match[4]);
  const endColumn = match[5] ?? startColumn;
  const endRow = Number(match[6] ?? startRow);
  const startColumnNumber = columnNumber(startColumn);
  const endColumnNumber = columnNumber(endColumn);

  if (
    endRow < startRow
    || endColumnNumber < startColumnNumber
    || (startColumnNumber !== endColumnNumber && startRow !== endRow)
  ) {
    throw new Error(`Workbook mapping range "${value}" must run in one direction`);
  }

  const cells: CellAddress[] = [];
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumnNumber; column <= endColumnNumber; column += 1) {
      const name = columnName(column);
      cells.push({ column: name, row, coordinate: `${name}${row}` });
    }
  }
  return { sheetName, cells };
}

function openWorkbook(bytes: Uint8Array): WorkbookParts {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UP_TEMPLATE_BYTES) {
    throw new Error('UP Excel templates must be between 1 byte and 8 MB');
  }
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('The uploaded file is not a valid .xlsx archive');
  }

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('The uploaded .xlsx archive could not be opened');
  }

  const entries = Object.entries(files);
  if (entries.length > MAX_UP_TEMPLATE_ENTRIES) {
    throw new Error('The uploaded workbook contains too many archive entries');
  }
  let expandedBytes = 0;
  for (const [path, content] of entries) {
    if (
      path.startsWith('/')
      || path.split('/').some((part) => part === '..')
      || path.includes('\\')
    ) {
      throw new Error('The uploaded workbook contains an unsafe archive path');
    }
    expandedBytes += content.byteLength;
    if (expandedBytes > MAX_UP_TEMPLATE_EXPANDED_BYTES) {
      throw new Error('The uploaded workbook expands beyond the 64 MB safety limit');
    }
  }

  const forbidden = entries.find(([path]) =>
    /(^|\/)(vbaProject\.bin|externalLinks|embeddings)(\/|$)/i.test(path),
  );
  if (forbidden) {
    throw new Error(
      'Macro-enabled files, embedded objects, and external workbook links are not accepted',
    );
  }

  const contentTypes = files['[Content_Types].xml'];
  const workbookPart = files['xl/workbook.xml'];
  const relationshipPart = files['xl/_rels/workbook.xml.rels'];
  if (!contentTypes || !workbookPart || !relationshipPart) {
    throw new Error('The uploaded archive is missing required Excel workbook parts');
  }
  const contentTypesXml = strFromU8(contentTypes);
  if (
    !contentTypesXml.includes(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    )
    || /macroEnabled|vbaProject/i.test(contentTypesXml)
  ) {
    throw new Error('Only non-macro .xlsx workbooks are accepted');
  }

  const workbookXml = strFromU8(workbookPart);
  const relationshipsXml = strFromU8(relationshipPart);
  const relationships = new Map<string, string>();
  for (const match of relationshipsXml.matchAll(/<Relationship\b[^>]*>/gi)) {
    const id = xmlAttribute(match[0], 'Id');
    const target = xmlAttribute(match[0], 'Target');
    const type = xmlAttribute(match[0], 'Type');
    if (id && target && type?.endsWith('/worksheet')) {
      relationships.set(id, normalizeZipPath('xl/workbook.xml', target));
    }
  }

  const sheetPaths = new Map<string, string>();
  for (const match of workbookXml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sheet\b[^>]*>/gi)) {
    const name = xmlAttribute(match[0], 'name');
    const relationshipId = xmlAttribute(match[0], 'r:id');
    if (!name || !relationshipId) continue;
    const path = relationships.get(relationshipId);
    if (!path || !files[path]) {
      throw new Error(`Workbook sheet "${name}" is missing its worksheet part`);
    }
    sheetPaths.set(name, path);
  }
  if (sheetPaths.size === 0) throw new Error('The workbook does not contain a worksheet');

  const workbookProperties =
    workbookXml.match(/<(?:[A-Za-z_][\w.-]*:)?workbookPr\b[^>]*>/i)?.[0]
    ?? '';
  const date1904Value = xmlAttribute(workbookProperties, 'date1904');
  return {
    files,
    workbookXml,
    sheetPaths,
    date1904: date1904Value === '1' || date1904Value === 'true',
  };
}

function findCellXml(worksheetXml: string, coordinate: string): string {
  const matches: string[] = [];
  for (const tagMatch of worksheetXml.matchAll(
    /<((?:[A-Za-z_][\w.-]*:)?c)\b[^>]*>/gi,
  )) {
    if (xmlAttribute(tagMatch[0], 'r')?.toUpperCase() !== coordinate.toUpperCase()) {
      continue;
    }
    if (/\/>\s*$/.test(tagMatch[0])) {
      matches.push(tagMatch[0]);
      continue;
    }
    const start = tagMatch.index;
    const closingTag = `</${tagMatch[1]}>`;
    const end = worksheetXml.indexOf(closingTag, start + tagMatch[0].length);
    if (end === -1) {
      throw new Error(`Mapped destination ${coordinate} is malformed`);
    }
    matches.push(worksheetXml.slice(start, end + closingTag.length));
  }
  if (matches.length !== 1) {
    throw new Error(
      matches.length === 0
        ? `Mapped destination ${coordinate} does not exist in the template`
        : `Mapped destination ${coordinate} is ambiguous in the template`,
    );
  }
  return matches[0];
}

function validateMappingShape(mapping: UpWorkbookMapping): Map<string, WorkbookReference> {
  const references = new Map<string, WorkbookReference>();
  const occupiedCells = new Set<string>();

  for (const [field, rawReference] of Object.entries(mapping)) {
    if (!rawReference) continue;
    const reference = parseUpWorkbookReference(rawReference);
    const isScalar = (UP_WORKBOOK_SCALAR_FIELDS as readonly string[]).includes(field);
    if (isScalar && reference.cells.length !== 1) {
      throw new Error(`Scalar field "${field}" must map to exactly one cell`);
    }
    const isRepeating =
      (UP_WORKBOOK_MILESTONE_FIELDS as readonly string[]).includes(field)
      || (UP_WORKBOOK_RISK_FIELDS as readonly string[]).includes(field);
    if (isRepeating) {
      const columns = new Set(reference.cells.map((cell) => cell.column));
      if (columns.size !== 1) {
        throw new Error(`Repeating field "${field}" must map to a vertical cell range`);
      }
    }
    for (const cell of reference.cells) {
      const key = `${reference.sheetName}\u0000${cell.coordinate}`;
      if (occupiedCells.has(key)) {
        throw new Error(
          `Workbook mapping sends more than one Railcommand field to ${reference.sheetName}!${cell.coordinate}`,
        );
      }
      occupiedCells.add(key);
    }
    references.set(field, reference);
  }

  for (const group of [
    UP_WORKBOOK_MILESTONE_FIELDS,
    UP_WORKBOOK_RISK_FIELDS,
  ] as const) {
    const lengths = group
      .map((field) => references.get(field)?.cells.length)
      .filter((length): length is number => length !== undefined);
    if (lengths.length > 1 && new Set(lengths).size !== 1) {
      throw new Error(
        `${group[0].split('.')[0]} workbook ranges must reserve the same number of rows`,
      );
    }
  }

  return references;
}

export function inspectUpWorkbookTemplate(
  bytes: Uint8Array,
  rawMapping: UpWorkbookMapping,
): UpWorkbookTemplateInspection {
  const mapping = upWorkbookMappingSchema.parse(rawMapping);
  const workbook = openWorkbook(bytes);
  const references = validateMappingShape(mapping);
  const worksheetCache = new Map<string, string>();

  for (const [field, reference] of references) {
    const worksheetPath = workbook.sheetPaths.get(reference.sheetName);
    if (!worksheetPath) {
      throw new Error(`Mapped worksheet "${reference.sheetName}" does not exist`);
    }
    const worksheetXml =
      worksheetCache.get(worksheetPath) ?? strFromU8(workbook.files[worksheetPath]);
    worksheetCache.set(worksheetPath, worksheetXml);
    for (const cell of reference.cells) {
      const cellXml = findCellXml(worksheetXml, cell.coordinate);
      if (/<(?:[A-Za-z_][\w.-]*:)?f(?:\s|>)/i.test(cellXml)) {
        throw new Error(
          `Mapped destination ${reference.sheetName}!${cell.coordinate} contains a formula. Map an input cell instead.`,
        );
      }
    }
    if (!field) throw new Error('Workbook mapping field is missing');
  }

  return {
    sheetNames: [...workbook.sheetPaths.keys()],
    mappedCellCount: [...references.values()].reduce(
      (total, reference) => total + reference.cells.length,
      0,
    ),
    mappedFieldCount: references.size,
  };
}

function titleCase(value: string): string {
  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function fieldValues(
  report: UpWorkbookReportIdentity,
  detail: UpReportDetail,
): Record<string, WorkbookFieldValue> {
  const inputs = detail.report_inputs;
  const project = detail.source_snapshot.project;
  return {
    reportNumber: report.number,
    reportTitle: report.title,
    projectName: project.name,
    projectClient: project.client,
    projectLocation: project.location,
    weekStartDate: report.week_start_date,
    weekEndDate: report.week_end_date,
    dashboardNumber: inputs.dashboardNumber,
    projectManager: inputs.projectManager,
    contractor: inputs.contractor,
    ntpDate: inputs.ntpDate || null,
    estimatedCompletionDate: inputs.estimatedCompletionDate || null,
    trackConstructionProgress: inputs.trackConstructionProgress,
    contractAmount: inputs.contractAmount,
    billedToDate: inputs.billedToDate,
    billingThisPeriod: inputs.billingThisPeriod,
    workOrderAuthorization: inputs.workOrderAuthorization,
    workOrderSpend: inputs.workOrderSpend,
    projectSnapshot: inputs.projectSnapshot,
    thisWeekActivities: inputs.thisWeekActivities,
    nextWeekActivities: inputs.nextWeekActivities,
    'milestones.name': inputs.milestones.map((item) => item.name),
    'milestones.targetDate': inputs.milestones.map((item) => item.targetDate || null),
    'milestones.status': inputs.milestones.map((item) => titleCase(item.status)),
    'milestones.percentComplete': inputs.milestones.map(
      (item) => item.percentComplete,
    ),
    'milestones.notes': inputs.milestones.map((item) => item.notes),
    'risks.category': inputs.risks.map((item) => item.category),
    'risks.description': inputs.risks.map((item) => item.description),
    'risks.champion': inputs.risks.map((item) => item.champion),
    'risks.severity': inputs.risks.map((item) => titleCase(item.severity)),
    'risks.status': inputs.risks.map((item) => titleCase(item.status)),
  };
}

function excelDateSerial(value: string, date1904: boolean): number {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid report date "${value}"`);
  const epoch = date1904
    ? Date.UTC(1904, 0, 1)
    : Date.UTC(1899, 11, 30);
  return (timestamp - epoch) / 86_400_000;
}

function valueForCell(
  field: string,
  value: WorkbookScalar,
  date1904: boolean,
): WorkbookScalar {
  if (
    field === 'weekStartDate'
    || field === 'weekEndDate'
    || field === 'ntpDate'
    || field === 'estimatedCompletionDate'
    || field === 'milestones.targetDate'
  ) {
    return typeof value === 'string' && value
      ? excelDateSerial(value, date1904)
      : null;
  }
  return value;
}

function replaceCellContents(
  worksheetXml: string,
  coordinate: string,
  value: WorkbookScalar,
): string {
  const existing = findCellXml(worksheetXml, coordinate);
  if (/<(?:[A-Za-z_][\w.-]*:)?f(?:\s|>)/i.test(existing)) {
    throw new Error(`Mapped destination ${coordinate} unexpectedly contains a formula`);
  }
  const startMatch = existing.match(
    /^<((?:[A-Za-z_][\w.-]*:)?c)\b[^>]*\/?>/i,
  );
  const startTag = startMatch?.[0];
  const cellTag = startMatch?.[1];
  if (!startTag || !cellTag) {
    throw new Error(`Mapped destination ${coordinate} is invalid`);
  }
  const attributes = startTag
    .replace(new RegExp(`^<${escapeRegex(cellTag)}\\b`, 'i'), '')
    .replace(/\/?>$/, '')
    .replace(/\s+t\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .trim();
  const prefix = attributes ? `<${cellTag} ${attributes}` : `<${cellTag}`;
  const namespacePrefix = cellTag.includes(':')
    ? `${cellTag.slice(0, cellTag.indexOf(':'))}:`
    : '';
  let replacement: string;
  if (value === null || value === '') {
    replacement = `${prefix}></${cellTag}>`;
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Mapped value for ${coordinate} is invalid`);
    replacement =
      `${prefix}><${namespacePrefix}v>${value}</${namespacePrefix}v></${cellTag}>`;
  } else {
    replacement =
      `${prefix} t="inlineStr"><${namespacePrefix}is>`
      + `<${namespacePrefix}t xml:space="preserve">`
      + `${escapeXml(value)}</${namespacePrefix}t>`
      + `</${namespacePrefix}is></${cellTag}>`;
  }
  return worksheetXml.replace(existing, replacement);
}

function forceFormulaRecalculation(workbookXml: string): string {
  const existing = workbookXml.match(
    /<(?:[A-Za-z_][\w.-]*:)?calcPr\b[^>]*\/?>/i,
  )?.[0];
  if (!existing) {
    const rootPrefix =
      workbookXml.match(/<([A-Za-z_][\w.-]*:)?workbook\b/i)?.[1] ?? '';
    return workbookXml.replace(
      new RegExp(`</${escapeRegex(rootPrefix)}workbook>\\s*$`, 'i'),
      `<${rootPrefix}calcPr calcMode="auto" fullCalcOnLoad="1" `
      + `forceFullCalc="1"/></${rootPrefix}workbook>`,
    );
  }
  let updated = existing;
  for (const [name, value] of [
    ['calcMode', 'auto'],
    ['fullCalcOnLoad', '1'],
    ['forceFullCalc', '1'],
  ]) {
    const attributePattern = new RegExp(
      `\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`,
      'i',
    );
    updated = attributePattern.test(updated)
      ? updated.replace(attributePattern, ` ${name}="${value}"`)
      : updated.replace(/\/?>$/, ` ${name}="${value}"$&`);
  }
  return workbookXml.replace(existing, updated);
}

export function fillUpWorkbookTemplate(input: {
  templateBytes: Uint8Array;
  mapping: UpWorkbookMapping;
  report: UpWorkbookReportIdentity;
  detail: UpReportDetail;
}): Uint8Array {
  const mapping = upWorkbookMappingSchema.parse(input.mapping);
  inspectUpWorkbookTemplate(input.templateBytes, mapping);
  const workbook = openWorkbook(input.templateBytes);
  const references = validateMappingShape(mapping);
  const values = fieldValues(input.report, input.detail);
  const worksheetCache = new Map<string, string>();

  for (const [field, reference] of references) {
    const worksheetPath = workbook.sheetPaths.get(reference.sheetName);
    if (!worksheetPath) {
      throw new Error(`Mapped worksheet "${reference.sheetName}" does not exist`);
    }
    let worksheetXml =
      worksheetCache.get(worksheetPath) ?? strFromU8(workbook.files[worksheetPath]);
    const fieldValue = values[field];
    const cellValues = Array.isArray(fieldValue) ? fieldValue : [fieldValue ?? null];
    if (cellValues.length > reference.cells.length) {
      throw new Error(
        `Workbook field "${field}" has ${cellValues.length} values but the template reserves only ${reference.cells.length} rows`,
      );
    }
    for (let index = 0; index < reference.cells.length; index += 1) {
      const cell = reference.cells[index];
      const rawValue = cellValues[index] ?? null;
      worksheetXml = replaceCellContents(
        worksheetXml,
        cell.coordinate,
        valueForCell(field, rawValue, workbook.date1904),
      );
    }
    worksheetCache.set(worksheetPath, worksheetXml);
  }

  for (const [path, xml] of worksheetCache) {
    workbook.files[path] = strToU8(xml);
  }
  workbook.files['xl/workbook.xml'] = strToU8(
    forceFormulaRecalculation(workbook.workbookXml),
  );
  return zipSync(workbook.files, { level: 6 });
}
