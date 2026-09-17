import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { createClient, type User } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import * as ticketModule from './workspace-ticket';
import * as pilotModule from './pilot-gate';
import { mobileJson, mobileOptions } from './auth';
const userId = '10000000-0000-4000-8000-000000000001';
const otherId = '10000000-0000-4000-8000-000000000002';
const secret = 'synthetic-server-secret-for-route-tests-only';
const jwt = (id: string) => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now()/1000)+3600, aud: 'authenticated', role: 'authenticated' })).toString('base64url')}.synthetic`;
function harness(options: { user?: Partial<User>; disabled?: boolean; allow?: string; generatedId?: string; exchangedId?: string; exchangeMfa?: boolean } = {}) {
  const user = { id: userId, aud: 'authenticated', email: 'workspace-qa@example.invalid', email_confirmed_at: '2026-09-17T00:00:00Z', created_at: '2026-09-17T00:00:00Z', app_metadata: {}, user_metadata: {}, factors: [], ...options.user } as User;
  const calls: string[] = [];
  let consumed = false;
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    const pathname = new URL(request.url).pathname;
    calls.push(pathname);
    if (pathname === '/auth/v1/admin/generate_link') {
      assert.deepEqual(await request.json(), { type: 'magiclink', email: user.email });
      assert.equal(request.headers.get('authorization'), `Bearer ${secret}`);
      return Response.json({ ...user, id: options.generatedId ?? user.id, action_link: 'https://unused.example/never-returned', hashed_token: 'synthetic-otp', verification_type: 'magiclink', redirect_to: 'https://railcommand.io' });
    }
    if (pathname === '/auth/v1/verify') {
      const body = await request.json();
      assert.equal(body.token_hash, 'synthetic-otp'); assert.equal(body.type, 'email');
      if (consumed) return Response.json({ msg: 'Expired or already used', code: 'otp_expired' }, { status: 403 });
      consumed = true;
      const id = options.exchangedId ?? user.id;
      return Response.json({ access_token: jwt(id), refresh_token: 'independent-web-refresh-token', token_type: 'bearer', expires_in: 3600, user: { ...user, id, factors: options.exchangeMfa ? [{ id: 'factor', status: 'verified', factor_type: 'totp' }] : user.factors } });
    }
    if (pathname === '/auth/v1/user') {
      if (request.headers.get('authorization') !== `Bearer ${jwt(userId)}`) return Response.json({ msg: 'Invalid JWT' }, { status: 401 });
      return Response.json(user);
    }
    throw new Error(`Unexpected request: ${pathname}`);
  };
  const environment = { SUPABASE_SERVICE_ROLE_KEY: secret, NEXT_PUBLIC_SUPABASE_URL: 'https://gwvftrrknusdfdgiwuij.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-key', MOBILE_WORKSPACE_ENABLED: options.disabled ? 'false' : 'true', MOBILE_PILOT_MODE: 'read-write', MOBILE_PILOT_USER_IDS: options.allow ?? userId };
  const client = (key: string) => createClient(environment.NEXT_PUBLIC_SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: fetcher } });
  const load = (file: string) => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const exports: { POST?: (request: Request) => Promise<Response> } = {};
    const dependencies: Record<string, unknown> = {
      '@/lib/mobile-api/auth': { mobileJson, mobileOptions, authenticateMobileRequest: async (request: Request) => {
        const accessToken = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
        if (!accessToken) return null;
        const supabase = client('synthetic-public-key');
        const { data, error } = await supabase.auth.getUser(accessToken);
        return error || !data.user ? null : { user: data.user, supabase, accessToken };
      } },
      '@/lib/mobile-api/pilot-gate': pilotModule,
      '@/lib/mobile-api/workspace-ticket': ticketModule,
      '@/lib/supabase/admin': { createAdminClient: () => client(secret) },
      '@/lib/supabase/connectivity': { fetchWithTimeout: fetcher },
      '@supabase/ssr': { createServerClient }, 'next/server': { NextResponse },
    };
    runInNewContext(js, { exports, require: (name: string) => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; }, process: { env: environment }, URL, URLSearchParams, Request, Response, Buffer });
    return exports.POST!;
  };
  const issue = load('../../app/api/mobile/v1/web-session/route.ts');
  const exchange = load('../../app/auth/mobile-session/route.ts');
  const issueRequest = (authorization: string | null = `Bearer ${jwt(userId)}`) => new Request('https://railcommand.io/api/mobile/v1/web-session', { method: 'POST', headers: { ...(authorization ? { authorization } : {}), 'content-type': 'application/json' }, body: JSON.stringify({ path: '/projects/synthetic/daily-logs' }) });
  const exchangeRequest = (ticket: string) => new Request('https://railcommand.io/auth/mobile-session', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ticket }) });
  return { issue, exchange, issueRequest, exchangeRequest, calls, environment };
}
describe('workspace routes with real Supabase client transport', () => {
  it('exchanges a verified identity into separate cookies once, without project or mail requests', async () => {
    const h = harness();
    const response = await h.issue(h.issueRequest());
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control')!, /no-store/);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['ticket', 'userId']);
    assert.equal(body.userId, userId);
    assert.ok(!JSON.stringify(body).includes('refresh'));
    const result = await h.exchange(h.exchangeRequest(body.ticket));
    assert.equal(result.status, 303);
    assert.equal(result.headers.get('location'), 'https://railcommand.io/projects/synthetic/daily-logs');
    const cookies = result.headers.get('set-cookie')!;
    assert.match(cookies, /sb-gwvftrrknusdfdgiwuij-auth-token/);
    assert.match(cookies, /rc-remember=true/);
    assert.match(cookies, /Secure/); assert.match(cookies, /SameSite=lax/i);
    assert.equal((await h.exchange(h.exchangeRequest(body.ticket))).status, 403);
    assert.deepEqual(h.calls, ['/auth/v1/user', '/auth/v1/admin/generate_link', '/auth/v1/verify', '/auth/v1/verify']);
  });
  it('rejects missing/invalid authentication before issuing anything', async () => {
    for (const auth of [null, 'Bearer invalid']) {
      const h = harness(); assert.equal((await h.issue(h.issueRequest(auth))).status, 401);
      assert.ok(!h.calls.includes('/auth/v1/admin/generate_link'));
    }
  });
  it('fails closed for disabled, nonpilot, anonymous, unconfirmed and MFA accounts', async () => {
    for (const options of [{ disabled: true }, { allow: otherId }, { user: { email_confirmed_at: undefined } }, { user: { is_anonymous: true } }, { user: { factors: [{ id: 'factor', status: 'verified', factor_type: 'totp', created_at: '', updated_at: '' }] as User['factors'] } }]) {
      const h = harness(options); assert.equal((await h.issue(h.issueRequest())).status, 403);
      assert.ok(!h.calls.includes('/auth/v1/admin/generate_link'));
    }
  });
  it('rejects a changed generated identity and never returns its link', async () => {
    const h = harness({ generatedId: otherId }); const response = await h.issue(h.issueRequest());
    assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('ticket'));
  });
  it('withholds all cookies when exchange identity, pilot permission or MFA changed', async () => {
    for (const options of [{ exchangedId: otherId }, { exchangeMfa: true }, {}]) {
      const h = harness(options);
      const { ticket } = await (await h.issue(h.issueRequest())).json();
      if (Object.keys(options).length === 0) h.environment.MOBILE_PILOT_USER_IDS = otherId;
      const result = await h.exchange(h.exchangeRequest(ticket));
      assert.equal(result.status, 403); assert.equal(result.headers.get('set-cookie'), null);
    }
  });
});
