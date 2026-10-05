import type { MobilePdfReport, MobilePdfReportRequest } from '@railcommand/domain';
import type { MobileAuthenticatedContext } from './auth';
import { mobileJson } from './auth';
import { checkProjectMembership } from '../actions/permissions-helper';
import type { RFI, Submittal } from '../types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REPORT_BYTES = 2 * 1024 * 1024;

export function parsePdfReportRequest(value: unknown): MobilePdfReportRequest | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<MobilePdfReportRequest>;
  if (typeof input.projectId !== 'string' || !UUID.test(input.projectId)) return null;
  if (input.kind !== 'rfis' && input.kind !== 'submittals') return null;
  if (!Array.isArray(input.recordIds) || input.recordIds.length > 500
    || !input.recordIds.every((id) => typeof id === 'string' && UUID.test(id))) return null;
  const recordIds = input.recordIds.map((id) => id.toLowerCase());
  if (new Set(recordIds).size !== recordIds.length) return null;
  return { projectId: input.projectId.toLowerCase(), kind: input.kind, recordIds };
}

export type PdfReportData = {
  projectName: string;
  generatedBy: string;
} & ({ kind: 'rfis'; records: RFI[] } | { kind: 'submittals'; records: Submittal[] });

type Dependencies = {
  authenticate(request: Request): Promise<MobileAuthenticatedContext | null>;
  render(data: PdfReportData): Promise<Buffer>;
};

export function createPdfReportHandler({ authenticate, render }: Dependencies) {
  return async (request: Request): Promise<Response> => {
    try {
      const context = await authenticate(request);
      if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
      const raw = await request.text();
      if (raw.length > 24_000) return mobileJson({ error: 'Report selection is too large' }, 413);
      let input: MobilePdfReportRequest | null;
      try { input = parsePdfReportRequest(JSON.parse(raw)); }
      catch { input = null; }
      if (!input) return mobileJson({ error: 'Invalid report selection' }, 400);

      // Same read authorization as the web lists. All reads use the caller's
      // bearer-scoped Supabase client; no service-role bypass or saved API URL.
      const access = await checkProjectMembership(context.supabase, context.user.id, input.projectId);
      if (!access.isMember) return mobileJson({ error: 'Project membership required' }, 403);
      const [{ data: project, error: projectError }, { data: profile, error: profileError }] = await Promise.all([
        context.supabase.from('projects').select('name').eq('id', input.projectId).single(),
        context.supabase.from('profiles').select('full_name').eq('id', context.user.id).single(),
      ]);
      if (projectError || !project || profileError || !profile) {
        return mobileJson({ error: 'Could not verify report access' }, 403);
      }

      // Query the IDs actually visible after mobile filtering, but obtain all
      // report values from RLS-protected server rows, never from client data.
      const projection = input.kind === 'rfis'
        ? '*,submitted_by_profile:profiles!rfis_submitted_by_fkey(id,full_name),assigned_to_profile:profiles!rfis_assigned_to_fkey(id,full_name)'
        : '*,submitted_by_profile:profiles!submittals_submitted_by_fkey(id,full_name)';
      const result = input.recordIds.length
        ? await context.supabase.from(input.kind).select(projection)
          .eq('project_id', input.projectId).in('id', input.recordIds).limit(500)
        : { data: [], error: null };
      if (result.error) return mobileJson({ error: 'Could not load report records' }, 503);
      const rows = (result.data ?? []) as unknown as (RFI | Submittal)[];
      const byId = new Map(rows.map((row) => [row.id, row]));
      if (rows.some((row) => row.project_id !== input.projectId)
        || rows.length !== input.recordIds.length || input.recordIds.some((id) => !byId.has(id))) {
        return mobileJson({ error: 'The selected records changed or are no longer accessible. Refresh the list and export again.' }, 409);
      }
      const ordered = input.recordIds.map((id) => byId.get(id)!);
      const identity = { projectName: project.name, generatedBy: profile.full_name || 'RailCommand user' };
      const data: PdfReportData = input.kind === 'rfis'
        ? { ...identity, kind: 'rfis', records: ordered as RFI[] }
        : { ...identity, kind: 'submittals', records: ordered as Submittal[] };
      const pdf = await render(data);
      if (pdf.length > MAX_REPORT_BYTES) return mobileJson({ error: 'This report is too large. Narrow the list filters and try again.' }, 413);
      const report: MobilePdfReport = {
        fileName: `${input.kind}-report-${input.projectId}.pdf`,
        mimeType: 'application/pdf',
        base64: pdf.toString('base64'),
        byteLength: pdf.length,
        recordCount: ordered.length,
      };
      return mobileJson(report);
    } catch {
      // No SQL errors, record values, credentials, or third-party URLs in logs.
      return mobileJson({ error: 'The report could not be generated. Your filters and saved work are unchanged.' }, 500);
    }
  };
}
