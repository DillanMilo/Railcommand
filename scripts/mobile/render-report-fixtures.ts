// Local synthetic-only visual QA for the same templates used by web and mobile.
import { mkdir, writeFile } from 'node:fs/promises';
import { renderMobilePdfReport } from '../../src/lib/mobile-api/render-report';
import type { RFI, Submittal, Profile } from '../../src/lib/types';

async function main() {
  const output = '/private/tmp/railcommand-mobile-report-qa';
  await mkdir(output, { recursive: true });
  const profile = (full_name: string) => ({ full_name } as Profile);
  const rfis: RFI[] = Array.from({ length: 12 }, (_, index) => ({
    id: `rfi-${index}`, project_id: 'synthetic-project', number: `RFI-${String(index + 1).padStart(3, '0')}`,
    subject: index % 2 ? 'Confirm drainage detail at turnout approach before installation' : 'Verify track alignment at north yard',
    question: 'Synthetic visual QA - no customer data', answer: null,
    status: index % 2 ? 'answered' : 'open', priority: index % 3 ? 'medium' : 'high',
    submitted_by: 'synthetic-reviewer', submitted_by_profile: profile('Synthetic Reviewer'),
    assigned_to: 'synthetic-engineer', assigned_to_profile: profile('QA Engineer'),
    submit_date: '2026-08-20', due_date: '2026-09-03', response_date: index % 2 ? '2026-08-25' : null,
    milestone_id: null, created_at: '2026-08-20T12:00:00Z',
  }));
  const submittals: Submittal[] = Array.from({ length: 12 }, (_, index) => ({
    id: `submittal-${index}`, project_id: 'synthetic-project', number: `SUB-${String(index + 1).padStart(3, '0')}`,
    title: index % 2 ? 'Trackwork material certification and installation documentation' : 'North yard turnout shop drawings',
    description: 'Synthetic visual QA - no customer data', spec_section: '34 11 13',
    status: index % 2 ? 'under_review' : 'approved', submitted_by: 'synthetic-reviewer',
    submitted_by_profile: profile('Synthetic Reviewer'), reviewed_by: null,
    submit_date: '2026-08-20', due_date: '2026-09-03', review_date: null,
    review_notes: null, milestone_id: null, created_at: '2026-08-20T12:00:00Z',
  }));
  const identity = { projectName: 'Synthetic US Track Renewal - No Customer Data', generatedBy: 'Synthetic Reviewer' };
  for (const data of [{ ...identity, kind: 'rfis' as const, records: rfis }, { ...identity, kind: 'submittals' as const, records: submittals }]) {
    const buffer = await renderMobilePdfReport(data);
    const path = `${output}/${data.kind}.pdf`;
    await writeFile(path, buffer);
    process.stdout.write(`${data.kind}: ${buffer.length} bytes, ${data.records.length} synthetic records\n`);
  }
}
void main();
