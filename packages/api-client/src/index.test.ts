import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { MobileApiClient, MobileApiError } from './index';
import type { MobileRecordDraft } from '@railcommand/domain';

describe('MobileApiClient', () => {
  it('keeps the creation identity and body unchanged when refreshing a session', async () => {
    const draft = { clientId: 'fixture-id', kind: 'rfis', projectId: 'fixture-project', title: 'Synthetic' } as MobileRecordDraft;
    let calls = 0;
    const client = new MobileApiClient({ baseUrl: 'https://staging.example', getAccessToken: async () => 'expired', refreshAccessToken: async () => 'refreshed',
      fetch: async (input, init) => {
        const req = new Request(input, init); calls += 1;
        assert.equal(req.url, 'https://staging.example/api/mobile/v1/records/create');
        assert.equal(req.method, 'POST'); assert.equal(req.headers.get('idempotency-key'), draft.clientId);
        assert.equal(req.headers.has('next-action'), false); assert.deepEqual(await req.json(), draft);
        assert.equal(req.headers.get('authorization'), calls === 1 ? 'Bearer expired' : 'Bearer refreshed');
        return calls === 1 ? Response.json({ error: 'expired' }, { status: 401 }) : Response.json({ id: draft.clientId });
      },
    });
    assert.equal((await client.createRecord(draft)).id, draft.clientId); assert.equal(calls, 2);
  });
  it('reads exact record and attachment scope with bearer headers, not URL credentials or web actions', async () => {
    const scope = { kind: 'rfis' as const, projectId: 'project-a', recordId: 'record-b' };
    const requests: URL[] = [];
    const client = new MobileApiClient({ baseUrl: 'https://staging.example', getAccessToken: async () => 'synthetic-token',
      fetch: async (input, init) => {
        const request = new Request(input, init); const url = new URL(request.url); requests.push(url);
        assert.equal(request.method, 'GET'); assert.equal(request.headers.get('authorization'), 'Bearer synthetic-token');
        assert.equal(request.headers.has('next-action'), false); assert.doesNotMatch(url.toString(), /synthetic-token/);
        for (const [key, value] of Object.entries(scope)) assert.equal(url.searchParams.get(key), value);
        return Response.json({});
      },
    });
    await client.getRecordDetail(scope); await client.getRecordAttachment(scope, 'photo-c');
    assert.equal(requests[0].pathname, '/api/mobile/v1/records/detail');
    assert.equal(requests[1].pathname, '/api/mobile/v1/records/attachment');
    assert.equal(requests[1].searchParams.get('attachmentId'), 'photo-c');
  });
  it('does not request or sign an attachment while only record text is opened', async () => {
    const paths: string[] = [];
    const scope = { kind: 'rfis' as const, projectId: 'project-a', recordId: 'record-b' };
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example', getAccessToken: async () => 'token',
      fetch: async (input) => {
        paths.push(new URL(input instanceof Request ? input.url : input.toString()).pathname);
        return Response.json({});
      },
    });
    await client.getRecordDetail(scope);
    assert.deepEqual(paths, ['/api/mobile/v1/records/detail']);
    await client.getRecordAttachment(scope, 'attachment-c');
    assert.deepEqual(paths, ['/api/mobile/v1/records/detail', '/api/mobile/v1/records/attachment']);
  });
  it('exports a filtered report through bearer JSON without a URL token or web action', async () => {
    const selection = { projectId: 'project-a', kind: 'rfis' as const, recordIds: ['rfi-b', 'rfi-a'] };
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com',
      getAccessToken: async () => 'test-access-token',
      fetch: async (input, init) => {
        const request = new Request(input, init);
        assert.equal(request.method, 'POST');
        assert.equal(request.url, 'https://staging.example.com/api/mobile/v1/reports/pdf');
        assert.equal(request.headers.get('authorization'), 'Bearer test-access-token');
        assert.equal(request.headers.has('next-action'), false);
        assert.deepEqual(await request.json(), selection);
        return Response.json({ mimeType: 'application/pdf', recordCount: 2 });
      },
    });
    assert.equal((await client.exportPdfReport(selection)).recordCount, 2);
  });
  it('uses bearer JSON endpoints instead of Server Action protocols', async () => {
    let authorization = '';
    let hasNextAction = true;
    let path = '';
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com',
      getAccessToken: async () => 'access-token',
      fetch: async (input, init) => {
        const request = new Request(input, init);
        authorization = request.headers.get('authorization') ?? '';
        hasNextAction = request.headers.has('next-action');
        path = new URL(request.url).pathname;
        return Response.json({
          userId: 'user-a', projects: [], activeProjectId: null,
          dailyLogs: [], team: [], synchronizedAt: '2026-08-20T12:00:00Z',
        });
      },
    });
    await client.getBootstrap('project-a');
    assert.equal(authorization, 'Bearer access-token');
    assert.equal(hasNextAction, false);
    assert.equal(path, '/api/mobile/v1/bootstrap');
  });

  it('deduplicates identical in-flight reads but permits a later refresh', async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com', getAccessToken: async () => 'access-token',
      fetch: async () => { calls += 1; await gate; return Response.json({ userId: 'u', projects: [], activeProjectId: null, dailyLogs: [], team: [], synchronizedAt: new Date().toISOString() }); },
    });
    const first = client.getBootstrap('project-a');
    const duplicate = client.getBootstrap('project-a');
    release();
    assert.strictEqual(first, duplicate);
    await Promise.all([first, duplicate]);
    assert.equal(calls, 1);
    await client.getBootstrap('project-a');
    assert.equal(calls, 2);
  });

  it('sends bounded pagination parameters and reports payload-free transfer metrics', async () => {
    const metrics: unknown[] = [];
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com', getAccessToken: async () => 'private-token',
      onRequestMetric: (metric) => metrics.push(metric),
      fetch: async (input) => {
        const url = new URL(input instanceof Request ? input.url : input.toString());
        assert.equal(url.searchParams.get('offset'), '90');
        assert.equal(url.searchParams.get('limit'), '25');
        return Response.json({ userId: 'u', projects: [], activeProjectId: null, dailyLogs: [], team: [], synchronizedAt: new Date().toISOString() });
      },
    });
    await client.getBootstrap('project-a', { offset: 90, limit: 25 });
    assert.equal(metrics.length, 1);
    assert.deepEqual(Object.keys(metrics[0] as object).sort(), ['approximateTransferredBytes', 'operation', 'status']);
    assert.doesNotMatch(JSON.stringify(metrics), /private-token|project-a|staging\.example/);
  });

  it('classifies authorization failures as permanent', async () => {
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com',
      getAccessToken: async () => 'expired-token',
      fetch: async () => Response.json({ error: 'Not authenticated' }, { status: 401 }),
    });
    await assert.rejects(() => client.getBootstrap(), (error: unknown) => {
      assert.ok(error instanceof MobileApiError);
      assert.equal(error.retryable, false);
      return true;
    });
  });

  it('refreshes an expired session once and replays the same request', async () => {
    const authorizations: string[] = [];
    let refreshes = 0;
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com',
      getAccessToken: async () => 'expired-token',
      refreshAccessToken: async () => {
        refreshes += 1;
        return 'refreshed-token';
      },
      fetch: async (_input, init) => {
        const authorization = new Headers(init?.headers).get('authorization') ?? '';
        authorizations.push(authorization);
        return authorization === 'Bearer refreshed-token'
          ? Response.json({
            userId: 'user-a', projects: [], activeProjectId: null,
            dailyLogs: [], team: [], synchronizedAt: '2026-08-20T12:00:00Z',
          })
          : Response.json({ error: 'Expired access token' }, { status: 401 });
      },
    });

    await client.getBootstrap();
    assert.equal(refreshes, 1);
    assert.deepEqual(authorizations, ['Bearer expired-token', 'Bearer refreshed-token']);
  });

  it('does not loop when a refreshed session is still unauthorized', async () => {
    let requests = 0;
    let refreshes = 0;
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com',
      getAccessToken: async () => 'expired-token',
      refreshAccessToken: async () => {
        refreshes += 1;
        return 'rejected-refreshed-token';
      },
      fetch: async () => {
        requests += 1;
        return Response.json({ error: 'Not authenticated' }, { status: 401 });
      },
    });

    await assert.rejects(() => client.getBootstrap(), (error: unknown) => {
      assert.ok(error instanceof MobileApiError);
      assert.equal(error.retryable, false);
      return true;
    });
    assert.equal(refreshes, 1);
    assert.equal(requests, 2);
  });

  it('uses authenticated JSON routes for photo prepare and finalize', async () => {
    const paths: string[] = [];
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com',
      getAccessToken: async () => 'access-token',
      fetch: async (input) => {
        const path = new URL(input instanceof Request ? input.url : input.toString()).pathname;
        paths.push(path);
        return Response.json(path.endsWith('/prepare')
          ? { bucket: 'project-photos', path: 'project/log/photo.jpg', token: 'signed-token' }
          : { id: 'photo-a', duplicate: false });
      },
    });
    const operation = {
      operationId: 'photo-a', userId: 'user-a', projectId: 'project-a',
      parentEntityId: 'log-a', idempotencyKey: 'daily-log-photo:photo-a',
      payload: {
        fileName: 'track.jpg', fileType: 'image/jpeg', fileSize: 5,
        photoCategory: 'standard' as const, geoLat: null, geoLng: null,
        capturedAt: '2026-08-24T12:00:00.000Z',
      },
    };
    const prepared = await client.prepareDailyLogPhoto(operation);
    await client.finalizeDailyLogPhoto(operation, prepared);
    assert.deepEqual(paths, [
      '/api/mobile/v1/daily-logs/photos/prepare',
      '/api/mobile/v1/daily-logs/photos/finalize',
    ]);
  });

  it('uses authenticated mobile routes for push, deletion, and invitations', async () => {
    const requests: Array<{ path: string; method: string }> = [];
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com',
      getAccessToken: async () => 'access-token',
      fetch: async (input, init) => {
        const path = new URL(input instanceof Request ? input.url : input.toString()).pathname;
        requests.push({ path, method: init?.method ?? 'GET' });
        if (path.includes('/devices/')) return Response.json({ registered: true });
        if (path.includes('/deletion-request')) return Response.json({ id: 'request-a', status: 'pending',
          requestedAt: '2026-08-25T12:00:00Z', scheduledFor: '2026-09-24T12:00:00Z', duplicate: false });
        if (init?.method === 'POST') return Response.json({ projectId: 'project-a' });
        return Response.json({ token: 'a'.repeat(64), projectId: 'project-a', projectName: 'Track Renewal',
          email: 'field@example.com', role: 'engineer', expiresAt: '2026-09-01T12:00:00Z' });
      },
    });
    await client.registerPushDevice({ expoPushToken: 'ExponentPushToken[test]', platform: 'ios', appProfile: 'development', deviceName: 'iPhone' });
    await client.requestAccountDeletion({
      clientRequestId: '11111111-1111-4111-8111-111111111111',
      localWork: { drafts: 0, outbox: 0, photos: 0 },
    });
    await client.getAccountDeletionRequest();
    await client.cancelAccountDeletion('request-a');
    await client.getInvitation('a'.repeat(64));
    await client.acceptInvitation('a'.repeat(64));
    assert.deepEqual(requests, [
      { path: '/api/mobile/v1/devices/push-token', method: 'POST' },
      { path: '/api/mobile/v1/account/deletion-request', method: 'POST' },
      { path: '/api/mobile/v1/account/deletion-request', method: 'GET' },
      { path: '/api/mobile/v1/account/deletion-request/cancel', method: 'POST' },
      { path: `/api/mobile/v1/invitations/${'a'.repeat(64)}`, method: 'GET' },
      { path: `/api/mobile/v1/invitations/${'a'.repeat(64)}`, method: 'POST' },
    ]);
  });

  it('uses authenticated JSON routes for EarthCam feed management', async () => {
    const requests: Array<{ path: string; method: string; body: unknown }> = [];
    const client = new MobileApiClient({
      baseUrl: 'https://staging.example.com',
      getAccessToken: async () => 'access-token',
      fetch: async (input, init) => {
        const request = new Request(input, init);
        requests.push({
          path: new URL(request.url).pathname,
          method: request.method,
          body: JSON.parse(await request.text()),
        });
        return request.url.endsWith('/delete')
          ? Response.json({ id: '22222222-2222-4222-8222-222222222222', deleted: true })
          : Response.json({
            id: '22222222-2222-4222-8222-222222222222',
            projectId: '11111111-1111-4111-8111-111111111111',
            label: 'North Yard',
            url: 'https://share.earthcam.net/example',
            createdAt: '2026-08-29T12:00:00Z',
          });
      },
    });
    await client.saveEarthCamEmbed({
      projectId: '11111111-1111-4111-8111-111111111111',
      label: 'North Yard',
      embedInput: 'https://share.earthcam.net/example',
    });
    await client.deleteEarthCamEmbed({
      projectId: '11111111-1111-4111-8111-111111111111',
      id: '22222222-2222-4222-8222-222222222222',
    });
    assert.deepEqual(requests.map(({ path, method }) => ({ path, method })), [
      { path: '/api/mobile/v1/earthcam/embeds', method: 'POST' },
      { path: '/api/mobile/v1/earthcam/embeds/delete', method: 'POST' },
    ]);
    assert.deepEqual(requests[0]?.body, {
      projectId: '11111111-1111-4111-8111-111111111111',
      label: 'North Yard',
      embedInput: 'https://share.earthcam.net/example',
    });
  });
});
