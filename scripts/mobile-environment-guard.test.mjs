import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validateMobileEnvironment } from './mobile-environment-guard.mjs';

const safeEnvironment = {
  MOBILE_BUILD_PROFILE: 'development',
  MOBILE_APP_ID: 'io.railcommand.app.dev',
  MOBILE_EXPECTED_APP_ID: 'io.railcommand.app.dev',
  NEXT_PUBLIC_SUPABASE_URL: 'https://stagingref.supabase.co',
  MOBILE_EXPECTED_SUPABASE_PROJECT_REF: 'stagingref',
  MOBILE_BLOCKED_SUPABASE_PROJECT_REFS: 'productionref',
  NEXT_PUBLIC_APP_URL: 'https://staging.railcommand.test',
  MOBILE_EXPECTED_APP_HOST: 'staging.railcommand.test',
  MOBILE_BLOCKED_APP_HOSTS: 'railcommand.io,www.railcommand.io',
};

test('accepts the exact approved staging environment', () => {
  assert.deepEqual(validateMobileEnvironment(safeEnvironment), {
    profile: 'development',
    appId: 'io.railcommand.app.dev',
    supabaseProjectRef: 'stagingref',
    appHost: 'staging.railcommand.test',
  });
});

test('the CLI reports only a profile-level result, never service inventory values', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./mobile-environment-guard.mjs', import.meta.url))], {
    env: { ...process.env, ...safeEnvironment }, encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /development build profile/);
  assert.doesNotMatch(result.stdout + result.stderr, /stagingref|staging\.railcommand\.test|productionref/);
});

test('rejects the production mobile app identifier', () => {
  assert.throws(
    () =>
      validateMobileEnvironment({
        ...safeEnvironment,
        MOBILE_APP_ID: 'io.railcommand.app',
        MOBILE_EXPECTED_APP_ID: 'io.railcommand.app',
      }),
    /development mobile builds must use io\.railcommand\.app\.dev/
  );
});

test('accepts an isolated staging application identifier with staging services', () => {
  assert.deepEqual(validateMobileEnvironment({
    ...safeEnvironment,
    MOBILE_BUILD_PROFILE: 'staging',
    MOBILE_APP_ID: 'io.railcommand.app.staging',
    MOBILE_EXPECTED_APP_ID: 'io.railcommand.app.staging',
  }), {
    profile: 'staging',
    appId: 'io.railcommand.app.staging',
    supabaseProjectRef: 'stagingref',
    appHost: 'staging.railcommand.test',
  });
});

test('production fails closed without an explicit release authorization', () => {
  assert.throws(() => validateMobileEnvironment({
    ...safeEnvironment,
    MOBILE_BUILD_PROFILE: 'production',
    MOBILE_APP_ID: 'io.railcommand.app',
    MOBILE_EXPECTED_APP_ID: 'io.railcommand.app',
    NEXT_PUBLIC_SUPABASE_URL: 'https://productionref.supabase.co',
    MOBILE_EXPECTED_SUPABASE_PROJECT_REF: 'productionref',
    NEXT_PUBLIC_APP_URL: 'https://railcommand.io',
    MOBILE_EXPECTED_APP_HOST: 'railcommand.io',
  }), /explicit release authorization/);
});

test('accepts production only when identifiers, inventory, and authorization agree', () => {
  assert.deepEqual(validateMobileEnvironment({
    ...safeEnvironment,
    MOBILE_BUILD_PROFILE: 'production',
    MOBILE_APP_ID: 'io.railcommand.app',
    MOBILE_EXPECTED_APP_ID: 'io.railcommand.app',
    MOBILE_ALLOW_PRODUCTION_BUILD: 'release-authorized',
    NEXT_PUBLIC_SUPABASE_URL: 'https://productionref.supabase.co',
    MOBILE_EXPECTED_SUPABASE_PROJECT_REF: 'productionref',
    NEXT_PUBLIC_APP_URL: 'https://railcommand.io',
    MOBILE_EXPECTED_APP_HOST: 'railcommand.io',
  }), {
    profile: 'production',
    appId: 'io.railcommand.app',
    supabaseProjectRef: 'productionref',
    appHost: 'railcommand.io',
  });
});

test('rejects a production Supabase project even when it is expected', () => {
  assert.throws(
    () =>
      validateMobileEnvironment({
        ...safeEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: 'https://productionref.supabase.co',
        MOBILE_EXPECTED_SUPABASE_PROJECT_REF: 'productionref',
      }),
    /marked as production/
  );
});

test('rejects the checked-in production project even when the supplied denylist is wrong', () => {
  assert.throws(() => validateMobileEnvironment({
    ...safeEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: 'https://gwvftrrknusdfdgiwuij.supabase.co',
    MOBILE_EXPECTED_SUPABASE_PROJECT_REF: 'gwvftrrknusdfdgiwuij',
    MOBILE_BLOCKED_SUPABASE_PROJECT_REFS: 'different-production-ref',
  }), /marked as production/);
});

test('allows explicit loopback services only for development', () => {
  const local = {
    ...safeEnvironment,
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
    MOBILE_EXPECTED_SUPABASE_PROJECT_REF: 'local',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    MOBILE_EXPECTED_APP_HOST: 'localhost',
  };
  assert.equal(validateMobileEnvironment(local).supabaseProjectRef, 'local');
  assert.throws(() => validateMobileEnvironment({
    ...local,
    MOBILE_BUILD_PROFILE: 'staging',
    MOBILE_APP_ID: 'io.railcommand.app.staging',
    MOBILE_EXPECTED_APP_ID: 'io.railcommand.app.staging',
  }), /must use HTTPS/);
});

test('rejects a Supabase URL that does not match approved staging', () => {
  assert.throws(
    () =>
      validateMobileEnvironment({
        ...safeEnvironment,
        NEXT_PUBLIC_SUPABASE_URL: 'https://otherref.supabase.co',
      }),
    /does not match the approved mobile inventory/
  );
});

test('rejects a production application host', () => {
  assert.throws(
    () =>
      validateMobileEnvironment({
        ...safeEnvironment,
        NEXT_PUBLIC_APP_URL: 'https://railcommand.io',
        MOBILE_EXPECTED_APP_HOST: 'railcommand.io',
      }),
    /marked as production/
  );
});

test('fails closed when the production denylist is missing', () => {
  assert.throws(
    () =>
      validateMobileEnvironment({
        ...safeEnvironment,
        MOBILE_BLOCKED_SUPABASE_PROJECT_REFS: '',
      }),
    /MOBILE_BLOCKED_SUPABASE_PROJECT_REFS is required/
  );
});

test('rejects server-only credentials in the mobile environment', () => {
  assert.throws(
    () =>
      validateMobileEnvironment({
        ...safeEnvironment,
        SUPABASE_SERVICE_ROLE_KEY: 'must-not-be-bundled',
      }),
    /SUPABASE_SERVICE_ROLE_KEY is forbidden/
  );
});
