import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'mocha';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import { recoveryConfirmationCookieName, RECOVERY_CONFIRMATION_HEADER } from './recovery-confirmation';

describe('password recovery before organization onboarding', () => {
  const originalFetch = globalThis.fetch;
  const keys = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'US_ONLY_ACCESS_ENABLED', 'IP_REPUTATION_ENABLED'] as const;
  const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const user = { id: '10000000-0000-4000-8000-000000000001', email: 'recovery@railcommand.test' };
  let profileQueries = 0;
  let cookie: string;

  before(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://recovery-qa.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon-key';
    process.env.US_ONLY_ACCESS_ENABLED = 'false';
    process.env.IP_REPUTATION_ENABLED = 'false';
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const session = {
      access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: user.id, exp: expiresAt })}.synthetic`,
      refresh_token: 'synthetic-refresh-token', token_type: 'bearer', expires_at: expiresAt, user,
    };
    cookie = `rc-remember=true; sb-recovery-qa-auth-token=base64-${encode(session)}`;
    globalThis.fetch = async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      assert.equal(url.origin, 'https://recovery-qa.supabase.co');
      if (url.pathname === '/auth/v1/user') return Response.json(user);
      if (url.pathname === '/rest/v1/profiles') {
        profileQueries++;
        return Response.json({ organization_id: null });
      }
      if (url.pathname === '/rest/v1/project_members') {
        return new Response(null, { headers: { 'content-range': '*/0' } });
      }
      throw new Error(`Unexpected service request: ${url.pathname}`);
    };
  });

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://recovery-qa.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'synthetic-anon-key';
    profileQueries = 0;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  for (const [path, method] of [
    ['/auth/callback?token_hash=synthetic&type=recovery', 'GET'],
    ['/auth/recovery?token_hash=synthetic', 'GET'],
    ['/auth/recovery/confirm', 'POST'],
    ['/reset-password', 'GET'],
    ['/api/auth/password-reset', 'POST'],
    ['/api/auth/password-reset', 'DELETE'],
  ]) {
    it(`allows ${method} ${path} without organization onboarding`, async () => {
      const response = await middleware(new NextRequest(`https://railcommand.io${path}`, {
        method, headers: { cookie },
      }));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('location'), null);
      assert.equal(profileQueries, 0);
    });
  }

  it('lets the confirmation and callback routes load without a Supabase session lookup', async () => {
    const fetchBefore = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('Auth network unavailable'); };
    try {
      for (const path of ['/auth/callback', '/auth/recovery', '/auth/recovery/confirm']) {
        const r = await middleware(new NextRequest(`https://railcommand.io${path}`));
        assert.equal(r.status, 200);
      }
    } finally {
      globalThis.fetch = fetchBefore;
    }
  });

  it('pairs a fresh form nonce with a private first-party cookie and ignores a forged request header', async () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const response = await middleware(new NextRequest('https://railcommand.io/auth/recovery?token_hash=synthetic', {
        headers: { [RECOVERY_CONFIRMATION_HEADER]: 'attacker-controlled' },
      }));
      const cookie = response.cookies.get(recoveryConfirmationCookieName());
      assert.ok(cookie?.httpOnly);
      assert.equal(cookie.sameSite, 'strict');
      assert.equal(cookie.path, '/');
      assert.equal(cookie.maxAge, 900);
      assert.match(cookie.value, /^[a-f0-9]{64}$/);
      assert.equal(response.headers.get(`x-middleware-request-${RECOVERY_CONFIRMATION_HEADER}`), cookie.value);
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      seen.add(cookie.value);
    }
    assert.equal(seen.size, 2);
  });

  it('still requires organization onboarding for project work', async () => {
    const response = await middleware(new NextRequest('https://railcommand.io/projects', { headers: { cookie } }));
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), 'https://railcommand.io/onboarding?next=%2Fprojects');
    assert.equal(profileQueries, 1);
  });
});
