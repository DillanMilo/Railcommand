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
