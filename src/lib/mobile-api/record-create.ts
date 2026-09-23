import { validateRecordDraft, type MobileRecordDraft, type MobileRecordKind } from '@railcommand/domain';
import { checkPermission } from '../actions/permissions-helper';
import { ACTIONS } from '../permissions';
import { mobileJson, type MobileAuthenticatedContext } from './auth';

type Authenticate = (request: Request) => Promise<MobileAuthenticatedContext | null>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const action = (kind: MobileRecordKind) => kind === 'rfis' ? ACTIONS.RFI_CREATE : ACTIONS.SUBMITTAL_CREATE;

export function parseRecordDraft(body: unknown): MobileRecordDraft | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as Record<string, unknown>;
  if (value.version !== 1 || (value.kind !== 'rfis' && value.kind !== 'submittals')) return null;
  for (const key of ['projectId', 'clientId', 'title', 'body', 'priority', 'assignedTo', 'dueDate', 'milestoneId', 'specSection']) {
    if (typeof value[key] !== 'string') return null;
  }
  const draft: MobileRecordDraft = {
    version: 1, kind: value.kind, projectId: (value.projectId as string).toLowerCase(), clientId: (value.clientId as string).toLowerCase(),
    title: (value.title as string).trim(), body: value.body as string, priority: value.priority as MobileRecordDraft['priority'],
    assignedTo: (value.assignedTo as string).toLowerCase(), dueDate: value.dueDate as string,
    milestoneId: (value.milestoneId as string).toLowerCase(), specSection: value.specSection as string,
    updatedAt: new Date().toISOString(),
  };
  return validateRecordDraft(draft) ? null : draft;
}

async function canCreate(context: MobileAuthenticatedContext, kind: MobileRecordKind, projectId: string) {
  const permission = await checkPermission(context.supabase, context.user.id, projectId, action(kind));
  return permission.allowed && (permission.orgRole === 'admin' || permission.canEdit);
}

export function createRecordOptionsHandler(authenticate: Authenticate) {
  return async (request: Request) => {
    try {
      const context = await authenticate(request);
      if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
      const params = new URL(request.url).searchParams;
      const kind = params.get('kind'); const projectId = params.get('projectId');
      if ((kind !== 'rfis' && kind !== 'submittals') || !projectId || !uuid.test(projectId)) return mobileJson({ error: 'Invalid form link' }, 400);
      if (!await canCreate(context, kind, projectId)) return mobileJson({ error: 'You do not have permission to create this record' }, 403);
      const [members, milestones] = await Promise.all([
        context.supabase.from('project_members').select('profile_id,project_id,profile:profiles(id,full_name)').eq('project_id', projectId).limit(501),
        context.supabase.from('milestones').select('id,project_id,name').eq('project_id', projectId).order('name').limit(501),
      ]);
      if (members.error || milestones.error) return mobileJson({ error: 'Could not load form choices' }, 503);
      if ((members.data?.length ?? 0) > 500 || (milestones.data?.length ?? 0) > 500) return mobileJson({ error: 'Too many form choices for this mobile version. Use the web form.' }, 413);
      const people = (members.data ?? []) as unknown as { project_id: string; profile_id: string; profile: { id: string; full_name: string } | null }[];
      if (people.some((item) => item.project_id !== projectId || (item.profile && item.profile.id !== item.profile_id))
        || milestones.data?.some((item) => item.project_id !== projectId)) return mobileJson({ error: 'Could not verify form choices' }, 403);
      return mobileJson({ kind, projectId, fetchedAt: new Date().toISOString(),
        assignees: people.filter((item) => item.profile).map((item) => ({ id: item.profile!.id, name: item.profile!.full_name || 'Unknown' })),
        milestones: (milestones.data ?? []).map((item) => ({ id: item.id, name: item.name })),
      });
    } catch { return mobileJson({ error: 'Could not load form choices. Your draft is unchanged.' }, 503); }
  };
}

export function createRecordCreateHandler(authenticate: Authenticate) {
  return async (request: Request) => {
    try {
      const context = await authenticate(request);
      if (!context) return mobileJson({ error: 'Not authenticated' }, 401);
      const raw = await request.text();
      if (Buffer.byteLength(raw, 'utf8') > 256 * 1024) return mobileJson({ error: 'The draft is too large' }, 413);
      let body: unknown;
      try { body = JSON.parse(raw); } catch { return mobileJson({ error: 'Invalid draft JSON' }, 400); }
      const draft = parseRecordDraft(body);
      if (!draft || request.headers.get('idempotency-key')?.toLowerCase() !== draft.clientId) return mobileJson({ error: 'Check the required fields, due date and draft identity' }, 400);
      if (!await canCreate(context, draft.kind, draft.projectId)) return mobileJson({ error: 'Creation permission is no longer available. Your draft remains on this device.' }, 403);

      const fields = draft.kind === 'rfis'
        ? { subject: draft.title, question: draft.body, priority: draft.priority, assigned_to: draft.assignedTo }
        : { title: draft.title, description: draft.body, spec_section: draft.specSection };
      const payload = { ...fields, id: draft.clientId, project_id: draft.projectId, submitted_by: context.user.id,
        due_date: draft.dueDate, milestone_id: draft.milestoneId || null };
      const projection = `id,number,project_id,submitted_by,due_date,milestone_id,${Object.keys(fields).join(',')}`;
      const readExisting = () => context.supabase.from(draft.kind).select(projection).eq('id', draft.clientId).maybeSingle();
      const reply = (row: Record<string, unknown>, duplicate: boolean) => {
        if (Object.entries(payload).some(([key, value]) => row[key] !== value)) {
          return mobileJson({ error: 'This draft identity already exists with different content. Review the existing record; your current input was kept and no record was overwritten.' }, 409);
        }
        if (typeof row.number !== 'string' || !row.number.startsWith(draft.kind === 'rfis' ? 'RFI-' : 'SUB-')) return mobileJson({ error: 'The server record number could not be verified. Keep this draft and retry.' }, 503);
        return mobileJson({ id: row.id, number: row.number, projectId: draft.projectId, kind: draft.kind, duplicate }, duplicate ? 200 : 201);
      };
      const existing = await readExisting();
      if (existing.error) return mobileJson({ error: 'Could not verify whether this draft was already created. Retry with this draft.' }, 503);
      if (existing.data) return reply(existing.data as unknown as Record<string, unknown>, true);

      if (draft.kind === 'rfis') {
        const assignee = await context.supabase.from('project_members').select('profile_id,project_id')
          .eq('profile_id', draft.assignedTo).eq('project_id', draft.projectId).maybeSingle();
        if (assignee.error) return mobileJson({ error: 'Could not verify the assignee. Your draft was kept.' }, 503);
        if (assignee.data?.project_id !== draft.projectId || assignee.data?.profile_id !== draft.assignedTo) return mobileJson({ error: 'Select a current member of this project as the assignee.' }, 400);
      }
      if (draft.milestoneId) {
        const milestone = await context.supabase.from('milestones').select('id,project_id').eq('id', draft.milestoneId).eq('project_id', draft.projectId).maybeSingle();
        if (milestone.error) return mobileJson({ error: 'Could not verify the milestone. Your draft was kept.' }, 503);
        if (milestone.data?.id !== draft.milestoneId || milestone.data?.project_id !== draft.projectId) return mobileJson({ error: 'Select a milestone belonging to this project.' }, 400);
      }
      // Existing BEFORE INSERT triggers assign the human-readable number atomically.
      // The persisted client UUID is also the insert identity: never upsert/update
      // on retry, and never fall back to a new ID after an ambiguous response.
      const result = await context.supabase.from(draft.kind).insert({ ...payload, status: draft.kind === 'rfis' ? 'open' : 'submitted' }).select(projection).single();
      if (result.error?.code === '23505') {
        const winner = await readExisting();
        return winner.data ? reply(winner.data as unknown as Record<string, unknown>, true)
          : mobileJson({ error: 'Creation conflicted. Keep this draft and retry; no new identity was assigned.' }, 409);
      }
      if (result.error || !result.data) return mobileJson({ error: result.error?.code === '42501'
        ? 'Creation permission is no longer available. Your draft was kept.' : 'Could not confirm creation. Keep this draft and retry with the same identity.' }, result.error?.code === '42501' ? 403 : 503);
      return reply(result.data as unknown as Record<string, unknown>, false);
    } catch { return mobileJson({ error: 'Could not confirm creation. Keep this draft and retry with the same identity.' }, 503); }
  };
}
