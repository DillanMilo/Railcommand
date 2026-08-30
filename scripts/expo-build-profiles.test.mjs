import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const mobileRoot = fileURLToPath(new URL('../apps/mobile/', import.meta.url));
const easConfig = JSON.parse(readFileSync(new URL('../apps/mobile/eas.json', import.meta.url), 'utf8'));
const mobilePackage = JSON.parse(
  readFileSync(new URL('../apps/mobile/package.json', import.meta.url), 'utf8'),
);

const expectedProfiles = {
  development: {
    identifier: 'io.railcommand.app.dev',
    environment: 'development',
    publicProfile: 'development',
  },
  reviewer: {
    identifier: 'io.railcommand.app.dev',
    environment: 'development',
    publicProfile: 'development',
  },
  staging: {
    identifier: 'io.railcommand.app.staging',
    environment: 'preview',
    publicProfile: 'staging',
  },
  production: {
    identifier: 'io.railcommand.app',
    environment: 'production',
    publicProfile: 'production',
  },
};

function runExpoConfig(profile) {
  const env = { ...process.env };
  delete env.EXPO_PUBLIC_BUILD_PROFILE;
  if (profile) env.EXPO_PUBLIC_BUILD_PROFILE = profile;

  return spawnSync('npx', ['expo', 'config', '--type', 'public', '--json'], {
    cwd: mobileRoot,
    encoding: 'utf8',
    env,
  });
}

test('every EAS profile pins the matching public build profile', () => {
  for (const [profile, expected] of Object.entries(expectedProfiles)) {
    const buildProfile = easConfig.build[profile];
    assert.equal(buildProfile.environment, expected.environment);
    assert.equal(buildProfile.env.EXPO_PUBLIC_BUILD_PROFILE, expected.publicProfile);
  }
});

test('each explicit profile resolves the expected iOS and Android identifiers', () => {
  for (const [profile, expected] of Object.entries(expectedProfiles)) {
    const result = runExpoConfig(expected.publicProfile);
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    assert.equal(config.extra.buildProfile, expected.publicProfile);
    assert.equal(config.ios.bundleIdentifier, expected.identifier);
    assert.equal(config.android.package, expected.identifier);
  }
});

test('Expo configuration fails closed when no build profile is supplied', () => {
  const result = runExpoConfig();
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /EXPO_PUBLIC_BUILD_PROFILE is required/);
});

test('local Expo scripts explicitly select the development profile', () => {
  for (const script of ['start', 'android', 'ios', 'web', 'export', 'prebuild:native']) {
    assert.match(
      mobilePackage.scripts[script],
      /EXPO_PUBLIC_BUILD_PROFILE=development/,
      `${script} must select the development profile explicitly`,
    );
  }
});

test('the test resolves repository paths without depending on the caller cwd', () => {
  const repositoryPackage = JSON.parse(
    readFileSync(new URL('package.json', new URL('../', import.meta.url)), 'utf8'),
  );
  assert.ok(repositoryRoot.endsWith('/'));
  assert.equal(repositoryPackage.name, 'railcommand-temp');
});
