import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { parseMobileDeepLink } from '@railcommand/domain';

type AuthCall = { method: string; args: unknown[] };

// Execute the shipped callback implementation with a deterministic auth service.
// Native dependencies are replaced; no device credentials or emails are involved.
function callbackHarness(error: Error | null = null) {
  const calls: AuthCall[] = [];
  const auth = Object.fromEntries(['exchangeCodeForSession', 'verifyOtp', 'setSession'].map((method) => [method,
    async (...args: unknown[]) => { calls.push({ method, args }); return { error }; },
  ]));
  const compiled = { exports: {} as Record<string, unknown> };
  const source = readFileSync(new URL('./deep-links.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, URL, URLSearchParams,
    require(name: string) {
      if (name === '@railcommand/domain') return { parseMobileDeepLink };
      if (name === './supabase') return { supabase: { auth } };
      if (name === './config') return { mobileConfig: { linkHost: 'railcommand.io' } };
      throw new Error(`Unexpected recovery dependency: ${name}`);
    },
  });
  return { calls, consume: compiled.exports.consumeAuthCallback as (url: string) => Promise<string> };
}

describe('native recovery callback behavior', () => {
  it('exchanges a PKCE code once and opens password reset', async () => {
    const h = callbackHarness();
    assert.equal(await h.consume('https://railcommand.io/auth/callback?code=synthetic-code&type=recovery&next=%2Freset-password'), 'password-reset');
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].method, 'exchangeCodeForSession');
    assert.deepEqual(h.calls[0].args, ['synthetic-code']);
  });

  it('accepts the token-hash recovery links produced by the web app', async () => {
    const h = callbackHarness();
    assert.equal(await h.consume('https://railcommand.io/auth/callback?token_hash=synthetic-hash&type=recovery&next=%2Freset-password'), 'password-reset');
    assert.equal(h.calls[0].method, 'verifyOtp');
    assert.equal(JSON.stringify(h.calls[0].args), JSON.stringify([{ token_hash: 'synthetic-hash', type: 'recovery' }]));
  });

  it('retains recovery routing for legacy session-fragment links', async () => {
    const h = callbackHarness();
    assert.equal(await h.consume('railcommand://auth/callback#access_token=synthetic-access&refresh_token=synthetic-refresh&type=recovery'), 'password-reset');
    assert.equal(h.calls[0].method, 'setSession');
  });

  it('keeps normal sign-in callbacks on the authenticated route', async () => {
    const h = callbackHarness();
    assert.equal(await h.consume('https://railcommand.io/auth/callback?code=synthetic-code'), 'authenticated');
  });

  it('rejects missing credentials without trying to authenticate', async () => {
    const h = callbackHarness();
    await assert.rejects(h.consume('railcommand://auth/callback?type=recovery'), /missing credentials/);
    assert.equal(h.calls.length, 0);
  });

  for (const message of ['Recovery link expired', 'PKCE code verifier not found', 'Network request failed']) {
    it(`surfaces ${message} instead of opening the reset form`, async () => {
      const h = callbackHarness(new Error(message));
      await assert.rejects(h.consume('https://railcommand.io/auth/callback?code=synthetic-code&type=recovery'), { message });
      assert.equal(h.calls.length, 1);
    });
  }
});
