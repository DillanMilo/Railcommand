import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createClient, type User } from '@supabase/supabase-js';
import { createPdfReportHandler, parsePdfReportRequest, type PdfReportData } from './report-export';

const projectId = '20000000-0000-4000-8000-000000000001';
const recordA = '30000000-0000-4000-8000-000000000001';
const recordB = '30000000-0000-4000-8000-000000000002';
const userId = '10000000-0000-4000-8000-000000000001';
const selection = { projectId, kind: 'rfis' as const, recordIds: [recordB, recordA] };
const request = (body: unknown = selection) => new Request('https://staging.example/api/mobile/v1/reports/pdf', { method: 'POST', body: JSON.stringify(body) });

function harness(options: { authenticated?: boolean; member?: boolean; admin?: boolean; rows?: object[]; queryError?: boolean; renderBytes?: number } = {}) {
  const queries: URL[] = [];
  const rendered: PdfReportData[] = [];
  // Exercise the real Supabase query builder against a synthetic HTTP transport.
  // This verifies caller credentials, filters, and error handling, not live RLS.
  const supabase = createClient('https://staging.example', 'public-test-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: 'Bearer test-user-token' }, fetch: async (input, init) => {
      const req = new Request(input, init);
      assert.equal(req.headers.get('authorization'), 'Bearer test-user-token');
      assert.equal(req.method, 'GET');
      const url = new URL(req.url);
      queries.push(url);
      if (url.pathname.endsWith('/project_members')) {
        assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
        assert.equal(url.searchParams.get('profile_id'), `eq.${userId}`);
        return options.member === false ? Response.json({ message: 'not found' }, { status: 406 }) : Response.json({ project_role: 'viewer' });
      }
      if (url.pathname.endsWith('/profiles')) return Response.json({ full_name: 'Synthetic Reviewer', role: options.admin ? 'admin' : 'viewer' });
      if (url.pathname.endsWith('/projects')) return Response.json({ name: 'Synthetic Project' });
      assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
      assert.equal(url.searchParams.get('id'), `in.(${recordB},${recordA})`);
      return options.queryError ? Response.json({ message: 'internal query detail' }, { status: 500 })
        : Response.json(options.rows ?? [{ id: recordA, project_id: projectId }, { id: recordB, project_id: projectId }]);
    } },
  });
  const handler = createPdfReportHandler({
    authenticate: async () => options.authenticated === false ? null : { supabase, user: { id: userId } as User, accessToken: 'test-user-token' },
    render: async (data) => { rendered.push(data); return options.renderBytes ? Buffer.alloc(options.renderBytes) : Buffer.from('%PDF-1.7\nsynthetic fixture'); },
  });
  return { handler, rendered, queries };
}

describe('Mobile filtered PDF export', () => {
  it('validates a bounded selection and rejects duplicate IDs, unknown report kinds, and path-like input', () => {
    assert.deepEqual(parsePdfReportRequest(selection), selection);
    assert.equal(parsePdfReportRequest({ ...selection, recordIds: [recordA, recordA] }), null);
    assert.equal(parsePdfReportRequest({ ...selection, kind: 'profiles' }), null);
    assert.equal(parsePdfReportRequest({ ...selection, projectId: '../other' }), null);
    assert.equal(parsePdfReportRequest({ ...selection, recordIds: Array(501).fill(recordA) }), null);
    assert.equal(parsePdfReportRequest({ ...selection, recordIds: ['https://other.example'] }), null);
  });

  it('returns 401 without querying or rendering when authentication fails', async () => {
    const h = harness({ authenticated: false });
    assert.equal((await h.handler(request())).status, 401);
    assert.deepEqual(h.queries, []);
    assert.deepEqual(h.rendered, []);
  });

  it('returns 403 before querying project records after membership revocation', async () => {
    const h = harness({ member: false });
    assert.equal((await h.handler(request())).status, 403);
    assert.equal(h.queries.some((url) => url.pathname.endsWith('/rfis')), false);
    assert.deepEqual(h.rendered, []);
  });

  for (const kind of ['rfis', 'submittals'] as const) {
    it(`exports only the requested ${kind} in visible order, with server identity and private headers`, async () => {
      const h = harness();
      const response = await h.handler(request({ ...selection, kind, projectName: 'spoofed', generatedBy: 'spoofed' }));
      assert.equal(response.status, 200);
      assert.match(response.headers.get('cache-control')!, /no-store/);
      assert.match(response.headers.get('vary')!, /Authorization/);
      assert.equal(h.rendered[0].kind, kind);
      assert.equal(h.rendered[0].projectName, 'Synthetic Project');
      assert.equal(h.rendered[0].generatedBy, 'Synthetic Reviewer');
      assert.deepEqual(h.rendered[0].records.map((row) => row.id), [recordB, recordA]);
      const body = await response.json();
      assert.equal(body.recordCount, 2);
      assert.equal(body.fileName, `${kind}-report-${projectId}.pdf`);
      assert.match(Buffer.from(body.base64, 'base64').toString(), /^%PDF-/);
    });
  }

  it('does not export partial or cross-project results', async () => {
    for (const rows of [[{ id: recordA, project_id: projectId }], [{ id: recordA, project_id: 'other' }, { id: recordB, project_id: projectId }]]) {
      const h = harness({ rows });
      assert.equal((await h.handler(request())).status, 409);
      assert.deepEqual(h.rendered, []);
    }
  });

  it('allows an empty filtered report without turning it into an unfiltered query', async () => {
    const h = harness();
    const response = await h.handler(request({ ...selection, recordIds: [] }));
    assert.equal(response.status, 200);
    assert.deepEqual(h.rendered[0].records, []);
    assert.equal(h.queries.some((url) => url.pathname.endsWith('/rfis')), false);
  });

  it('retains the web admin read exception without using an admin database key', async () => {
    const h = harness({ member: false, admin: true });
    assert.equal((await h.handler(request())).status, 200);
  });

  it('returns a recoverable query error without SQL details and rejects oversized PDFs', async () => {
    const unavailable = await harness({ queryError: true }).handler(request());
    assert.equal(unavailable.status, 503);
    assert.doesNotMatch(await unavailable.text(), /internal query detail/);
    assert.equal((await harness({ renderBytes: 2 * 1024 * 1024 + 1 }).handler(request())).status, 413);
  });
});
