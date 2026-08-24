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
          dailyLogs: [], synchronizedAt: '2026-08-20T12:00:00Z',
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
});
