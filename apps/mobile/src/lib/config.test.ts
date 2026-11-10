import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { validateExpoMobileConfig } from './config-guard';

const valid = {
  profile: 'development',
  supabaseUrl: 'https://stage-ref.supabase.co',
  publishableKey: 'sb_publishable_mobile',
  apiBaseUrl: 'https://mobile-stage.example.com',
  expectedSupabaseProjectRef: 'stage-ref',
  expectedApiHost: 'mobile-stage.example.com',
  linkHost: 'mobile-staging.railcommand.io',
  blockedSupabaseProjectRefs: 'production-ref',
  blockedApiHosts: 'railcommand.io',
};

describe('Expo mobile environment boundary', () => {
  it('accepts an isolated development inventory', () => {
    assert.equal(validateExpoMobileConfig(valid).profile, 'development');
  });

  it('rejects production services from a development build', () => {
    assert.throws(() => validateExpoMobileConfig({
      ...valid,
      expectedSupabaseProjectRef: 'production-ref',
      supabaseUrl: 'https://production-ref.supabase.co',
    }));
  });

  it('rejects the checked-in production inventory even when the environment denylist is omitted', () => {
    assert.throws(() => validateExpoMobileConfig({
      ...valid,
      blockedSupabaseProjectRefs: undefined,
      blockedApiHosts: undefined,
      expectedSupabaseProjectRef: 'gwvftrrknusdfdgiwuij',
      supabaseUrl: 'https://gwvftrrknusdfdgiwuij.supabase.co',
    }), /cannot use production services/);
  });

  it('rejects production runtime labels on debug, simulator, emulator, or unverified builds', () => {
    const production = { ...valid, profile: 'production', linkHost: 'railcommand.io' };
    for (const runtime of [
      undefined,
      { isDebug: true, isPhysicalDevice: true, nativeProfile: 'production' },
      { isDebug: false, isPhysicalDevice: false, nativeProfile: 'production' },
      { isDebug: false, isPhysicalDevice: true, nativeProfile: 'staging' },
      { isDebug: false, isPhysicalDevice: true, nativeProfile: undefined },
    ]) {
      assert.throws(() => validateExpoMobileConfig(production, runtime),
        { message: 'Production services require an explicitly configured physical-device release' });
    }
  });

  it('retains explicit physical release support and staging beta simulator support', () => {
    assert.equal(validateExpoMobileConfig({ ...valid, profile: 'production', linkHost: 'railcommand.io' },
      { isDebug: false, isPhysicalDevice: true, nativeProfile: 'production' }).profile, 'production');
    assert.equal(validateExpoMobileConfig({ ...valid, profile: 'staging' },
      { isDebug: false, isPhysicalDevice: false, nativeProfile: 'staging' }).profile, 'staging');
  });

  it('allows an explicit loopback Supabase and API only for development', () => {
    const local = {
      ...valid,
      supabaseUrl: 'http://127.0.0.1:54321',
      expectedSupabaseProjectRef: 'local',
      apiBaseUrl: 'http://localhost:3000',
      expectedApiHost: 'localhost',
    };
    assert.equal(validateExpoMobileConfig(local).expectedSupabaseProjectRef, 'local');
    assert.throws(() => validateExpoMobileConfig({ ...local, profile: 'staging' }));
  });

  it('rejects cleartext Supabase and mobile API services', () => {
    assert.throws(() => validateExpoMobileConfig({
      ...valid,
      apiBaseUrl: 'http://mobile-stage.example.com',
    }));
    assert.throws(() => validateExpoMobileConfig({
      ...valid,
      supabaseUrl: 'http://stage-ref.supabase.co',
    }));
  });

  it('rejects server credentials', () => {
    assert.throws(() => validateExpoMobileConfig({ ...valid, publishableKey: 'service_role_secret' }));
  });

  it('rejects a production link host from a development build', () => {
    assert.throws(() => validateExpoMobileConfig({ ...valid, linkHost: 'railcommand.io' }));
  });
});


const localRuntime = { isDebug: false, isPhysicalDevice: true, nativeProfile: 'development',
  nativeLocalPhase1: true, nativeApplicationId: 'io.railcommand.app.phase1' };
const localPhase1 = { ...valid, localPhase1: '1',
  supabaseUrl: 'https://192.168.1.100:44321/supabase', expectedSupabaseProjectRef: 'local',
  apiBaseUrl: 'https://192.168.1.100:44321', expectedApiHost: '192.168.1.100',
  easProjectId: 'must-not-register-cloud', linkHost: undefined };

describe('separate local Phase1 device boundary', () => {
  it('accepts one private HTTPS origin with an independently bundled identity and no cloud ID', () => {
    const config = validateExpoMobileConfig(localPhase1, localRuntime);
    assert.equal(config.localPhase1, true);
    assert.equal(config.authScheme, 'railcommandphase1');
    assert.equal(config.easProjectId, null);
    assert.equal(config.expectedSupabaseProjectRef, 'local');
    assert.equal(config.linkHost, '192.168.1.100');
  });
  it('rejects an environment-only opt-in or a different installed application', () => {
    for (const runtime of [undefined, { ...localRuntime, nativeLocalPhase1: false },
      { ...localRuntime, nativeApplicationId: 'io.railcommand.app.dev' },
      { ...localRuntime, nativeApplicationId: 'io.railcommand.app' },
      { ...localRuntime, nativeProfile: 'staging' }]) {
      assert.throws(() => validateExpoMobileConfig(localPhase1, runtime));
    }
    assert.throws(() => validateExpoMobileConfig({ ...localPhase1, localPhase1: undefined }, localRuntime));
    for (const profile of ['staging', 'production']) assert.throws(() => validateExpoMobileConfig({ ...localPhase1, profile }, localRuntime));
  });
  it('retains ordinary hosted and loopback profiles without promoting them to Phase1', () => {
    assert.equal(validateExpoMobileConfig(valid).localPhase1, false);
    assert.equal(validateExpoMobileConfig(valid).authScheme, 'railcommand');
    assert.throws(() => validateExpoMobileConfig({ ...localPhase1, localPhase1: undefined }));
  });
  it('allows RFC1918 ranges and rejects public, loopback, link-local, multicast and DNS targets', () => {
    for (const host of ['10.2.3.4', '172.16.0.2', '172.31.255.254', '192.168.9.8']) {
      assert.equal(validateExpoMobileConfig({ ...localPhase1, expectedApiHost: host,
        apiBaseUrl: `https://${host}:44321`, supabaseUrl: `https://${host}:44321/supabase` }, localRuntime).localPhase1, true);
    }
    for (const host of ['8.8.8.8', '127.0.0.1', '169.254.1.1', '172.15.0.2', '172.32.0.2', '224.0.0.1', 'private.example.com', '192.168.1.100.example.com']) {
      assert.throws(() => validateExpoMobileConfig({ ...localPhase1, expectedApiHost: host,
        apiBaseUrl: `https://${host}:44321`, supabaseUrl: `https://${host}:44321/supabase` }, localRuntime));
    }
  });
  it('rejects cleartext, mixed origin/port, user info, query, fragment and extra paths', () => {
    const invalid = [
      { apiBaseUrl: 'http://192.168.1.100:44321' }, { supabaseUrl: 'http://192.168.1.100:44321/supabase' },
      { apiBaseUrl: 'https://192.168.1.101:44321' }, { apiBaseUrl: 'https://192.168.1.100:44322' },
      { expectedApiHost: '192.168.1.101' }, { expectedSupabaseProjectRef: 'production-ref' },
      { apiBaseUrl: 'https://user:password@192.168.1.100:44321' },
      { supabaseUrl: 'https://user@192.168.1.100:44321/supabase' },
      { apiBaseUrl: 'https://192.168.1.100:44321/?token=x' },
      { supabaseUrl: 'https://192.168.1.100:44321/supabase#x' },
      { apiBaseUrl: 'https://192.168.1.100:44321/elsewhere' },
      { supabaseUrl: 'https://192.168.1.100:44321/supabase/other' },
    ];
    for (const input of invalid) assert.throws(() => validateExpoMobileConfig({ ...localPhase1, ...input }, localRuntime), JSON.stringify(input));
  });
  it('requires a public key and rejects server JWT roles and a blocked private host', () => {
    const key = (role: string) => `header.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
    assert.equal(validateExpoMobileConfig({ ...localPhase1, publishableKey: key('anon') }, localRuntime).localPhase1, true);
    for (const publishableKey of ['sb_secret_test', key('service_role'), key('authenticated'), 'not-a-public-key']) {
      assert.throws(() => validateExpoMobileConfig({ ...localPhase1, publishableKey }, localRuntime));
    }
    assert.throws(() => validateExpoMobileConfig({ ...localPhase1, blockedApiHosts: '192.168.1.100' }, localRuntime));
  });
});
