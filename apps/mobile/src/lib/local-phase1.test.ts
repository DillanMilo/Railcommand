import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, it } from 'mocha';
import { createAuthCallbackUrl, parseConfiguredDeepLink } from './auth-links';

type ResolvedConfig = { name: string; scheme: string; ios: { bundleIdentifier: string; associatedDomains?: string[]; infoPlist: { NSLocalNetworkUsageDescription?: string }; entitlements?: object }; android: { package: string }; extra: { localPhase1?: boolean; eas?: { projectId: string } }; plugins: (string | string[])[] };

function appConfig(env: Record<string, string | undefined>) {
  const compiled = { exports: {} as { default?: (ctx: {config: Record<string, unknown>}) => ResolvedConfig } };
  const source = readFileSync(new URL('../../app.config.ts', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { module: compiled, exports: compiled.exports, process: { env } });
  return compiled.exports.default!({ config: { name: 'Synthetic config', slug: 'synthetic' } });
}
function nativeIntent(localPhase1: boolean) {
  const compiled = { exports: {} as { redirectSystemPath?: (ctx: { path: string; initial: boolean }) => string } };
  const source = readFileSync(new URL('../app/+native-intent.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { module: compiled, exports: compiled.exports, URL, require: () => ({ mobileConfig: { localPhase1, linkHost: 'mobile-staging.railcommand.io' } }) });
  return (path: string) => compiled.exports.redirectSystemPath!({ path, initial: true });
}

describe('local Phase1 app profile and links', () => {
  it('selects only the unique local identity/scheme with no associated domains, push plugin or EAS project', () => {
    const c = appConfig({ EXPO_PUBLIC_BUILD_PROFILE: 'development', MOBILE_LOCAL_PHASE1: '1' });
    assert.equal(c.name, 'RailCommand Phase1');
    assert.equal(c.ios.bundleIdentifier, 'io.railcommand.app.phase1');
    assert.equal(c.android.package, 'io.railcommand.app.phase1');
    assert.equal(c.scheme, 'railcommandphase1');
    assert.equal(c.ios.associatedDomains, undefined);
    assert.ok(c.ios.infoPlist.NSLocalNetworkUsageDescription);
    assert.equal(c.ios.entitlements, undefined);
    assert.equal(c.extra.localPhase1, true);
    assert.equal(c.extra.eas, undefined);
    assert.equal(c.plugins.some((p: string | string[]) => (Array.isArray(p) ? p[0] : p) === 'expo-notifications'), false);
    assert.ok(c.plugins.includes('./plugins/with-local-phase1-isolation'));
  });
  it('preserves all ordinary target identities and cloud/domain configuration', () => {
    for (const [profile, distribution, identifier, name] of [
      ['development', '', 'io.railcommand.app.dev', 'RailCommand Development'],
      ['staging', '', 'io.railcommand.app.staging', 'RailCommand Staging'],
      ['staging', 'beta', 'io.railcommand.app', 'RailCommand Beta'],
      ['production', '', 'io.railcommand.app', 'RailCommand'],
    ]) {
      const c = appConfig({ EXPO_PUBLIC_BUILD_PROFILE: profile, ...(distribution ? { MOBILE_DISTRIBUTION_TARGET: distribution } : {}) });
      assert.equal(c.name, name); assert.equal(c.ios.bundleIdentifier, identifier); assert.equal(c.scheme, 'railcommand');
      assert.ok(c.ios.associatedDomains?.length); assert.ok(c.extra.eas?.projectId); assert.equal(c.extra.localPhase1, undefined);
    }
  });
  it('rejects local opt-in for release/beta/staging profiles', () => {
    for (const env of [
      { EXPO_PUBLIC_BUILD_PROFILE: 'staging' }, { EXPO_PUBLIC_BUILD_PROFILE: 'production' },
      { EXPO_PUBLIC_BUILD_PROFILE: 'development', MOBILE_DISTRIBUTION_TARGET: 'beta' },
    ]) assert.throws(() => appConfig({ ...env, MOBILE_LOCAL_PHASE1: '1' }));
  });
  it('normalizes only the local scheme, preserving normal verified links', () => {
    const local = { localPhase1: true, linkHost: '192.168.1.100' };
    assert.equal(createAuthCallbackUrl(local).toString(), 'railcommandphase1://auth/callback');
    assert.equal(parseConfiguredDeepLink('railcommandphase1://auth/callback?code=local', local).kind, 'auth_callback');
    for (const raw of ['railcommand://auth/callback?code=x', 'https://railcommand.io/auth/callback?code=x',
      'railcommandphase1://user@auth/callback?code=x', 'railcommandphase1://auth:443/callback?code=x',
      'railcommandphase1://auth/callback/other?code=x']) assert.equal(parseConfiguredDeepLink(raw, local).kind, 'unsupported');
    assert.equal(createAuthCallbackUrl({ linkHost: 'mobile-staging.railcommand.io' }).toString(), 'https://mobile-staging.railcommand.io/auth/callback');
    assert.equal(parseConfiguredDeepLink('railcommand://auth/callback?code=old', { linkHost: 'mobile-staging.railcommand.io' }).kind, 'auth_callback');
  });
  it('routes the local scheme without claiming old app/universal callbacks', () => {
    const local = nativeIntent(true);
    assert.equal(local('railcommandphase1://auth/callback?token_hash=local&type=invite'), '/auth/callback?token_hash=local&type=invite');
    for (const path of ['railcommand://auth/callback?code=x', 'https://mobile-staging.railcommand.io/auth/callback?code=x', '//railcommand.io/auth/callback?code=x']) assert.equal(local(path), '/');
    assert.equal(nativeIntent(false)('railcommand://auth/callback?code=old'), '/auth/callback?code=old');
    assert.equal(nativeIntent(false)('https://mobile-staging.railcommand.io/?code=legacy'), '/auth/callback?code=legacy&type=recovery&next=%2Freset-password');
  });
});
