import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';
import { normalizeDailyLogReadFields } from '@railcommand/domain';
import { MobileApiClient, MobileApiError } from '@railcommand/api-client';
import { mobileJson, mobileOptions } from './auth';
import { mobileQueryFailed, mobileQueryFailureStatus } from './query-failure';
import { ACTIONS, canPerform, canPerformWithProjectEdit } from '../permissions';

const userId = '10000000-0000-4000-8000-000000000001';
const projectId = '20000000-0000-4000-8000-000000000001';
const logId = '30000000-0000-4000-8000-000000000001';
const timestamp = '2026-08-30T12:00:00.000Z';
const base = { id: logId, project_id: projectId, log_date: '2026-08-30', weather_conditions: 'Clear', work_summary: 'Renewed track', safety_notes: 'Briefing complete', created_at: timestamp };
const rich = { ...base, weather_temp: '-4.5', weather_wind: 'NW 10 mph', geo_tag: { lat: 0, lng: -87.5, accuracy: 0, altitude: -2, timestamp, private: 'not returned' },
  personnel: [{ id: 'personnel-1', role: 'Foreman', headcount: 0, company: 'QA', private: 'not returned' }],
  equipment: [{ id: 'equipment-1', equipment_type: 'Tamper', count: 2, notes: 'Operational', private: 'not returned' }],
  work_items: [{ id: 'work-1', description: 'Track', quantity: '12.25', unit: 'LF', location: 'MP 10', private: 'not returned' }] };

type Query = 'profiles' | 'membership' | 'projects' | 'daily_logs' | 'team' | 'submittals' | 'rfis' | 'punch_list_items' | 'earthcam_embeds';
type Fault = { query: Query; status: number; code?: string; token?: string; plainText?: boolean; nullBody?: boolean };

function harness(options: {
  row?: Record<string, unknown>;
  authenticated?: boolean;
  member?: boolean;
  role?: 'member' | 'admin';
  faults?: Fault[];
} = {}) {
  const queries: URL[] = [];
  const project = { id: projectId, name: 'Synthetic project', status: 'active', location: '', client: '', created_at: timestamp };
  const client = (authorization: string) => createClient('https://staging.example', 'public-fixture-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization }, fetch: async (input, init) => {
      const request = new Request(input, init);
      assert.equal(request.method, 'GET');
      assert.equal(request.headers.get('authorization'), authorization);
      assert.match(authorization, /^Bearer synthetic-(user|expired|refreshed|service)$/);
      const url = new URL(request.url); queries.push(url);
      assert.equal(url.origin, 'https://staging.example');
      const table = url.pathname.split('/').at(-1);
      const query = table === 'project_members' ? (url.searchParams.has('profile_id') ? 'membership' : 'team') : table;
      const fault = options.faults?.find((item) => item.query === query && (!item.token || authorization === `Bearer ${item.token}`));
      if (fault) {
        if (fault.status === 0) throw new DOMException('private fixture transport failure', 'AbortError');
        if (fault.plainText) return new Response('private fixture upstream body', { status: fault.status });
        if (fault.nullBody) return Response.json(null, { status: fault.status });
        return Response.json({ code: fault.code, message: 'private fixture upstream message', details: 'private fixture details', hint: 'private fixture hint' }, { status: fault.status });
      }
      if (table === 'profiles') return Response.json({ role: options.role ?? 'member' });
      if (table === 'project_members' && url.searchParams.has('profile_id')) return Response.json(options.member === false ? [] : [{
        project_id: projectId, project_role: 'foreman', can_edit: true,
        project,
      }]);
      if (table === 'projects') { assert.equal(options.role, 'admin'); return Response.json([project]); }
      assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
      if (table === 'daily_logs') {
        assert.equal(url.searchParams.get('limit'), '91');
        assert.equal(url.searchParams.get('offset'), '0');
        assert.equal(url.searchParams.get('order'), 'log_date.desc');
        return Response.json([options.row ?? rich]);
      }
      assert.ok(['project_members', 'submittals', 'rfis', 'punch_list_items', 'earthcam_embeds'].includes(table!));
      return Response.json([]);
    } },
  });
  const compiled = { exports: {} as { GET?: (request: Request) => Promise<Response> } };
  const { outputText } = ts.transpileModule(readFileSync(new URL('../../app/api/mobile/v1/bootstrap/route.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mocks: Record<string, unknown> = {
    '@railcommand/domain': { normalizeDailyLogReadFields },
    '@/lib/mobile-api/auth': { mobileJson, mobileOptions, authenticateMobileRequest: async (request: Request) => options.authenticated === false ? null : {
      supabase: client(request.headers.get('authorization')!), user: { id: userId },
    } },
    '@/lib/mobile-api/query-failure': { mobileQueryFailed, mobileQueryFailureStatus },
    '@/lib/mobile-api/pagination': {
      parseMobilePage(url: URL) {
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const limit = Math.min(Number(url.searchParams.get('limit') ?? 90), 100);
        return { offset, limit };
      },
      mobilePage<T>(rows: T[] | null, limit: number) {
        const safeRows = rows ?? [];
        return { items: safeRows.slice(0, limit), hasMore: safeRows.length > limit };
      },
    },
    '@/lib/permissions': { ACTIONS, canPerform, canPerformWithProjectEdit },
    '@/lib/supabase/admin': { createAdminClient() {
      assert.equal(options.role, 'admin', 'A non-admin read must not escalate the authenticated client');
      return client('Bearer synthetic-service');
    } },
  };
  runInNewContext(outputText, { module: compiled, exports: compiled.exports, URL,
    require(name: string) { if (name in mocks) return mocks[name]; throw new Error(`Unexpected bootstrap dependency ${name}`); } });
  const handle = (request: Request) => compiled.exports.GET!(request);
  return { queries, handle, read: (requestedProjectId: string | null = projectId) => handle(new Request(
    `https://api.example/api/mobile/v1/bootstrap${requestedProjectId ? `?projectId=${requestedProjectId}` : ''}`,
    { headers: { Authorization: 'Bearer synthetic-user' } },
  )) };
}

async function assertSafeFailure(response: Response, status: number, error: string) {
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  assert.equal(response.headers.get('vary'), 'Origin, Authorization');
  assert.deepEqual(await response.json(), { error });
}

describe('richer daily-log bootstrap readback (synthetic transport)', () => {
  it('selects project-scoped child relations and maps all richer fields without raw database extras', async () => {
    const h = harness(); const response = await h.read();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control')!, /no-store/);
    const body = await response.json();
    assert.deepEqual(body.dailyLogs, [{ id: logId, projectId, logDate: base.log_date, weatherConditions: 'Clear', workSummary: base.work_summary, safetyNotes: base.safety_notes, createdAt: timestamp,
      weatherTemp: -4.5, weatherWind: rich.weather_wind, geoTag: { lat: 0, lng: -87.5, accuracy: 0, altitude: -2, timestamp },
      personnel: [{ id: 'personnel-1', role: 'Foreman', headcount: 0, company: 'QA' }],
      equipment: [{ id: 'equipment-1', equipmentType: 'Tamper', count: 2, notes: 'Operational' }],
      workItems: [{ id: 'work-1', description: 'Track', quantity: 12.25, unit: 'LF', location: 'MP 10' }],
    }]);
    const select = h.queries.find((url) => url.pathname.endsWith('/daily_logs'))!.searchParams.get('select')!;
    for (const projection of ['weather_temp', 'weather_wind', 'geo_tag', 'personnel:daily_log_personnel(id,role,headcount,company)',
      'equipment:daily_log_equipment(id,equipment_type,count,notes)', 'work_items:daily_log_work_items(id,description,quantity,unit,location)']) assert.ok(select.includes(projection), projection);
    assert.equal(body.projects[0].canCreateRfi, true);
    assert.equal(body.projects[0].canCreateSubmittal, false);
    assert.deepEqual(body.pagination, {
      offset: 0, limit: 90, dailyLogsHasMore: false, submittalsHasMore: false, rfisHasMore: false,
    });
    for (const table of ['submittals', 'rfis']) {
      const query = h.queries.find((url) => url.pathname.endsWith(`/${table}`))!;
      assert.equal(query.searchParams.get('offset'), '0');
      assert.equal(query.searchParams.get('limit'), '91');
    }
  });

  it('preserves explicit no-data values without inventing zeroes', async () => {
    const response = await harness({ row: { ...base, weather_temp: null, weather_wind: '', geo_tag: null, personnel: [], equipment: [], work_items: [] } }).read();
    const log = (await response.json()).dailyLogs[0];
    assert.equal(log.weatherTemp, null); assert.equal(log.weatherWind, ''); assert.equal(log.geoTag, null);
    assert.deepEqual(log.personnel, []); assert.deepEqual(log.equipment, []); assert.deepEqual(log.workItems, []);
  });

  it('does not turn malformed optional values into an apparently empty record section', async () => {
    const response = await harness({ row: { ...rich, weather_temp: 'invalid', geo_tag: { lat: 91, lng: 0, timestamp }, personnel: [{ id: 'bad', role: 'Crew', headcount: -1, company: 'QA' }] } }).read();
    const log = (await response.json()).dailyLogs[0];
    assert.equal(log.weatherTemp, undefined); assert.equal(log.geoTag, undefined); assert.equal(log.personnel, undefined);
    assert.equal(log.workSummary, base.work_summary); assert.equal(log.equipment[0].equipmentType, 'Tamper');
  });

  it('fails the refresh explicitly when the authenticated child query is denied', async () => {
    const response = await harness({ faults: [{ query: 'daily_logs', status: 403, code: '42501' }] }).read();
    await assertSafeFailure(response, 403, 'Could not load project field data');
  });

  it('does not read project rows without authentication or authorized project membership', async () => {
    const unauthenticated = harness({ authenticated: false }); assert.equal((await unauthenticated.read()).status, 401); assert.equal(unauthenticated.queries.length, 0);
    const nonmember = harness({ member: false }); assert.equal((await nonmember.read()).status, 403);
    assert.equal(nonmember.queries.some((url) => url.pathname.endsWith('/daily_logs')), false);
  });
});

describe('bootstrap upstream failures (actual route and Supabase transport)', () => {
  const queries: Query[] = ['profiles', 'membership', 'projects', 'daily_logs', 'team', 'submittals', 'rfis', 'punch_list_items', 'earthcam_embeds'];
  const authFailures = [
    { status: 401, plainText: true },
    { status: 401, code: 'PGRST303' },
    ...['PGRST301', 'PGRST302', 'PGRST303'].map((code) => ({ status: 500, code })),
  ];

  for (const query of queries) for (const fault of authFailures) {
    it(`returns safe 401 for ${query} upstream ${fault.status}/${'code' in fault ? fault.code : 'plain text'}`, async () => {
      const h = harness({ role: query === 'projects' ? 'admin' : 'member', faults: [{ query, ...fault }] });
      await assertSafeFailure(await h.read(), 401, 'Not authenticated');
      if (query === 'profiles' || query === 'membership') assert.equal(h.queries.length, 2);
      if (query === 'projects') assert.equal(h.queries.length, 3);
    });
  }

  for (const query of ['profiles', 'membership', 'projects', 'daily_logs'] as const) {
    const message = query === 'projects' ? 'Could not list projects' : query === 'daily_logs' ? 'Could not load project field data' : 'Could not verify project access';
    for (const fault of [{ status: 403 }, { status: 400, code: '42501' }]) {
      it(`preserves permission denial for ${query} ${fault.status}/${fault.code ?? 'no code'}`, async () => {
        await assertSafeFailure(await harness({ role: query === 'projects' ? 'admin' : 'member', faults: [{ query, ...fault }] }).read(), 403, message);
      });
    }
    for (const fault of [{ status: 500, code: '57014' }, { status: 400, code: 'PGRST200' }, { status: 0 }]) {
      it(`returns safe 500 for ${query} non-authentication error ${fault.status}`, async () => {
        await assertSafeFailure(await harness({ role: query === 'projects' ? 'admin' : 'member', faults: [{ query, ...fault }] }).read(), 500, message);
      });
    }
  }

  it('keeps a missing profile denied, but does not misclassify arbitrary singular errors as permission failures', async () => {
    await assertSafeFailure(await harness({ faults: [{ query: 'profiles', status: 406, code: 'PGRST116' }] }).read(), 403, 'Could not verify project access');
    await assertSafeFailure(await harness({ faults: [{ query: 'membership', status: 406, code: 'PGRST116' }] }).read(), 500, 'Could not verify project access');
  });

  it('prioritizes authentication over simultaneous missing-profile, permission, or internal errors', async () => {
    for (const failure of [{ status: 406, code: 'PGRST116' }, { status: 403, code: '42501' }, { status: 500, code: '57014' }]) {
      await assertSafeFailure(await harness({ faults: [{ query: 'profiles', ...failure }, { query: 'membership', status: 401, code: 'PGRST303' }] }).read(), 401, 'Not authenticated');
    }
    await assertSafeFailure(await harness({ faults: [{ query: 'daily_logs', status: 403, code: '42501' }, { query: 'earthcam_embeds', status: 401, code: 'PGRST303' }] }).read(), 401, 'Not authenticated');
    await assertSafeFailure(await harness({ faults: [{ query: 'daily_logs', status: 401, code: 'PGRST303' }, { query: 'earthcam_embeds', status: 500, code: '57014' }] }).read(), 401, 'Not authenticated');
  });

  it('keeps service-client EarthCam failures internal, while user-scoped authentication failures still win', async () => {
    const serviceFault: Fault = { query: 'earthcam_embeds', status: 401, code: 'PGRST303', token: 'synthetic-service' };
    await assertSafeFailure(await harness({ role: 'admin', faults: [serviceFault] }).read(), 500, 'Could not load project field data');
    await assertSafeFailure(await harness({ role: 'admin', faults: [serviceFault, { query: 'daily_logs', status: 401, code: 'PGRST303' }] }).read(), 401, 'Not authenticated');
    assert.equal((await harness({ role: 'admin' }).read()).status, 200);
  });

  it('fails closed on non-2xx JSON null bodies even when the SDK exposes error:null', async () => {
    for (const query of ['membership', 'daily_logs'] as const) for (const status of [401, 403, 500]) {
      const message = status === 401 ? 'Not authenticated' : query === 'membership' ? 'Could not verify project access' : 'Could not load project field data';
      await assertSafeFailure(await harness({ faults: [{ query, status, nullBody: true }] }).read(), status, message);
    }
    await assertSafeFailure(await harness({ role: 'admin', faults: [{ query: 'earthcam_embeds', status: 401, nullBody: true }] }).read(), 500, 'Could not load project field data');
  });

  it('preserves no-membership denial and authenticated empty-project bootstrap', async () => {
    const denied = harness({ member: false });
    await assertSafeFailure(await denied.read(), 403, 'Project membership required');
    assert.equal(denied.queries.length, 2);
    const empty = harness({ member: false });
    const response = await empty.read(null);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.activeProjectId, null); assert.deepEqual(body.projects, []); assert.deepEqual(body.dailyLogs, []);
    assert.equal(empty.queries.length, 2);
  });

  for (const query of ['membership', 'daily_logs'] as const) {
    it(`allows the existing MobileApiClient single refresh to recover a ${query} JWT failure`, async () => {
      const h = harness({ faults: [{ query, status: 401, code: 'PGRST303', token: 'synthetic-expired' }] });
      let refreshes = 0;
      const statuses: number[] = [];
      const api = new MobileApiClient({ baseUrl: 'https://api.example',
        getAccessToken: async () => 'synthetic-expired',
        refreshAccessToken: async () => { refreshes++; return 'synthetic-refreshed'; },
        fetch: async (input, init) => { const response = await h.handle(new Request(input, init)); statuses.push(response.status); return response; },
      });
      const body = await api.getBootstrap(projectId);
      assert.deepEqual(statuses, [401, 200]); assert.equal(refreshes, 1);
      assert.equal(body.userId, userId); assert.equal(body.dailyLogs[0].id, logId);
    });
  }

  it('does not loop when the refreshed token is still rejected', async () => {
    const h = harness({ faults: [{ query: 'membership', status: 401, code: 'PGRST303' }] });
    let requests = 0; let refreshes = 0;
    const api = new MobileApiClient({ baseUrl: 'https://api.example', getAccessToken: async () => 'synthetic-expired',
      refreshAccessToken: async () => { refreshes++; return 'synthetic-refreshed'; },
      fetch: async (input, init) => { requests++; return h.handle(new Request(input, init)); },
    });
    await assert.rejects(api.getBootstrap(projectId), (error: unknown) => error instanceof MobileApiError && error.status === 401 && error.message === 'Not authenticated');
    assert.equal(refreshes, 1); assert.equal(requests, 2);
  });
});
