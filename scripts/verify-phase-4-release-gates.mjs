import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { STORE_STORIES, STORE_TARGETS, expectedFileName } from './store-media.mjs';

export const REQUIRED_PHASE_4_GATES = [
  'local-compliance-suite',
  'isolated-preview-deployment',
  'google-play-drafts',
  'password-recovery-delivery',
  'canonical-staging-backend',
  'staging-deletion-lifecycle',
  'app-store-connect',
  'apple-distribution-signing',
  'authenticated-store-media',
  'reviewer-walkthrough',
  'production-association-files',
  'physical-iphone-deletion',
  'physical-android-acceptance',
];

const ALLOWED_STATUSES = new Set(['verified', 'pending', 'accepted_exception']);

export function countMissingStoreFrames(root = process.cwd()) {
  let missing = 0;
  for (const [target, definition] of Object.entries(STORE_TARGETS)) {
    for (const story of STORE_STORIES) {
      const file = resolve(
        root,
        'docs/mobile/store-assets/screenshots',
        definition.directory,
        expectedFileName(target, story),
      );
      if (!existsSync(file)) missing += 1;
    }
  }
  return missing;
}

export function evaluatePhase4ReleaseGates(manifest, { missingStoreFrames }) {
  assert.equal(manifest.releaseVersion, '1.0.0', 'Phase 4 gate version must match the v1 release');
  assert.equal(manifest.scope, 'store-submission-readiness', 'Unexpected Phase 4 gate scope');
  assert.equal(
    manifest.productionMutationAuthorized,
    false,
    'Phase 4 evidence must never imply production mutation authorization',
  );
  assert.ok(Array.isArray(manifest.gates), 'Phase 4 gates must be an array');

  const byId = new Map();
  for (const gate of manifest.gates) {
    assert.equal(typeof gate.id, 'string', 'Every Phase 4 gate needs an id');
    assert.ok(!byId.has(gate.id), `Duplicate Phase 4 gate: ${gate.id}`);
    assert.ok(ALLOWED_STATUSES.has(gate.status), `Invalid status for ${gate.id}`);
    assert.ok(gate.evidence?.trim(), `Evidence or a concrete blocker is required for ${gate.id}`);
    if (gate.status === 'verified') {
      assert.match(gate.verifiedAt ?? '', /^\d{4}-\d{2}-\d{2}$/, `Verification date missing for ${gate.id}`);
    }
    if (gate.status === 'accepted_exception') {
      assert.equal(
        gate.id,
        'physical-android-acceptance',
        'Only the named physical Android hardware gate may be accepted as an exception',
      );
      assert.match(gate.ownerAcceptedAt ?? '', /^\d{4}-\d{2}-\d{2}$/, 'Owner exception date is required');
    }
    byId.set(gate.id, gate);
  }

  assert.deepEqual(
    [...byId.keys()].sort(),
    [...REQUIRED_PHASE_4_GATES].sort(),
    'Phase 4 gate inventory must be exact',
  );

  const mediaGate = byId.get('authenticated-store-media');
  if (mediaGate.status === 'verified') {
    assert.equal(missingStoreFrames, 0, 'Store media cannot be verified while frames are missing');
  }

  const pending = [...byId.values()]
    .filter(({ status }) => status === 'pending')
    .map(({ id, evidence }) => ({ id, blocker: evidence }));
  const acceptedExceptions = [...byId.values()]
    .filter(({ status }) => status === 'accepted_exception')
    .map(({ id, evidence }) => ({ id, evidence }));

  return {
    releaseVersion: manifest.releaseVersion,
    ready: pending.length === 0 && missingStoreFrames === 0,
    verifiedCount: manifest.gates.length - pending.length - acceptedExceptions.length,
    requiredCount: manifest.gates.length,
    missingStoreFrames,
    pending,
    acceptedExceptions,
    productionMutationAuthorized: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({
    options: { 'allow-pending': { type: 'boolean', default: false } },
  });
  const manifest = JSON.parse(
    readFileSync(resolve('docs/mobile/PHASE_4_RELEASE_GATES.json'), 'utf8'),
  );
  const result = evaluatePhase4ReleaseGates(manifest, {
    missingStoreFrames: countMissingStoreFrames(),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!values['allow-pending'] && !result.ready) process.exitCode = 1;
}
