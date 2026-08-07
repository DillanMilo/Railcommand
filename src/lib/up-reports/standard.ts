import type { UpWorkbookMapping } from './model';

export const RAILCOMMAND_STANDARD_TEMPLATE_KEY =
  'railcommand-standard-weekly-construction';
export const RAILCOMMAND_STANDARD_TEMPLATE_NAME =
  'RailCommand Standard Weekly Construction Report';
export const RAILCOMMAND_STANDARD_TEMPLATE_VERSION = '1.0.1';
export const RAILCOMMAND_STANDARD_TEMPLATE_FILE_NAME =
  'railcommand-standard-weekly-construction-v1.0.1.xlsx';

export const RAILCOMMAND_STANDARD_WORKBOOK_MAPPING: UpWorkbookMapping = {
  reportTitle: "'Weekly Construction Report'!A3",
  projectName: "'Weekly Construction Report'!B4",
  weekEndDate: "'Weekly Construction Report'!G4",
  projectClient: "'Weekly Construction Report'!B5",
  reportNumber: "'Weekly Construction Report'!G5",
  projectLocation: "'Weekly Construction Report'!B6",
  dashboardNumber: "'Weekly Construction Report'!G6",
  projectManager: "'Weekly Construction Report'!B7",
  contractor: "'Weekly Construction Report'!G7",
  ntpDate: "'Weekly Construction Report'!B8",
  estimatedCompletionDate: "'Weekly Construction Report'!E8",
  trackConstructionProgress: "'Weekly Construction Report'!A11",
  projectSnapshot: "'Weekly Construction Report'!A16",
  contractAmount: "'Weekly Construction Report'!A22",
  billedToDate: "'Weekly Construction Report'!C22",
  billingThisPeriod: "'Weekly Construction Report'!E22",
  workOrderAuthorization: "'Weekly Construction Report'!A25",
  workOrderSpend: "'Weekly Construction Report'!C25",
  thisWeekActivities: "'Weekly Construction Report'!A29",
  nextWeekActivities: "'Weekly Construction Report'!E29",
  'milestones.name': "'Weekly Construction Report'!A36:A45",
  'milestones.targetDate': "'Weekly Construction Report'!D36:D45",
  'milestones.status': "'Weekly Construction Report'!E36:E45",
  'milestones.percentComplete': "'Weekly Construction Report'!G36:G45",
  'milestones.notes': "'Weekly Construction Report'!H36:H45",
  'risks.category': "'Weekly Construction Report'!A49:A58",
  'risks.description': "'Weekly Construction Report'!B49:B58",
  'risks.champion': "'Weekly Construction Report'!F49:F58",
  'risks.severity': "'Weekly Construction Report'!G49:G58",
  'risks.status': "'Weekly Construction Report'!H49:H58",
};
