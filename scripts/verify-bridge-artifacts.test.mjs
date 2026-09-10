import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { expectedArtifacts, verifyArtifacts } from './verify-bridge-artifacts.mjs';

test('requires all six recorded rehearsal inputs', () => {
  assert.equal(expectedArtifacts.length, 6);
  assert.equal(new Set(expectedArtifacts.map(x => x[0])).size, 6);
});
test('only exact bytes pass; missing, changed and unreadable inputs fail', () => {
  const hash = createHash('sha256').update('fixture').digest('hex');
  const expected = [['fixture.sql', hash]];
  assert.equal(verifyArtifacts('.', () => Buffer.from('fixture'), expected)[0].status, 'verified');
  assert.equal(verifyArtifacts('.', () => Buffer.from('changed'), expected)[0].status, 'mismatch');
  assert.equal(verifyArtifacts('.', () => { throw Object.assign(new Error(), {code:'ENOENT'}); }, expected)[0].status, 'missing');
  assert.equal(verifyArtifacts('.', () => { throw new Error('private details'); }, expected)[0].status, 'unreadable');
});
