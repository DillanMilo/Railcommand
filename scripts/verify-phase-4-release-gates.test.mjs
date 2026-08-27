import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REQUIRED_PHASE_4_GATES,
  countMissingStoreFrames,
  evaluatePhase4ReleaseGates,
} from './verify-phase-4-release-gates.mjs';

function manifest(status = 'verified') {
  return {
    releaseVersion: '1.0.0',
    scope: 'store-submission-readiness',
    productionMutationAuthorized: false,
    gates: REQUIRED_PHASE_4_GATES.map((id) => ({
      id,
      status,
      verifiedAt: status === 'verified' ? '2026-08-26' : undefined,
      evidence: `${id} evidence`,
    })),
  };
}

test('reports a complete release only when every gate and store frame is verified', () => {
  const result = evaluatePhase4ReleaseGates(manifest(), { missingStoreFrames: 0 });
  assert.equal(result.ready, true);
  assert.equal(result.pending.length, 0);
  assert.equal(result.productionMutationAuthorized, false);
});

test('counts only the approved target-specific store frames', () => {
  assert.equal(countMissingStoreFrames(), 0);
});

test('fails closed when an external gate or authenticated frame remains pending', () => {
  const value = manifest();
  const gate = value.gates.find(({ id }) => id === 'app-store-connect');
  gate.status = 'pending';
  delete gate.verifiedAt;
  const mediaGate = value.gates.find(({ id }) => id === 'authenticated-store-media');
  mediaGate.status = 'pending';
  delete mediaGate.verifiedAt;
  const result = evaluatePhase4ReleaseGates(value, { missingStoreFrames: 18 });
  assert.equal(result.ready, false);
  assert.deepEqual(result.pending.map(({ id }) => id), [
    'app-store-connect',
    'authenticated-store-media',
  ]);
  assert.equal(result.missingStoreFrames, 18);
});

test('does not accept store media evidence while frames are missing', () => {
  assert.throws(
    () => evaluatePhase4ReleaseGates(manifest(), { missingStoreFrames: 1 }),
    /Store media cannot be verified/,
  );
});

test('allows only an explicitly dated physical Android exception', () => {
  const value = manifest();
  const gate = value.gates.find(({ id }) => id === 'physical-android-acceptance');
  gate.status = 'accepted_exception';
  delete gate.verifiedAt;
  gate.ownerAcceptedAt = '2026-08-26';
  const result = evaluatePhase4ReleaseGates(value, { missingStoreFrames: 0 });
  assert.equal(result.ready, true);
  assert.deepEqual(result.acceptedExceptions.map(({ id }) => id), ['physical-android-acceptance']);

  value.gates.find(({ id }) => id === 'app-store-connect').status = 'accepted_exception';
  assert.throws(
    () => evaluatePhase4ReleaseGates(value, { missingStoreFrames: 0 }),
    /Only the named physical Android hardware gate/,
  );
});

test('rejects production authorization and incomplete gate inventories', () => {
  const production = manifest();
  production.productionMutationAuthorized = true;
  assert.throws(
    () => evaluatePhase4ReleaseGates(production, { missingStoreFrames: 0 }),
    /must never imply production mutation authorization/,
  );

  const incomplete = manifest();
  incomplete.gates.pop();
  assert.throws(
    () => evaluatePhase4ReleaseGates(incomplete, { missingStoreFrames: 0 }),
    /gate inventory must be exact/,
  );
});
