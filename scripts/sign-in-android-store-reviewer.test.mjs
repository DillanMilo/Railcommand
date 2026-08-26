import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('./sign-in-android-store-reviewer.mjs', import.meta.url), 'utf8');

test('refuses production, physical devices, and uncontrolled reviewer domains', () => {
  assert.match(source, /profile === 'production'/);
  assert.match(source, /\^emulator-\\d\+\$/);
  assert.match(source, /endsWith\('@railcommand\.io'\)/);
  assert.match(source, /validateMobileEnvironment\(process\.env\)/);
});

test('locates native controls and prints only non-secret verification fields', () => {
  assert.match(source, /android\\\.widget\\\.EditText/);
  assert.match(source, /content-desc="Sign in"/);
  const consoleBlock = source.match(/console\.log\(JSON\.stringify\(\{([\s\S]*?)\}, null, 2\)\);/);
  assert.ok(consoleBlock);
  assert.match(consoleBlock[1], /appId: validated\.appId/);
  assert.match(consoleBlock[1], /signedIn: true/);
  assert.doesNotMatch(consoleBlock[1], /email|password|token/i);
});
