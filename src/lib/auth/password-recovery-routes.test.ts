import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import { NextResponse } from 'next/server';
import ts from 'typescript';
import * as crypto from 'node:crypto';

const userId = '10000000-0000-4000-8000-000000000002';
type AuthResult = { data: { user: { id: string } | null; session: object | null }; error: { code?: string; status?: number } | null };

// Run the real route handlers and signing helper with an isolated auth service.
// No network, production secret, email, or human account is used by these tests.
function harness(result: AuthResult = { data: { user: { id: userId }, session: { user: { id: userId } } }, error: null }, throws = false) {
  const calls: { method: string; args: unknown }[] = [];
  const auth = Object.fromEntries(['verifyOtp', 'exchangeCodeForSession'].map((method) => [method, async (args: unknown) => {
    calls.push({ method, args });
    if (throws) throw new Error('Network unavailable');
    return result;
  }]));
  const cache = new Map<string, Record<string, unknown>>();
  const load = (path: string): Record<string, unknown> => {
    const cached = cache.get(path);
    if (cached) return cached;
    const compiled = { exports: {} as Record<string, unknown> };
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    runInNewContext(outputText, {
      module: compiled, exports: compiled.exports, URL, Date, Buffer,
      process: { env: { NODE_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: 'isolated-test-signing-secret' } },
      require(name: string) {
        if (name === 'server-only') return {};
        if (name === 'node:crypto') return crypto;
        if (name === 'next/server') return { NextResponse };
        if (name === '@/lib/supabase/server') return { createClient: async () => ({ auth }) };
        if (name === '@/lib/demo/session-cookie') return { DEMO_SESSION_COOKIE: 'rc-demo-session', DEMO_SLUG_COOKIE: 'rc-demo-slug' };
        if (name === '@/lib/auth/password-recovery') return load('./password-recovery.ts');
        if (name === '@/lib/auth/callback-response') return load('./callback-response.ts');
        throw new Error(`Unexpected route dependency: ${name}`);
      },
    });
    cache.set(path, compiled.exports);
    return compiled.exports;
  };
  const GET = load('../../app/auth/callback/route.ts').GET as (r: Request) => Promise<NextResponse>;
  const POST = load('../../app/auth/recovery/confirm/route.ts').POST as (r: Request) => Promise<NextResponse>;
  const validCookie = load('./password-recovery.ts').isValidPasswordRecoveryToken as (t: string, id: string) => boolean;
  return { calls, GET, POST, validCookie };
}

const origin = 'https://railcommand.io';
function confirmation(token = 'synthetic-recovery-hash', requestOrigin: string | null = origin) {
  return new Request(`${origin}/auth/recovery/confirm`, {
    method: 'POST', headers: requestOrigin === null ? {} : { origin: requestOrigin },
    body: new URLSearchParams({ token_hash: token, type: 'invite', next: 'https://untrusted.example' }),
  });
}
function assertPrivate(response: NextResponse) {
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
}

describe('recovery browser confirmation and native callback compatibility', () => {
  it('does not spend a recovery token on repeated email scanner GETs', async () => {
    const h = harness();
    for (let i = 0; i < 3; i++) {
      const r = await h.GET(new Request(`${origin}/auth/callback?token_hash=synthetic-recovery-hash&type=recovery&next=https://untrusted.example`));
      assert.equal(r.status, 307);
      assert.equal(r.headers.get('location'), `${origin}/auth/recovery?token_hash=synthetic-recovery-hash`);
      assert.equal(r.cookies.get('rc-password-recovery'), undefined);
      assertPrivate(r);
    }
    assert.equal(h.calls.length, 0);
  });

  it('verifies only recovery on a same-origin POST and binds the cookie to the returned user', async () => {
    const h = harness();
    const r = await h.POST(confirmation());
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), `${origin}/reset-password`);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].method, 'verifyOtp');
    assert.equal(JSON.stringify(h.calls[0].args), JSON.stringify({ token_hash: 'synthetic-recovery-hash', type: 'recovery' }));
    const cookie = r.cookies.get('rc-password-recovery');
    assert.ok(cookie?.httpOnly && cookie.secure);
    assert.equal(cookie.maxAge, 900);
    assert.equal(h.validCookie(cookie.value, userId), true);
    assert.equal(h.validCookie(cookie.value, 'another-user'), false);
    assert.equal(r.cookies.get('rc-demo-session')?.value, '');
    assertPrivate(r);
  });

  for (const requestOrigin of [null, 'null', 'https://untrusted.example', 'https://railcommand.io.untrusted.example']) {
    it(`rejects origin ${requestOrigin} without consuming a token`, async () => {
      const h = harness();
      const r = await h.POST(confirmation('synthetic-hash', requestOrigin));
      assert.equal(r.status, 403);
      assert.equal(h.calls.length, 0);
      assertPrivate(r);
    });
  }

  for (const token of ['', 'x'.repeat(1025)]) {
    it(`rejects an invalid token length (${token.length}) before verification`, async () => {
      const h = harness();
      const r = await h.POST(confirmation(token));
      assert.match(r.headers.get('location') ?? '', /recovery_link_invalid/);
      assert.equal(h.calls.length, 0);
    });
  }

  it('rejects a malformed form without authentication', async () => {
    const h = harness();
    const r = await h.POST(new Request(`${origin}/auth/recovery/confirm`, { method: 'POST', headers: { origin }, body: '{' }));
    assert.equal(r.status, 400);
    assert.equal(h.calls.length, 0);
  });

  it('rejects an expired or already consumed token without a recovery cookie', async () => {
    const h = harness({ data: { user: null, session: null }, error: { code: 'otp_expired', status: 403 } });
    const r = await h.POST(confirmation());
    assert.equal(r.status, 303);
    assert.equal(r.headers.get('location'), `${origin}/login?error=recovery_link_invalid`);
    assert.equal(r.cookies.get('rc-password-recovery'), undefined);
  });

  for (const status of [0, 429, 500, 503]) {
    it(`preserves the link for retry on transient service status ${status}`, async () => {
      const h = harness({ data: { user: null, session: null }, error: { status } });
      const r = await h.POST(confirmation());
      const url = new URL(r.headers.get('location')!);
      assert.equal(url.pathname, '/auth/recovery');
      assert.equal(url.searchParams.get('token_hash'), 'synthetic-recovery-hash');
      assert.equal(url.searchParams.get('error'), 'temporarily_unavailable');
      assert.equal(r.cookies.get('rc-password-recovery'), undefined);
      assertPrivate(r);
    });
  }

  it('preserves the link when the network throws', async () => {
    const h = harness(undefined, true);
    const r = await h.POST(confirmation());
    assert.match(r.headers.get('location') ?? '', /temporarily_unavailable/);
  });

  it('does not grant a recovery cookie without a verified session and user', async () => {
    const h = harness({ data: { user: { id: userId }, session: null }, error: null });
    const r = await h.POST(confirmation());
    assert.match(r.headers.get('location') ?? '', /temporarily_unavailable/);
    assert.equal(r.cookies.get('rc-password-recovery'), undefined);
  });

  it('explains legacy PKCE links opened in a different browser', async () => {
    const h = harness({ data: { user: null, session: null }, error: { code: 'pkce_code_verifier_not_found', status: 400 } });
    const r = await h.GET(new Request(`${origin}/auth/callback?code=legacy-code&type=recovery`));
    assert.equal(r.headers.get('location'), `${origin}/login?error=recovery_browser_mismatch`);
  });

  it('retains legacy recovery in the originating PKCE browser', async () => {
    const h = harness();
    const r = await h.GET(new Request(`${origin}/auth/callback?code=legacy-code&type=recovery`));
    assert.equal(r.headers.get('location'), `${origin}/reset-password`);
    assert.equal(h.calls[0].method, 'exchangeCodeForSession');
    assert.ok(r.cookies.get('rc-password-recovery'));
  });

  it('keeps OAuth sign-in and signup confirmation working', async () => {
    const h = harness();
    const oauth = await h.GET(new Request(`${origin}/auth/callback?code=oauth-code`));
    assert.equal(oauth.headers.get('location'), `${origin}/dashboard`);
    assert.equal(oauth.cookies.get('rc-password-recovery')?.value, '');
    const signup = await h.GET(new Request(`${origin}/auth/callback?token_hash=signup-hash&type=signup`));
    assert.equal(signup.headers.get('location'), `${origin}/onboarding`);
    assert.equal(signup.cookies.get('rc-password-recovery')?.value, '');
    assert.equal(h.calls.length, 2);
  });

  it('uses the callback supported by installed clients in the Supabase SMTP template', () => {
    const template = readFileSync(new URL('../../../supabase/templates/recovery.html', import.meta.url), 'utf8');
    assert.match(template, /\{\{ \.SiteURL \}\}\/auth\/callback\?token_hash=\{\{ \.TokenHash \}\}&amp;type=recovery&amp;next=\/reset-password/);
    assert.doesNotMatch(template, /\.ConfirmationURL|24 hours/);
    assert.match(template, /1 hour/);
  });
});
