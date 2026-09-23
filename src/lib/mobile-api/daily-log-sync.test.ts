import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import { MobileApiClient } from '@railcommand/api-client';
import { createMobileDraft, draftToSyncOperation, isValidSyncOperation } from '@railcommand/domain';
import { mobileJson, mobileOptions } from './auth';
import { canCreateMobileDailyLog } from './authorization';
import { mobileQueryFailed, mobileQueryFailureStatus } from './query-failure';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-00000000000b';
const clientId = '30000000-0000-4000-8000-00000000000a';
const operation = draftToSyncOperation(userId, createMobileDraft(projectId, {
  logDate: '2026-08-30', workSummary: 'Synthetic field work', weatherConditions: 'Clear', safetyNotes: 'Synthetic only',
}, null, new Date('2026-08-30T12:00:00Z'), () => clientId));

type Query = 'profiles' | 'project_members' | 'sync_daily_log_create';
type Fault = { query: Query; status: number; code?: string; message?: string; nullBody?: boolean; token?: string };
function harness(options: { faults?: Fault[]; authenticated?: boolean; member?: boolean; canEdit?: boolean; receipt?: unknown } = {}) {
  const requests: Array<{ query: string; token: string; body: unknown }> = [];
  const makeClient = (token: string) => createClient('https://staging.example', 'public-fixture', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` }, fetch: async (input, init) => {
      const request = new Request(input, init); const url = new URL(request.url);
      assert.equal(url.origin, 'https://staging.example');
      assert.equal(request.headers.get('authorization'), `Bearer ${token}`);
      const query = url.pathname.split('/').at(-1)!;
      const body = request.method === 'POST' ? await request.json() : undefined;
      requests.push({ query, token, body });
      if (query === 'profiles') assert.equal(url.searchParams.get('id'), `eq.${userId}`);
      if (query === 'project_members') {
        assert.equal(url.searchParams.get('profile_id'), `eq.${userId}`);
        assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
      }
      if (query === 'sync_daily_log_create') {
        assert.equal(request.method, 'POST');
        assert.deepEqual(body, { p_project_id: projectId, p_client_id: clientId,
          p_idempotency_key: operation.idempotencyKey, p_payload: operation.payload });
      }
      const fault = options.faults?.find((item) => item.query === query && (!item.token || item.token === token));
      if (fault) {
        if (fault.status === 0) throw new DOMException('private database transport error', 'AbortError');
        return Response.json(fault.nullBody ? null : { code: fault.code, message: fault.message ?? 'private SQL, token, and row details',
          details: 'private row', hint: 'private hint' }, { status: fault.status });
      }
      if (query === 'profiles') return Response.json({ role: 'member' });
      if (query === 'project_members') return Response.json(options.member === false ? null : { project_role: 'manager', can_edit: options.canEdit !== false });
      assert.equal(query, 'sync_daily_log_create');
      return Response.json('receipt' in options ? options.receipt : { id: clientId, project_id: projectId, duplicate: false, private: 'not returned' });
    } },
  });
  const compiled = { exports: {} as { POST?: (request: Request) => Promise<Response> } };
  const { outputText } = ts.transpileModule(readFileSync(new URL('../../app/api/mobile/v1/daily-logs/sync/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mocks: Record<string, unknown> = {
    '@railcommand/domain': { isValidSyncOperation },
    '@/lib/mobile-api/auth': { mobileJson, mobileOptions, authenticateMobileRequest: async (request: Request) => options.authenticated === false ? null : {
      supabase: makeClient(request.headers.get('authorization')!.slice('Bearer '.length)), user: { id: userId },
    } },
    '@/lib/mobile-api/authorization': { canCreateMobileDailyLog },
    '@/lib/mobile-api/query-failure': { mobileQueryFailed, mobileQueryFailureStatus },
  };
  runInNewContext(outputText, { module: compiled, exports: compiled.exports,
    require(name: string) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected dependency ${name}`); } });
  const handle = (request: Request) => compiled.exports.POST!(request);
  return { requests, handle, send: (body: unknown = operation) => handle(new Request('https://api.example/api/mobile/v1/daily-logs/sync', {
    method: 'POST', headers: { Authorization: 'Bearer synthetic', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })) };
}

async function safeFailure(response: Response, status: number, retryable?: boolean) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  const body = await response.json();
  assert.equal(typeof body.error, 'string');
  assert.doesNotMatch(JSON.stringify(body), /private|token|SQL|p_payload|Synthetic field work/);
  if (retryable !== undefined) assert.equal(body.retryable, retryable);
  assert.ok(Object.keys(body).every((key) => ['error', 'retryable'].includes(key)));
}

describe('daily-log queued-write authentication and receipt boundary', () => {
  for (const query of ['profiles', 'project_members', 'sync_daily_log_create'] as const) {
    for (const fault of [{ status: 401, code: 'PGRST303' }, { status: 401, nullBody: true }, { status: 500, code: 'PGRST301' }]) {
      it(`preserves authentication failure for ${query} ${fault.status}/${'code' in fault ? fault.code : 'null'}`, async () => {
        const h = harness({ faults: [{ query, ...fault }] });
        await safeFailure(await h.send(), 401, false);
        if (query !== 'sync_daily_log_create') assert.equal(h.requests.some((request) => request.query === 'sync_daily_log_create'), false);
      });
    }
    it(`keeps a real ${query} permission failure denied`, async () => {
      const h = harness({ faults: [{ query, status: 403, code: '42501' }] });
      await safeFailure(await h.send(), 403, false);
    });
    for (const status of [0, 500]) {
      it(`keeps ${query} ${status} failures retryable without leaking database details`, async () => {
        const h = harness({ faults: [{ query, status, code: '57014' }] });
        await safeFailure(await h.send(), 503, true);
        if (query !== 'sync_daily_log_create') assert.equal(h.requests.some((request) => request.query === 'sync_daily_log_create'), false);
      });
    }
  }

  it('rejects unauthenticated, wrong-owner, nonmember, and read-only writes before any RPC', async () => {
    const unauthenticated = harness({ authenticated: false }); await safeFailure(await unauthenticated.send(), 401);
    assert.equal(unauthenticated.requests.length, 0);
    const wrongOwner = harness(); await safeFailure(await wrongOwner.send({ ...operation, userId: projectId }), 400);
    assert.equal(wrongOwner.requests.length, 0);
    for (const options of [{ member: false }, { canEdit: false }, { faults: [{ query: 'profiles' as const, status: 406, code: 'PGRST116' }] }]) {
      const h = harness(options); await safeFailure(await h.send(), 403);
      assert.equal(h.requests.some((request) => request.query === 'sync_daily_log_create'), false);
    }
  });

  it('does not label parallel transient authentication failure as a missing-profile denial', async () => {
    const h = harness({ faults: [{ query: 'profiles', status: 406, code: 'PGRST116' }, { query: 'project_members', status: 401, code: 'PGRST303' }] });
    await safeFailure(await h.send(), 401, false);
    assert.equal(h.requests.some((request) => request.query === 'sync_daily_log_create'), false);
  });

  for (const code of ['22003']) {
    it(`keeps ${code} validation/integrity failure permanent but sanitized`, async () => {
      await safeFailure(await harness({ faults: [{ query: 'sync_daily_log_create', status: 400, code }] }).send(), 400, false);
    });
  }

  it('reports an existing project/date as a conflict without leaking SQL or acknowledging the queued record', async () => {
    const h = harness({ faults: [{ query: 'sync_daily_log_create', status: 400, code: '23505', message: 'duplicate key violates unique constraint "daily_logs_project_id_log_date_key"' }] });
    const response = await h.send();
    const copy = response.clone();
    await safeFailure(response, 409, false);
    assert.match((await copy.json()).error, /already exists for this project and date/);
    assert.equal(h.requests.filter(r => r.query === 'sync_daily_log_create').length, 1);
  });

  it('keeps other unique conflicts distinct from a successful retry', async () => {
    await safeFailure(await harness({ faults: [{ query: 'sync_daily_log_create', status: 400, code: '23505' }] }).send(), 409, false);
  });

  it('only acknowledges the exact queued identity and an explicit duplicate receipt', async () => {
    for (const receipt of [null, {}, { id: projectId, project_id: projectId, duplicate: false },
      { id: clientId, project_id: userId, duplicate: false }, { id: clientId, project_id: projectId }]) {
      await safeFailure(await harness({ receipt }).send(), 503, true);
    }
    for (const duplicate of [false, true]) {
      const response = await harness({ receipt: { id: clientId, project_id: projectId, duplicate, private: 'omitted' } }).send();
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { id: clientId, projectId, duplicate });
    }
  });

  it('compares UUID receipts case-insensitively without accepting a different identity', async () => {
    const receipt = { id: clientId.toUpperCase(), project_id: projectId.toUpperCase(), duplicate: true };
    const response = await harness({ receipt }).send();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: receipt.id, projectId: receipt.project_id, duplicate: true });
  });

  for (const query of ['project_members', 'sync_daily_log_create'] as const) {
    it(`uses the existing single refresh after ${query} 401 without changing payload or identity`, async () => {
      const h = harness({ faults: [{ query, status: 401, code: 'PGRST303', token: 'expired' }] });
      let refreshes = 0;
      const client = new MobileApiClient({ baseUrl: 'https://api.example', getAccessToken: async () => 'expired',
        refreshAccessToken: async () => { refreshes++; return 'refreshed'; },
        fetch: (input, init) => h.handle(new Request(input, init)),
      });
      assert.deepEqual(await client.syncDailyLog(operation), { id: clientId, projectId, duplicate: false });
      assert.equal(refreshes, 1);
      const writes = h.requests.filter((request) => request.query === 'sync_daily_log_create');
      assert.equal(writes.length, query === 'sync_daily_log_create' ? 2 : 1);
      if (writes.length === 2) assert.deepEqual(writes[0].body, writes[1].body);
    });
  }
});
