import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const verifier = new URL('./verify-staging-account-deletion.mjs', import.meta.url);
const safeFixture = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://rxuvchdqbzvovqijvfhx.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-key',
  NEXT_PUBLIC_APP_URL: 'https://mobile-staging.railcommand.io',
  ACCOUNT_DELETION_QA_EMAIL: 'phase4-deletion-qa@railcommand.io',
  ACCOUNT_DELETION_QA_PASSWORD: 'synthetic-password',
  ACCOUNT_DELETION_QA_EXPECTED_USER_ID: '8b4ddce2-ac35-4f6d-96dd-0c967c956420',
};

function run(overrides = {}) {
  return spawnSync(process.execPath, [verifier.pathname], {
    encoding: 'utf8',
    env: { ...process.env, ...safeFixture, ...overrides },
  });
}

test('fails closed before network access for a production Supabase project', () => {
  const result = run({
    NEXT_PUBLIC_SUPABASE_URL: 'https://gwvftrrknusdfdgiwuij.supabase.co',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /gwvftrrknusdfdgiwuij\.supabase\.co/);
});

test('fails closed before network access for a non-staging application host', () => {
  const result = run({ NEXT_PUBLIC_APP_URL: 'https://railcommand.io' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /railcommand\.io/);
});

test('requires the dedicated synthetic deletion identity', () => {
  const result = run({ ACCOUNT_DELETION_QA_EMAIL: 'reviewer@railcommand.io' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /phase4-deletion-qa/);
});

test('rejects an unscoped cleanup request before authentication', () => {
  const result = run({ ACCOUNT_DELETION_QA_CANCEL_REQUEST_ID: 'not-a-request-id' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /36/);
});
