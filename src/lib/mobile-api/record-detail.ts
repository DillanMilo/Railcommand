import type { MobileRecordDetail, MobileRecordScope } from '@railcommand/domain';
import type { RFI, RFIResponse, Submittal, Attachment, Profile } from '../types';
import { checkProjectMembership } from '../actions/permissions-helper';
import { getBucket } from '../attachments-shared';
import { mobileJson, type MobileAuthenticatedContext } from './auth';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Authenticate = (request: Request) => Promise<MobileAuthenticatedContext | null>;
export function parseRecordScope(params: URLSearchParams): MobileRecordScope | null {
  const kind = params.get('kind');
  const projectId = params.get('projectId');
  const recordId = params.get('recordId');
  return (kind === 'rfis' || kind === 'submittals') && projectId && uuid.test(projectId) && recordId && uuid.test(recordId)
    ? { kind, projectId: projectId.toLowerCase(), recordId: recordId.toLowerCase() } : null;
}

const person = (profile: Profile | undefined) => profile ? { id: profile.id, name: profile.full_name || 'Unknown' } : null;
const entityType = (scope: MobileRecordScope) => scope.kind === 'rfis' ? 'rfi' : 'submittal';

export function createRecordDetailHandler(authenticate: Authenticate) {
  return async (request: Request) => {
    try {
      const context = await authenticate(request);
      if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
      const scope = parseRecordScope(new URL(request.url).searchParams);
      if (!scope) return mobileJson({ error: 'Invalid record link' }, 400);
      if (!(await checkProjectMembership(context.supabase, context.user.id, scope.projectId)).isMember) {
        return mobileJson({ error: 'Project access is no longer available' }, 403);
      }
      const projection = scope.kind === 'rfis'
        ? 'id,project_id,number,subject,status,priority,question,answer,response_date,due_date,submit_date,created_at,milestone_id,submitted_by_profile:profiles!rfis_submitted_by_fkey(id,full_name),assigned_to_profile:profiles!rfis_assigned_to_fkey(id,full_name)'
        : 'id,project_id,number,title,status,description,spec_section,review_date,review_notes,due_date,submit_date,created_at,milestone_id,submitted_by_profile:profiles!submittals_submitted_by_fkey(id,full_name),reviewed_by_profile:profiles!submittals_reviewed_by_fkey(id,full_name)';
      const { data, error } = await context.supabase.from(scope.kind).select(projection)
        .eq('project_id', scope.projectId).eq('id', scope.recordId).maybeSingle();
      if (error) return mobileJson({ error: 'Could not load the record' }, 503);
      const row = data as unknown as RFI | Submittal | null;
      if (!row || row.id !== scope.recordId || row.project_id !== scope.projectId) return mobileJson({ error: 'Record not found or no longer accessible' }, 404);

      const [attachmentResult, milestoneResult, responseResult] = await Promise.all([
        context.supabase.from('attachments').select('id,entity_id,project_id,entity_type,file_name,file_type,file_size,photo_category')
          .eq('project_id', scope.projectId).eq('entity_id', scope.recordId).eq('entity_type', entityType(scope)).order('created_at', { ascending: true }).order('id').limit(201),
        row.milestone_id ? context.supabase.from('milestones').select('id,name,project_id')
          .eq('id', row.milestone_id).eq('project_id', scope.projectId).maybeSingle() : Promise.resolve({ data: null, error: null }),
        scope.kind === 'rfis' ? context.supabase.from('rfi_responses').select('id,rfi_id,content,is_official_response,created_at,author:profiles!rfi_responses_author_id_fkey(id,full_name)')
          .eq('rfi_id', scope.recordId).order('created_at').order('id').limit(201) : Promise.resolve({ data: [], error: null }),
      ]);
      if (attachmentResult.error || milestoneResult.error || responseResult.error) return mobileJson({ error: 'Could not load record references' }, 503);
      const attachments = (attachmentResult.data ?? []) as unknown as Attachment[];
      const responses = (responseResult.data ?? []) as unknown as RFIResponse[];
      // Do not silently claim a truncated record is complete. Pagination is a
      // tracked follow-up for exceptionally large records, not partial caching.
      if (attachments.length > 200 || responses.length > 200) return mobileJson({ error: 'This record is too large for mobile detail viewing. Open it on the web.' }, 413);
      if (attachments.some((item) => item.project_id !== scope.projectId || item.entity_id !== scope.recordId || item.entity_type !== entityType(scope))) {
        return mobileJson({ error: 'Could not verify attachment access' }, 403);
      }
      const milestone = milestoneResult.data;
      const common = {
        fetchedAt: new Date().toISOString(),
        attachments: attachments.map((item) => ({ id: item.id, fileName: item.file_name, fileType: item.file_type, size: item.file_size, category: item.photo_category })),
        milestone: milestone?.project_id === scope.projectId ? { id: milestone.id, name: milestone.name } : null,
      };
      const base = { id: row.id, projectId: row.project_id, number: row.number, dueDate: row.due_date ?? '', createdAt: row.created_at, submitDate: row.submit_date ?? '', submittedBy: person(row.submitted_by_profile) };
      let result: MobileRecordDetail;
      if (scope.kind === 'rfis') {
        const rfi = row as RFI;
        if (responses.some((response) => response.rfi_id !== scope.recordId)) return mobileJson({ error: 'Could not verify record responses' }, 403);
        result = { ...common, kind: 'rfis', record: { ...base, subject: rfi.subject, status: rfi.status, priority: rfi.priority,
          question: rfi.question ?? '', answer: rfi.answer ?? null, responseDate: rfi.response_date ?? null, assignedTo: person(rfi.assigned_to_profile),
          responses: responses.map((response) => ({ id: response.id, author: person(response.author), content: response.content, official: response.is_official_response, createdAt: response.created_at }))
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
        } };
      } else {
        const submittal = row as Submittal;
        result = { ...common, kind: 'submittals', record: { ...base, title: submittal.title, status: submittal.status,
          description: submittal.description ?? '', specSection: submittal.spec_section ?? '', reviewDate: submittal.review_date ?? null,
          reviewNotes: submittal.review_notes ?? null, reviewedBy: person(submittal.reviewed_by_profile),
        } };
      }
      if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 2 * 1024 * 1024) return mobileJson({ error: 'This record is too large for mobile detail viewing. Open it on the web.' }, 413);
      return mobileJson(result);
    } catch { return mobileJson({ error: 'Could not load this record. Try again when connected.' }, 503); }
  };
}

export function attachmentStoragePath(fileUrl: string, category: string, scope: MobileRecordScope, supabaseUrl: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(fileUrl);
    const origin = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || url.origin !== origin.origin || url.username || url.password || url.search || url.hash) return null;
    if (!['standard', 'thermal', 'document'].includes(category)) return null;
    const bucket = getBucket(category);
    const prefix = `/storage/v1/object/public/${bucket}/`;
    if (!url.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    const parts = path.split('/');
    if (parts.length !== 4 || parts[0] !== scope.projectId || parts[1] !== entityType(scope) || parts[2] !== scope.recordId
      || !/^[a-z0-9][a-z0-9._-]*$/i.test(parts[3]) || parts[3] === '..') return null;
    return { bucket, path };
  } catch { return null; }
}

export function createRecordAttachmentHandler(authenticate: Authenticate, supabaseUrl: () => string) {
  return async (request: Request) => {
    try {
      const context = await authenticate(request);
      if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
      const params = new URL(request.url).searchParams;
      const scope = parseRecordScope(params);
      const attachmentId = params.get('attachmentId')?.toLowerCase();
      if (!scope || !attachmentId || !uuid.test(attachmentId)) return mobileJson({ error: 'Invalid attachment link' }, 400);
      if (!(await checkProjectMembership(context.supabase, context.user.id, scope.projectId)).isMember) return mobileJson({ error: 'Project access is no longer available' }, 403);
      const { data: parent, error: parentError } = await context.supabase.from(scope.kind).select('id,project_id')
        .eq('id', scope.recordId).eq('project_id', scope.projectId).maybeSingle();
      if (parentError) return mobileJson({ error: 'Could not verify attachment access' }, 503);
      if (!parent || parent.id !== scope.recordId || parent.project_id !== scope.projectId) return mobileJson({ error: 'Record not found or no longer accessible' }, 404);
      const { data, error } = await context.supabase.from('attachments').select('id,project_id,entity_id,entity_type,file_url,photo_category')
        .eq('id', attachmentId).eq('project_id', scope.projectId).eq('entity_id', scope.recordId).eq('entity_type', entityType(scope)).maybeSingle();
      if (error) return mobileJson({ error: 'Could not load attachment' }, 503);
      if (!data || data.id !== attachmentId || data.project_id !== scope.projectId || data.entity_id !== scope.recordId || data.entity_type !== entityType(scope)) return mobileJson({ error: 'Attachment not found' }, 404);
      const storage = attachmentStoragePath(data.file_url, data.photo_category, scope, supabaseUrl());
      if (!storage) return mobileJson({ error: 'Attachment storage path could not be verified' }, 409);
      const signed = await context.supabase.storage.from(storage.bucket).createSignedUrl(storage.path, 60);
      if (signed.error || !signed.data?.signedUrl) return mobileJson({ error: 'Could not open attachment' }, 503);
      return mobileJson({ attachmentId, url: signed.data.signedUrl, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    } catch { return mobileJson({ error: 'Could not open attachment. Reconnect and try again.' }, 503); }
  };
}
