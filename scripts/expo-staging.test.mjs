import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const helper = new URL('./expo-staging.mjs', import.meta.url);
const helperSource = readFileSync(helper, 'utf8');
const safeEnvironment = {
  ...process.env,
  MOBILE_BUILD_PROFILE: 'development',
  MOBILE_APP_ID: 'io.railcommand.app.dev',
  MOBILE_EXPECTED_APP_ID: 'io.railcommand.app.dev',
  NEXT_PUBLIC_SUPABASE_URL: 'https://rxuvchdqbzvovqijvfhx.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-key',
  NEXT_PUBLIC_APP_URL: 'https://mobile-staging.railcommand.io',
  MOBILE_EXPECTED_SUPABASE_PROJECT_REF: 'rxuvchdqbzvovqijvfhx',
  MOBILE_EXPECTED_APP_HOST: 'mobile-staging.railcommand.io',
  MOBILE_BLOCKED_SUPABASE_PROJECT_REFS: 'gwvftrrknusdfdgiwuij',
  MOBILE_BLOCKED_APP_HOSTS: 'railcommand.io',
};

function run(args, overrides = {}) {
  return spawnSync(process.execPath, [helper.pathname, ...args], {
    encoding: 'utf8',
    env: { ...safeEnvironment, ...overrides },
  });
}

test('accepts the isolated staging profile for simulator workflows', () => {
  const result = run(['not-a-command'], {
    MOBILE_BUILD_PROFILE: 'staging',
    MOBILE_APP_ID: 'io.railcommand.app.staging',
    MOBILE_EXPECTED_APP_ID: 'io.railcommand.app.staging',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Use config, prebuild-ios/);
  assert.doesNotMatch(result.stderr, /never runs production|Physical Expo acceptance/);
});

test('keeps physical-device acceptance on the development identifier', () => {
  const result = run(['run-ios', '825F9857-B5C3-4F27-ABBF-70F0834B40BC'], {
    MOBILE_BUILD_PROFILE: 'staging',
    MOBILE_APP_ID: 'io.railcommand.app.staging',
    MOBILE_EXPECTED_APP_ID: 'io.railcommand.app.staging',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Physical Expo acceptance must use the development/);
});

test('refuses production even when the general environment guard is authorized', () => {
  const result = run(['config'], {
    MOBILE_BUILD_PROFILE: 'production',
    MOBILE_APP_ID: 'io.railcommand.app',
    MOBILE_EXPECTED_APP_ID: 'io.railcommand.app',
    MOBILE_EXPECTED_SUPABASE_PROJECT_REF: 'gwvftrrknusdfdgiwuij',
    MOBILE_BLOCKED_SUPABASE_PROJECT_REFS: 'gwvftrrknusdfdgiwuij',
    NEXT_PUBLIC_SUPABASE_URL: 'https://gwvftrrknusdfdgiwuij.supabase.co',
    MOBILE_EXPECTED_APP_HOST: 'railcommand.io',
    MOBILE_BLOCKED_APP_HOSTS: 'railcommand.io',
    NEXT_PUBLIC_APP_URL: 'https://railcommand.io',
    MOBILE_ALLOW_PRODUCTION_BUILD: 'release-authorized',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /never runs production/);
});

test('launches simulator releases without a Metro or development-client URL', () => {
  assert.match(helperSource, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(helperSource, /CODE_SIGNING_ALLOWED=YES/);
  assert.match(helperSource, /CODE_SIGNING_REQUIRED=NO/);
  assert.match(helperSource, /ONLY_ACTIVE_ARCH=YES/);
  assert.match(helperSource, /ARCHS=arm64/);
  assert.match(helperSource, /'simctl', 'install'/);
  assert.match(helperSource, /'simctl', 'launch'/);
  assert.doesNotMatch(helperSource, /'expo', 'run:ios'.*'configuration', 'Release'/s);
});

test('builds and launches a self-contained Android release for emulator validation', () => {
  assert.match(helperSource, /'build-android-release'.*app:testReleaseUnitTest.*app:assembleRelease/s);
  assert.match(helperSource, /'run-android-emulator'/);
  assert.match(helperSource, /\['install', '-r', androidReleaseApk\]/);
  assert.match(helperSource, /'force-stop', validated\.appId/);
  assert.match(helperSource, /`\$\{validated\.appId\}\/\.MainActivity`/);
  assert.match(helperSource, /EXPO_PUBLIC_BUILD_PROFILE: validated\.profile/);
  assert.match(helperSource, /run-android-emulator requires ANDROID_HOME/);
  assert.match(helperSource, /build\/generated\/assets\/react\/release/);
  assert.match(helperSource, /build\/generated\/sourcemaps\/react\/release/);
});
