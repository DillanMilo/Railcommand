import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import { createClient } from '@supabase/supabase-js';
import { isValidPhotoSyncOperation, type MobileDailyLogPhotoSyncOperation } from '@railcommand/domain';
import { MobileApiClient, MobileApiError } from '@railcommand/api-client';
import ts from 'typescript';
import { getBucket, sanitizeFilename } from '../attachments-shared';
import { canCreateMobileDailyLog } from './authorization';
import { mobileJson, mobileOptions } from './auth';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000001';
const parentId = '30000000-0000-4000-8000-000000000001';
const photoId = '40000000-0000-4000-8000-000000000001';
const operation: MobileDailyLogPhotoSyncOperation = {
  operationId: photoId, userId, projectId, parentEntityId: parentId,
  idempotencyKey: 'synthetic-photo-idempotency-key',
  payload: { fileName: 'Track photo #1.jpg', fileType: 'image/jpeg', fileSize: 128,
    photoCategory: 'standard', geoLat: 0, geoLng: -87.5, capturedAt: '2026-08-30T12:00:00.000Z' },
};
const storage = { bucket: 'project-photos', path: `${projectId}/daily_log/${parentId}/${photoId}-Track_photo__1.jpg` };
type Endpoint = 'prepare' | 'finalize';
type Query = 'profiles' | 'membership' | 'parent' | 'sign' | 'rpc';
type Fault = { query: Query; status: number; code?: string; body?: 'null' | 'text'; token?: string };
type Call = { query: Query; request: Request; payload?: unknown };
type Handler = (request: Request) => Promise<Response>;

function compile(path: string, mocks: Record<string, unknown>): Record<string, unknown> {
  const compiled = { exports: {} as Record<string, unknown> };
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(outputText, { module: compiled, exports: compiled.exports, URL, Response,
    require(name: string) {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected photo dependency ${name}`);
    },
  });
  return compiled.exports;
}

function harness(options: {
  faults?: Fault[]; authenticated?: boolean; member?: boolean; canEdit?: boolean; parent?: boolean;
  receipt?: unknown; signReceipt?: unknown;
} = {}) {
  const calls: Call[] = [];
  let finalized = false;
  const client = (authorization: string) => createClient('https://staging.example', 'public-fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authorization }, fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      assert.equal(url.origin, 'https://staging.example');
      assert.match(authorization, /^Bearer synthetic-(user|expired|refreshed)$/);
      assert.equal(request.headers.get('authorization'), authorization);
      const query: Query = url.pathname.endsWith('/profiles') ? 'profiles'
        : url.pathname.endsWith('/project_members') ? 'membership'
          : url.pathname.endsWith('/daily_logs') ? 'parent'
            : url.pathname.endsWith('/rpc/sync_daily_log_photo_attachment') ? 'rpc' : 'sign';
      const payload = request.method === 'POST' ? await request.clone().json() : undefined;
      calls.push({ query, request, payload });
      if (query === 'sign') {
        assert.equal(request.method, 'POST');
        assert.equal(url.pathname, `/storage/v1/object/upload/sign/${storage.bucket}/${storage.path}`);
        assert.equal(request.headers.get('x-upsert'), 'true');
      } else if (query === 'rpc') {
        assert.equal(request.method, 'POST');
        assert.deepEqual(payload, {
          p_attachment_id: photoId, p_project_id: projectId, p_daily_log_id: parentId,
          p_idempotency_key: operation.idempotencyKey, p_bucket: storage.bucket, p_storage_path: storage.path,
          p_file_name: operation.payload.fileName, p_file_type: operation.payload.fileType,
          p_file_size: operation.payload.fileSize, p_photo_category: operation.payload.photoCategory,
          p_geo_lat: operation.payload.geoLat, p_geo_lng: operation.payload.geoLng,
          p_captured_at: operation.payload.capturedAt,
        });
      } else {
        assert.equal(request.method, 'GET');
        if (query === 'profiles') assert.equal(url.searchParams.get('id'), `eq.${userId}`);
        else {
          assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
          if (query === 'membership') assert.equal(url.searchParams.get('profile_id'), `eq.${userId}`);
          else {
            assert.equal(url.searchParams.get('id'), `eq.${parentId}`);
            assert.equal(url.searchParams.get('created_by'), `eq.${userId}`);
          }
        }
      }
      const fault = options.faults?.find((item) => item.query === query && (!item.token || authorization === `Bearer ${item.token}`));
      if (fault) {
        if (fault.status === 0) throw new DOMException('private fixture transport failure', 'AbortError');
        if (fault.body === 'text') return new Response('private fixture upstream body', { status: fault.status });
        return Response.json(fault.body === 'null' ? null : {
          code: fault.code, message: 'private fixture upstream message', details: 'private fixture details', hint: 'private fixture hint',
        }, { status: fault.status });
      }
      if (query === 'profiles') return Response.json({ role: 'member' });
      if (query === 'membership') return Response.json(options.member === false ? null : { project_role: 'foreman', can_edit: options.canEdit !== false });
      if (query === 'parent') return Response.json(options.parent === false ? null : { id: parentId });
      if (query === 'sign') return Response.json('signReceipt' in options ? options.signReceipt : {
        url: `/object/upload/sign/${storage.bucket}/${storage.path}?token=synthetic-upload-token`,
      });
      if ('receipt' in options) return Response.json(options.receipt);
      const duplicate = finalized; finalized = true;
      return Response.json({ id: photoId, duplicate, private: 'must not reach the client' });
    } },
  });
  const queryFailure = compile('./query-failure.ts', {});
  const mocks: Record<string, unknown> = {
    '@railcommand/domain': { isValidPhotoSyncOperation },
    '@/lib/attachments-shared': { getBucket, sanitizeFilename },
    './authorization': { canCreateMobileDailyLog },
    './query-failure': queryFailure,
    '@/lib/mobile-api/query-failure': queryFailure,
    '@/lib/mobile-api/auth': { mobileJson, mobileOptions,
      authenticateMobileRequest: async (request: Request) => options.authenticated === false ? null : {
        supabase: client(request.headers.get('authorization')!), user: { id: userId },
      },
    },
  };
  mocks['@/lib/mobile-api/photo-sync'] = compile('./photo-sync.ts', mocks);
  const handlers = Object.fromEntries((['prepare', 'finalize'] as const).map((endpoint) => [endpoint,
    compile(`../../app/api/mobile/v1/daily-logs/photos/${endpoint}/route.ts`, mocks).POST as Handler,
  ])) as Record<Endpoint, Handler>;
  const request = (endpoint: Endpoint, body: unknown = endpoint === 'prepare' ? operation : { operation, storage }, token = 'synthetic-user') =>
    new Request(`https://api.example/api/mobile/v1/daily-logs/photos/${endpoint}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  return { calls, handlers, request, run: (endpoint: Endpoint, body?: unknown) => handlers[endpoint](request(endpoint, body)) };
}

async function safeFailure(response: Response, status: number, retryable = status === 503 || status === 409) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  assert.equal(response.headers.get('vary'), 'Origin, Authorization');
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['error', 'retryable']);
  assert.equal(typeof body.error, 'string'); assert.ok(body.error.length);
  assert.equal(body.retryable, retryable);
  if (status === 401) assert.equal(body.error, 'Not authenticated');
  assert.doesNotMatch(JSON.stringify(body), /private fixture|synthetic-upload-token|must not reach|PGRST|42501|57014/);
}

describe('photo synchronization query failures (actual routes and Supabase transport)', () => {
  const authFaults = [
    { status: 401, body: 'text' as const },
    { status: 401, body: 'null' as const },
    ...['PGRST301', 'PGRST302', 'PGRST303'].map((code) => ({ status: 500, code })),
  ];
  const queryFaults = [
    ...authFaults.map((fault) => ({ ...fault, expected: 401 })),
    { status: 403, body: 'null' as const, expected: 403 },
    { status: 400, code: '42501', expected: 403 },
    { status: 500, body: 'null' as const, expected: 503 },
    { status: 500, code: '57014', expected: 503 },
    { status: 0, expected: 503 },
  ];
  for (const endpoint of ['prepare', 'finalize'] as const) {
    for (const query of ['profiles', 'membership', 'parent'] as const) for (const fault of queryFaults) {
      it(`${endpoint} classifies ${query} ${fault.status}/${'code' in fault ? fault.code : 'body' in fault ? fault.body : 'transport'} without a later mutation`, async () => {
        const h = harness({ faults: [{ query, ...fault }] });
        await safeFailure(await h.run(endpoint), fault.expected);
        assert.equal(h.calls.some((call) => call.query === 'sign' || call.query === 'rpc'), false);
        if (query !== 'parent') assert.equal(h.calls.some((call) => call.query === 'parent'), false);
      });
    }
    it(`${endpoint} gives authentication priority over another parallel permission failure`, async () => {
      for (const profileFault of [{ status: 403, code: '42501' }, { status: 406, code: 'PGRST116' }]) {
        const h = harness({ faults: [{ query: 'profiles', ...profileFault }, { query: 'membership', status: 401, body: 'null' }] });
        await safeFailure(await h.run(endpoint), 401);
        assert.equal(h.calls.length, 2);
      }
    });
    it(`${endpoint} preserves membership, editor and parent guards`, async () => {
      const missingProfile = harness({ faults: [{ query: 'profiles', status: 406, code: 'PGRST116' }] });
      await safeFailure(await missingProfile.run(endpoint), 403);
      assert.equal(missingProfile.calls.length, 2);
      for (const options of [{ member: false }, { canEdit: false }]) {
        const h = harness(options); await safeFailure(await h.run(endpoint), 403);
        assert.equal(h.calls.length, 2);
      }
      const missingParent = harness({ parent: false });
      await safeFailure(await missingParent.run(endpoint), 409);
      assert.equal(missingParent.calls.length, 3);
    });
    it(`${endpoint} rejects a different operation owner before querying`, async () => {
      const h = harness(); const wrongOwner = { ...operation, userId: 'someone-else' };
      await safeFailure(await h.run(endpoint, endpoint === 'prepare' ? wrongOwner : { operation: wrongOwner, storage }), 400);
      assert.equal(h.calls.length, 0);
    });
  }

  for (const fault of [
    { status: 401, expected: 401 }, { status: 401, body: 'null' as const, expected: 401 },
    { status: 500, code: 'PGRST303', expected: 401 },
    { status: 403, expected: 403 }, { status: 403, body: 'null' as const, expected: 403 },
    { status: 500, expected: 503 }, { status: 500, body: 'null' as const, expected: 503 }, { status: 0, expected: 503 },
  ]) it(`prepare classifies signed-upload authorization ${fault.status}/${'body' in fault ? fault.body : 'error'} safely`, async () => {
    const h = harness({ faults: [{ query: 'sign', ...fault }] });
    await safeFailure(await h.run('prepare'), fault.expected);
    assert.equal(h.calls.filter((call) => call.query === 'sign').length, 1);
    assert.equal(h.calls.some((call) => call.query === 'rpc'), false);
  });

  for (const fault of [
    ...authFaults.map((item) => ({ ...item, expected: 401 })),
    { status: 403, expected: 403 }, { status: 403, body: 'null' as const, expected: 403 },
    { status: 400, code: '42501', expected: 403 },
    { status: 400, code: '22023', expected: 400 }, { status: 409, code: '23505', expected: 400 },
    { status: 500, code: '57014', expected: 503 }, { status: 500, body: 'null' as const, expected: 503 }, { status: 0, expected: 503 },
  ]) it(`finalize classifies RPC ${fault.status}/${'code' in fault ? fault.code : 'body' in fault ? fault.body : 'transport'} safely`, async () => {
    const h = harness({ faults: [{ query: 'rpc', ...fault }] });
    await safeFailure(await h.run('finalize'), fault.expected);
    assert.equal(h.calls.filter((call) => call.query === 'rpc').length, 1);
  });

  it('preserves the canonical signed path and projects exact finalize/replay receipts', async () => {
    const h = harness();
    const prepared = await h.run('prepare');
    assert.equal(prepared.status, 200);
    assert.equal(prepared.headers.get('cache-control'), 'no-store, max-age=0');
    assert.deepEqual(await prepared.json(), { ...storage, token: 'synthetic-upload-token' });
    for (const duplicate of [false, true]) {
      const response = await h.run('finalize');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
      assert.deepEqual(await response.json(), { id: photoId, duplicate });
    }
    const payloads = h.calls.filter((call) => call.query === 'rpc').map((call) => call.payload);
    assert.deepEqual(payloads[0], payloads[1]);
  });

  it('requires authentication before either route reads project data', async () => {
    for (const endpoint of ['prepare', 'finalize'] as const) {
      const h = harness({ authenticated: false });
      const response = await h.run(endpoint);
      assert.equal(response.status, 401);
      assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
      assert.deepEqual(await response.json(), { error: 'Not authenticated' });
      assert.equal(h.calls.length, 0);
    }
  });

  for (const receipt of [null, [], {}, { id: parentId, duplicate: false }, { id: photoId },
    { id: photoId, duplicate: 'false' }, { id: photoId, duplicate: 0 }, { id: photoId, duplicate: null }]) {
    it(`does not acknowledge malformed successful RPC receipt ${JSON.stringify(receipt)}`, async () => {
      await safeFailure(await harness({ receipt }).run('finalize'), 503);
    });
  }
  for (const signReceipt of [null, {}, { url: '/object/upload/sign/fixture-without-token' }]) {
    it(`fails closed for malformed signed-upload result ${JSON.stringify(signReceipt)}`, async () => {
      await safeFailure(await harness({ signReceipt }).run('prepare'), 503);
    });
  }
  it('does not finalize another storage destination', async () => {
    for (const invalid of [{ ...storage, bucket: 'thermal-photos' }, { ...storage, path: `${storage.path}-other` }]) {
      const h = harness();
      await safeFailure(await h.run('finalize', { operation, storage: invalid }), 400);
      assert.equal(h.calls.some((call) => call.query === 'rpc'), false);
    }
  });

  for (const endpoint of ['prepare', 'finalize'] as const) {
    it(`${endpoint} recovers through one MobileApiClient refresh with unchanged operation identity`, async () => {
      const h = harness({ faults: [{ query: endpoint === 'prepare' ? 'sign' : 'rpc', status: 401, token: 'synthetic-expired' }] });
      let refreshes = 0; const statuses: number[] = [];
      const api = new MobileApiClient({ baseUrl: 'https://api.example', getAccessToken: async () => 'synthetic-expired',
        refreshAccessToken: async () => { refreshes++; return 'synthetic-refreshed'; },
        fetch: async (input, init) => {
          const response = await h.handlers[endpoint](new Request(input, init)); statuses.push(response.status); return response;
        },
      });
      const result = endpoint === 'prepare' ? await api.prepareDailyLogPhoto(operation) : await api.finalizeDailyLogPhoto(operation, storage);
      assert.deepEqual(statuses, [401, 200]); assert.equal(refreshes, 1);
      assert.deepEqual(result, endpoint === 'prepare' ? { ...storage, token: 'synthetic-upload-token' } : { id: photoId, duplicate: false });
    });
  }
  it('does not loop after finalization rejects the refreshed token', async () => {
    const h = harness({ faults: [{ query: 'rpc', status: 401 }] });
    let refreshes = 0; let requests = 0;
    const api = new MobileApiClient({ baseUrl: 'https://api.example', getAccessToken: async () => 'synthetic-expired',
      refreshAccessToken: async () => { refreshes++; return 'synthetic-refreshed'; },
      fetch: async (input, init) => { requests++; return h.handlers.finalize(new Request(input, init)); },
    });
    await assert.rejects(api.finalizeDailyLogPhoto(operation, storage), (error: unknown) => error instanceof MobileApiError && error.status === 401);
    assert.equal(refreshes, 1); assert.equal(requests, 2);
  });
});
