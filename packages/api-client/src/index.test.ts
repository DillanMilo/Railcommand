import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { MobileApiClient, MobileApiError } from './index';

describe('MobileApiClient', () => {
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
