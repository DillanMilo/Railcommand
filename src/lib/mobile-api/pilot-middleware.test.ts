import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'mocha';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';

const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'MOBILE_BACKEND_ENV', 'MOBILE_PILOT_MODE', 'MOBILE_PILOT_USER_IDS'] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('production mobile pilot middleware', () => {
  it('blocks the production mobile API before service access when the pilot is disabled', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://gwvftrrknusdfdgiwuij.supabase.co';
    process.env.MOBILE_PILOT_MODE = 'disabled';
    delete process.env.MOBILE_PILOT_USER_IDS;

    const response = await middleware(new NextRequest('https://railcommand.io/api/mobile/v1/bootstrap', {
      headers: { authorization: 'Bearer intentionally-malformed', origin: 'capacitor://localhost' },
    }));

    assert.equal(response.status, 403);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.equal(response.headers.get('access-control-allow-origin'), 'capacitor://localhost');
    assert.deepEqual(await response.json(), {
      error: 'Mobile access is not enabled for this account.',
      retryable: false,
    });
  });

  it('blocks production mutations in read-only mode without calling the route', async () => {
    const userId = '10000000-0000-4000-8000-000000000001';
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://gwvftrrknusdfdgiwuij.supabase.co';
    process.env.MOBILE_PILOT_MODE = 'read-only';
    process.env.MOBILE_PILOT_USER_IDS = userId;

    const response = await middleware(new NextRequest('https://railcommand.io/api/mobile/v1/daily-logs/sync', {
      method: 'POST',
      headers: { authorization: `Bearer ${encode({ alg: 'none' })}.${encode({ sub: userId })}.synthetic` },
    }));

    assert.equal(response.status, 403);
    assert.match((await response.json()).error, /read-only/);
  });

  it('blocks every current production write workflow during the read-only pilot', async () => {
    const userId = '10000000-0000-4000-8000-000000000001';
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const authorization = `Bearer ${encode({ alg: 'none' })}.${encode({ sub: userId })}.synthetic`;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://gwvftrrknusdfdgiwuij.supabase.co';
    process.env.MOBILE_PILOT_MODE = 'read-only';
    process.env.MOBILE_PILOT_USER_IDS = userId;

    for (const path of [
      '/api/mobile/v1/records/create',
      '/api/mobile/v1/daily-logs/sync',
      '/api/mobile/v1/daily-logs/photos/prepare',
      '/api/mobile/v1/daily-logs/photos/finalize',
      '/api/mobile/v1/devices/push-token',
      '/api/mobile/v1/account/deletion-request',
      '/api/mobile/v1/account/deletion-request/cancel',
      '/api/mobile/v1/invitations/synthetic-token',
      '/api/mobile/v1/earthcam/embeds',
      '/api/mobile/v1/earthcam/embeds/delete',
    ]) {
      const response = await middleware(new NextRequest(`https://railcommand.io${path}`, {
        method: 'POST',
        headers: { authorization },
      }));
      assert.equal(response.status, 403, path);
      assert.deepEqual(await response.json(), {
        error: 'This mobile pilot is read-only. Saved field work remains on this device.',
        retryable: false,
      });
    }
  });
});
