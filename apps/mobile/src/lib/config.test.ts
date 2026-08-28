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
