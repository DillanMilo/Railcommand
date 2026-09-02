import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const mobileRoot = fileURLToPath(new URL('../apps/mobile/', import.meta.url));
const require = createRequire(import.meta.url);
const expoCli = require.resolve('expo/bin/cli', { paths: [mobileRoot] });
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
  beta: {
    identifier: 'io.railcommand.app',
    environment: 'preview',
    publicProfile: 'staging',
    distributionTarget: 'beta',
  },
  production: {
    identifier: 'io.railcommand.app',
    environment: 'production',
    publicProfile: 'production',
  },
};

function configEnvironment(profile, overrides = {}, ambient = process.env) {
  // Do not inherit credentials, profile selectors, or dotenv/network switches.
  const env = Object.fromEntries(
    ['PATH', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot']
      .filter((key) => ambient[key] !== undefined)
      .map((key) => [key, ambient[key]]),
  );
  return {
    ...env,
    CI: '1',
    EXPO_NO_DOTENV: '1',
    EXPO_OFFLINE: '1',
    EXPO_NO_TELEMETRY: '1',
    ...(profile ? easConfig.build[profile].env : {}),
    ...overrides,
  };
}

function runExpoConfig(profile, overrides = {}) {
  // Use the installed CLI directly; never let npx install or fetch a package.
  return spawnSync(process.execPath, [expoCli, 'config', '--type', 'public', '--json'], {
    cwd: mobileRoot,
    encoding: 'utf8',
    env: configEnvironment(profile, overrides),
    timeout: 30_000,
  });
}

test('every EAS profile pins the matching public build profile', () => {
  for (const [profile, expected] of Object.entries(expectedProfiles)) {
    const buildProfile = easConfig.build[profile];
    assert.equal(buildProfile.environment, expected.environment);
    assert.equal(buildProfile.env.EXPO_PUBLIC_BUILD_PROFILE, expected.publicProfile);
    assert.equal(buildProfile.env.MOBILE_DISTRIBUTION_TARGET, expected.distributionTarget);
  }
});

test('each explicit profile resolves the expected iOS and Android identifiers', () => {
  for (const [profile, expected] of Object.entries(expectedProfiles)) {
    const result = runExpoConfig(profile);
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    assert.equal(config.extra.buildProfile, expected.publicProfile);
    assert.equal(config.ios.bundleIdentifier, expected.identifier);
    assert.equal(config.android.package, expected.identifier);
    assert.equal(config.ios.appleTeamId, 'PQAGLH9L66');
    assert.equal(config.extra.distributionTarget, expected.distributionTarget ?? 'local');
    assert.equal(config.extra.linkHost, profile === 'production'
      ? 'railcommand.io'
      : 'mobile-staging.railcommand.io');
    assert.deepEqual(config.ios.associatedDomains, [`applinks:${config.extra.linkHost}`]);
    if (profile === 'beta') assert.equal(config.name, 'RailCommand Beta');
  }
});

test('the beta profile stays store-signed with the Preview environment', () => {
  const beta = easConfig.build.beta;
  assert.equal(beta.distribution, 'store');
  assert.equal(beta.environment, 'preview');
  assert.equal(beta.channel, 'beta');
  assert.equal(beta.autoIncrement, true);
  assert.notEqual(beta.developmentClient, true);
});

test('beta submission pins only the existing Apple app and team', () => {
  assert.deepEqual(easConfig.submit, {
    beta: { ios: { ascAppId: '6803576049', appleTeamId: 'PQAGLH9L66' } },
  });
});

test('beta distribution rejects development and production runtime profiles', () => {
  for (const profile of ['development', 'production']) {
    const result = runExpoConfig('beta', { EXPO_PUBLIC_BUILD_PROFILE: profile });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /beta distribution must use the staging runtime profile/);
  }
});

test('config subprocesses isolate ambient selectors and disable dotenv, network, and telemetry', () => {
  const env = configEnvironment('development', {}, {
    PATH: '/synthetic/bin',
    MOBILE_DISTRIBUTION_TARGET: 'beta',
    EXPO_PUBLIC_BUILD_PROFILE: 'production',
    EXPO_PUBLIC_SUPABASE_URL: 'https://unapproved.example',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-private-value',
    EXPO_NO_DOTENV: '0',
    EXPO_OFFLINE: '0',
    EXPO_NO_TELEMETRY: '0',
  });
  assert.deepEqual(env, {
    PATH: '/synthetic/bin',
    CI: '1',
    EXPO_NO_DOTENV: '1',
    EXPO_OFFLINE: '1',
    EXPO_NO_TELEMETRY: '1',
    EXPO_PUBLIC_BUILD_PROFILE: 'development',
  });
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
