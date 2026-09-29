import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createClient, type User } from '@supabase/supabase-js';
import { attachmentStoragePath, createRecordAttachmentHandler, createRecordDetailHandler, parseRecordScope } from './record-detail';

const projectId = '20000000-0000-4000-8000-000000000001';
const recordId = '30000000-0000-4000-8000-000000000001';
const attachmentId = '40000000-0000-4000-8000-000000000001';
const userId = '10000000-0000-4000-8000-000000000001';
const scope = { projectId, recordId, kind: 'rfis' as const };
const storagePath = `${projectId}/rfi/${recordId}/123-photo.jpg`;
const fileUrl = `https://staging.example/storage/v1/object/public/project-photos/${storagePath}`;
const row = { id: recordId, project_id: projectId, number: 'RFI-001', subject: 'Synthetic question', title: 'Synthetic submittal',
  question: 'Is this aligned?', description: 'Sample', status: 'open', priority: 'medium', due_date: '2026-09-01',
  submit_date: '2026-08-29', created_at: '2026-08-29T00:00:00Z', milestone_id: null,
  submitted_by_profile: { id: userId, full_name: 'Synthetic Reviewer', email: 'not-returned@example.com' }, secret_metadata: 'do-not-return' };
const attachment = { id: attachmentId, entity_id: recordId, entity_type: 'rfi', project_id: projectId,
  file_name: 'photo.jpg', file_type: 'image/jpeg', file_size: 100, photo_category: 'standard', file_url: fileUrl };
const response = { id: 'response-a', rfi_id: recordId, author: { id: userId, full_name: 'Synthetic Reviewer' }, content: 'Approved answer', is_official_response: true, created_at: '2026-08-29T10:00:00Z' };
const request = (suffix = 'detail', overrides: Record<string, string> = {}) => new Request(`https://api.example/api/mobile/v1/records/${suffix}?${new URLSearchParams({ ...scope, attachmentId, ...overrides })}`);

function harness(options: { authenticated?: boolean; member?: boolean; admin?: boolean; row?: object | null; attachments?: object[]; responses?: object[]; queryError?: string; signedError?: boolean } = {}) {
  const requests: Request[] = [];
  let queriedKind = 'rfis';
  const supabase = createClient('https://staging.example', 'public-fixture-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: 'Bearer synthetic-user' }, fetch: async (input, init) => {
      const req = new Request(input, init); requests.push(req);
      assert.equal(req.headers.get('authorization'), 'Bearer synthetic-user');
      const url = new URL(req.url); const table = url.pathname.split('/').at(-1)!;
      if (url.pathname.startsWith('/storage/')) {
        assert.equal(req.method, 'POST');
        assert.equal(url.pathname, `/storage/v1/object/sign/project-photos/${storagePath}`);
        assert.deepEqual(await req.clone().json(), { expiresIn: 60 });
        return options.signedError ? Response.json({ message: 'storage error detail' }, { status: 403 })
          : Response.json({ signedURL: `/object/sign/project-photos/${storagePath}?token=synthetic-token` });
      }
      assert.equal(req.method, 'GET');
      if (options.queryError === table) return Response.json({ message: 'private SQL error' }, { status: 500 });
      if (table === 'project_members') {
        assert.equal(url.searchParams.get('profile_id'), `eq.${userId}`);
        assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
        return Response.json(options.member === false ? null : { project_role: 'viewer' });
      }
      if (table === 'profiles') return Response.json({ role: options.admin ? 'admin' : 'viewer' });
      if (table === 'rfi_responses') {
        assert.equal(url.searchParams.get('rfi_id'), `eq.${recordId}`);
        assert.equal(url.searchParams.get('limit'), '201');
        return Response.json(options.responses ?? [response]);
      }
      assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
      if (table === 'attachments') {
        assert.equal(url.searchParams.get('entity_id'), `eq.${recordId}`);
        assert.equal(url.searchParams.get('entity_type'), queriedKind === 'rfis' ? 'eq.rfi' : 'eq.submittal');
        if (url.searchParams.has('id')) {
          assert.equal(url.searchParams.get('id'), `eq.${attachmentId}`);
          return Response.json(options.attachments?.[0] ?? attachment);
        }
        assert.equal(url.searchParams.get('limit'), '201');
        assert.doesNotMatch(url.searchParams.get('select')!, /file_url/);
        return Response.json(options.attachments ?? [attachment]);
      }
      assert.equal(url.searchParams.get('id'), `eq.${recordId}`);
      queriedKind = table;
      const selected = options.row === undefined ? { ...row, status: table === 'submittals' ? 'submitted' : 'open' } : options.row;
      return Response.json(selected);
    } },
  });
  const authenticate = async () => options.authenticated === false ? null : { supabase, user: { id: userId } as User, accessToken: 'synthetic-user' };
  return { detail: createRecordDetailHandler(authenticate), attachment: createRecordAttachmentHandler(authenticate, () => 'https://staging.example'), requests };
}

describe('Mobile record detail authorization and attachments', () => {
  it('validates record kinds, UUIDs, and rejects injected paths', () => {
    assert.deepEqual(parseRecordScope(new URLSearchParams(scope)), scope);
    for (const invalid of [{ kind: 'profiles' }, { projectId: '../other' }, { recordId: 'https://other.example' }]) {
      assert.equal(parseRecordScope(new URLSearchParams({ ...scope, ...invalid })), null);
    }
  });
  it('does not query without authentication and rejects revoked membership before record access', async () => {
    for (const endpoint of ['detail', 'attachment'] as const) {
      const unauth = harness({ authenticated: false });
      assert.equal((await unauth[endpoint](request(endpoint))).status, 401); assert.equal(unauth.requests.length, 0);
      const revoked = harness({ member: false });
      assert.equal((await revoked[endpoint](request(endpoint))).status, 403);
      assert.equal(revoked.requests.some((req) => /\/rfis|\/attachments|\/storage\//.test(req.url)), false);
    }
  });
  it('returns scoped text, metadata, official responses, and no private transport fields', async () => {
    const h = harness(); const res = await h.detail(request());
    assert.equal(res.status, 200); assert.match(res.headers.get('cache-control')!, /no-store/);
    assert.match(res.headers.get('vary')!, /Authorization/);
    const detail = await res.json();
    assert.equal(detail.kind, 'rfis'); assert.equal(detail.record.question, row.question);
    assert.equal(detail.record.responses[0].official, true);
    assert.deepEqual(detail.record.submittedBy, { id: userId, name: 'Synthetic Reviewer' });
    assert.deepEqual(detail.attachments[0], { id: attachmentId, fileName: 'photo.jpg', fileType: 'image/jpeg', size: 100, category: 'standard' });
    assert.doesNotMatch(JSON.stringify(detail), /not-returned|do-not-return|file_url|signedURL|synthetic-token/);
  });
  it('returns submittal description and reviews without querying RFI responses', async () => {
    const h = harness({ attachments: [] });
    const res = await h.detail(request('detail', { kind: 'submittals' }));
    assert.equal(res.status, 200);
    const detail = await res.json();
    assert.equal(detail.record.description, row.description);
    assert.equal(detail.record.status, 'submitted');
    assert.equal(detail.record.reviewNotes, null);
    assert.equal(h.requests.some((req) => req.url.includes('/rfi_responses')), false);
  });
  it('rejects missing and cross-project parents, attachments, and responses', async () => {
    for (const options of [{ row: null }, { row: { ...row, project_id: 'other' } }]) {
      for (const endpoint of ['detail', 'attachment'] as const) assert.equal((await harness(options)[endpoint](request(endpoint))).status, 404);
    }
    assert.equal((await harness({ attachments: [{ ...attachment, project_id: 'other' }] }).detail(request())).status, 403);
    assert.equal((await harness({ responses: [{ ...response, rfi_id: 'other' }] }).detail(request())).status, 403);
  });
  it('preserves the existing web admin read exception while using the caller token', async () => {
    assert.equal((await harness({ member: false, admin: true }).detail(request())).status, 200);
  });
  it('reports reference failures and oversized records without silently returning partial data', async () => {
    for (const queryError of ['rfis', 'attachments', 'rfi_responses']) {
      const res = await harness({ queryError }).detail(request());
      assert.equal(res.status, 503); assert.doesNotMatch(await res.text(), /private SQL error/);
    }
    assert.equal((await harness({ responses: Array(201).fill(response) }).detail(request())).status, 413);
    assert.equal((await harness({ row: { ...row, question: 'x'.repeat(2 * 1024 * 1024) } }).detail(request())).status, 413);
  });
  it('signs an exact parent-owned attachment for only 60 seconds with caller Storage RLS', async () => {
    const h = harness(); const res = await h.attachment(request('attachment'));
    assert.equal(res.status, 200); assert.match(res.headers.get('cache-control')!, /no-store/);
    const body = await res.json(); assert.equal(body.attachmentId, attachmentId);
    assert.equal(new URL(body.url).origin, 'https://staging.example');
    assert.ok(Date.parse(body.expiresAt) <= Date.now() + 60_000);
    assert.equal(h.requests.filter((req) => req.method === 'POST').length, 1);
  });
  it('refuses foreign and malformed attachment paths without making a storage request', async () => {
    for (const invalid of [fileUrl.replace('staging.example', 'foreign.example'), fileUrl.replace(projectId, userId), fileUrl.replace('/rfi/', '/daily_log/'),
      fileUrl + '?token=secret', fileUrl.replace('123-photo.jpg', '%2e%2e%2Fsecret'), fileUrl.replace('https:', 'http:')]) {
      assert.equal(attachmentStoragePath(invalid, 'standard', scope, 'https://staging.example'), null);
      const h = harness({ attachments: [{ ...attachment, file_url: invalid }] });
      assert.equal((await h.attachment(request('attachment'))).status, 409);
      assert.equal(h.requests.some((req) => req.method === 'POST'), false);
    }
    assert.equal(attachmentStoragePath(fileUrl, 'unknown', scope, 'https://staging.example'), null);
    assert.deepEqual(attachmentStoragePath(fileUrl, 'standard', scope, 'https://staging.example'), { bucket: 'project-photos', path: storagePath });
  });
});
