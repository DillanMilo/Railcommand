import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createClient, type User } from '@supabase/supabase-js';
import { MOBILE_SPEC_SECTIONS, type MobileRecordDraft } from '@railcommand/domain';
import { createRecordCreateHandler, createRecordOptionsHandler, parseRecordDraft } from './record-create';

const userId = '10000000-0000-4000-8000-000000000001';
const assignedTo = '10000000-0000-4000-8000-000000000002';
const projectId = '20000000-0000-4000-8000-000000000001';
const clientId = '30000000-0000-4000-8000-000000000001';
const milestoneId = '40000000-0000-4000-8000-000000000001';
const draft: MobileRecordDraft = { version: 1, kind: 'rfis', projectId, clientId, title: 'Synthetic question', body: 'Clarify fixture', priority: 'medium', assignedTo, dueDate: '2026-09-01', milestoneId, specSection: '', updatedAt: '' };
const request = (value: unknown = draft, key = clientId) => new Request('https://api.example/api/mobile/v1/records/create', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(value) });
const optionsRequest = (kind = 'rfis') => new Request(`https://api.example/api/mobile/v1/records/options?kind=${kind}&projectId=${projectId}`);

function harness(options: { authenticated?: boolean; member?: boolean; canEdit?: boolean; role?: string; admin?: boolean; assignee?: boolean; milestone?: boolean; existing?: Record<string, unknown>; race?: boolean; lostResponse?: boolean; insertCode?: string; badChoices?: boolean; manyChoices?: boolean } = {}) {
  const requests: Request[] = [];
  let stored = options.existing;
  const writes: Record<string, unknown>[] = [];
  const supabase = createClient('https://staging.example', 'public-fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: 'Bearer synthetic-user' }, fetch: async (input, init) => {
      const req = new Request(input, init); requests.push(req);
      assert.equal(req.headers.get('authorization'), 'Bearer synthetic-user');
      const url = new URL(req.url); const table = url.pathname.split('/').at(-1)!;
      if (table === 'profiles') { assert.equal(url.searchParams.get('id'), `eq.${userId}`); return Response.json({ role: options.admin ? 'admin' : 'viewer' }); }
      if (table === 'project_members') {
        assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
        if (url.searchParams.get('profile_id') === `eq.${userId}`) return Response.json(options.member === false ? null : { project_role: options.role ?? 'manager', can_edit: options.canEdit !== false });
        if (url.searchParams.get('profile_id') === `eq.${assignedTo}`) return Response.json(options.assignee === false ? null : { project_id: projectId, profile_id: assignedTo });
        assert.equal(url.searchParams.get('limit'), '501');
        const member = { project_id: options.badChoices ? 'other' : projectId, profile_id: assignedTo, profile: { id: assignedTo, full_name: 'Synthetic Member', email: 'private-not-returned' } };
        return Response.json(options.manyChoices ? Array(501).fill(member) : [member]);
      }
      if (table === 'milestones') {
        assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
        const milestone = { id: milestoneId, project_id: projectId, name: 'Synthetic milestone' };
        if (url.searchParams.has('id')) { assert.equal(url.searchParams.get('id'), `eq.${milestoneId}`); return Response.json(options.milestone === false ? null : milestone); }
        assert.equal(url.searchParams.get('limit'), '501'); return Response.json([milestone]);
      }
      assert.ok(table === 'rfis' || table === 'submittals');
      if (req.method === 'GET') { assert.equal(url.searchParams.get('id'), `eq.${clientId}`); return Response.json(stored ?? null); }
      assert.equal(req.method, 'POST');
      const payload = await req.json(); writes.push(payload);
      assert.equal(payload.id, clientId); assert.equal(payload.project_id, projectId); assert.equal(payload.submitted_by, userId);
      assert.equal('number' in payload, false); assert.equal('updatedAt' in payload, false);
      assert.notEqual(url.searchParams.get('on_conflict'), 'id');
      if (options.insertCode) return Response.json({ code: options.insertCode, message: 'private database failure' }, { status: 403 });
      stored = { ...payload, number: table === 'rfis' ? 'RFI-007' : 'SUB-009' };
      if (options.race) return Response.json({ code: '23505', message: 'fixture uniqueness race' }, { status: 409 });
      if (options.lostResponse) return Response.json({ message: 'fixture response lost after commit' }, { status: 503 });
      return Response.json(stored);
    } },
  });
  const authenticate = async () => options.authenticated === false ? null : { supabase, user: { id: userId } as User, accessToken: 'synthetic-user' };
  return { create: createRecordCreateHandler(authenticate), options: createRecordOptionsHandler(authenticate), requests, writes, stored: () => stored };
}

describe('Mobile record creation API (synthetic transport)', () => {
  it('sanitizes client metadata and rejects malformed input before querying', async () => {
    const parsed = parseRecordDraft({ ...draft, number: 'RFI-999', submitted_by: assignedTo, status: 'closed', createdId: clientId });
    assert.ok(parsed); assert.equal('number' in parsed, false); assert.equal('createdId' in parsed, false);
    for (const body of [null, {}, { ...draft, title: [] }, { ...draft, dueDate: '2026-02-30' }]) {
      const h = harness(); assert.equal((await h.create(request(body))).status, 400); assert.equal(h.requests.length, 0);
    }
    const h = harness(); assert.equal((await h.create(request(draft, 'wrong-key'))).status, 400);
    assert.equal((await h.create(request({ ...draft, body: 'x'.repeat(256 * 1024) }))).status, 413);
    assert.equal(h.requests.length, 0);
  });
  it('requires authentication, current role and edit permission for both endpoints', async () => {
    for (const endpoint of ['create', 'options'] as const) {
      const req = endpoint === 'create' ? request() : optionsRequest();
      const unauth = harness({ authenticated: false }); assert.equal((await unauth[endpoint](req.clone())).status, 401); assert.equal(unauth.requests.length, 0);
      for (const option of [{ member: false }, { canEdit: false }, { role: 'unknown' }]) {
        const h = harness(option); assert.equal((await h[endpoint](req.clone())).status, 403); assert.equal(h.writes.length, 0);
      }
    }
    const h = harness({ role: 'foreman' });
    assert.equal((await h.create(request({ ...draft, kind: 'submittals', specSection: MOBILE_SPEC_SECTIONS[0] }))).status, 403);
  });
  it('inserts only caller-owned allowed fields and leaves numbering to the database', async () => {
    const h = harness(); const res = await h.create(request({ ...draft, submitted_by: assignedTo, number: 'RFI-999', status: 'closed' }));
    assert.equal(res.status, 201); assert.match(res.headers.get('cache-control')!, /no-store/);
    assert.deepEqual(await res.json(), { id: clientId, number: 'RFI-007', kind: 'rfis', projectId, duplicate: false });
    assert.equal(h.writes[0].status, 'open'); assert.equal(h.writes[0].subject, draft.title);
    assert.equal(h.writes[0].assigned_to, assignedTo);
  });
  it('maps native submittal fields without RFI-only columns', async () => {
    const h = harness(); const res = await h.create(request({ ...draft, kind: 'submittals', specSection: MOBILE_SPEC_SECTIONS[0] }));
    assert.equal(res.status, 201); assert.equal(h.writes[0].title, draft.title); assert.equal(h.writes[0].status, 'submitted');
    assert.equal(h.writes[0].spec_section, MOBILE_SPEC_SECTIONS[0]); assert.equal('assigned_to' in h.writes[0], false);
  });
  it('rejects invalid project references without an insert', async () => {
    for (const option of [{ assignee: false }, { milestone: false }]) {
      const h = harness(option); assert.equal((await h.create(request())).status, 400); assert.equal(h.writes.length, 0);
    }
  });
  it('replays an existing identical record without inserting and conflicts on changed content', async () => {
    const h = harness(); await h.create(request());
    assert.equal((await h.create(request())).status, 200); assert.equal(h.writes.length, 1);
    assert.equal((await h.create(request({ ...draft, body: 'changed after uncertainty' }))).status, 409); assert.equal(h.writes.length, 1);
    assert.equal(h.stored()?.question, draft.body);
  });
  it('recovers a uniqueness race or a lost response using the original identity', async () => {
    const race = harness({ race: true }); const res = await race.create(request());
    assert.equal(res.status, 200); assert.equal((await res.json()).duplicate, true); assert.equal(race.writes.length, 1);
    const lost = harness({ lostResponse: true }); assert.equal((await lost.create(request())).status, 503);
    assert.equal((await lost.create(request())).status, 200); assert.equal(lost.writes.length, 1);
  });
  it('reports RLS denial or database failure without leaking error details', async () => {
    for (const [insertCode, status] of [['42501', 403], ['XX000', 503]] as const) {
      const res = await harness({ insertCode }).create(request()); assert.equal(res.status, status); assert.doesNotMatch(await res.text(), /private database failure/);
    }
  });
  it('returns bounded project choices without emails and rejects mismatched references', async () => {
    const res = await harness().options(optionsRequest()); assert.equal(res.status, 200);
    const choices = await res.json(); assert.deepEqual(choices.assignees, [{ id: assignedTo, name: 'Synthetic Member' }]);
    assert.doesNotMatch(JSON.stringify(choices), /private-not-returned|email/);
    assert.equal((await harness({ badChoices: true }).options(optionsRequest())).status, 403);
    assert.equal((await harness({ manyChoices: true }).options(optionsRequest())).status, 413);
  });
});
