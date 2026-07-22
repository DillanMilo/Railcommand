import assert from 'node:assert/strict';
import {
  createDemoSessionToken,
  DEMO_SESSION_MAX_AGE_SECONDS,
  readDemoSessionToken,
} from './session-cookie';
import { PUBLIC_DEMO_ACCESS_DAYS } from './constants';

describe('public demo sessions', () => {
  before(() => {
    process.env.DEMO_SESSION_SECRET = 'railcommand-demo-session-test-secret';
  });

  it('limits public demo access to three days', () => {
    assert.equal(PUBLIC_DEMO_ACCESS_DAYS, 3);
    assert.equal(DEMO_SESSION_MAX_AGE_SECONDS, 3 * 24 * 60 * 60);
  });

  it('accepts a valid signed session and rejects it after expiration', async () => {
    const now = Date.now();
    const validToken = await createDemoSessionToken({
      mode: 'demo',
      projectId: 'proj-001',
      profileId: 'prof-001',
      issuedAt: now,
      expiresAt: now + 60_000,
    });
    const expiredToken = await createDemoSessionToken({
      mode: 'demo',
      projectId: 'proj-001',
      profileId: 'prof-001',
      issuedAt: now - 120_000,
      expiresAt: now - 60_000,
    });

    assert.equal((await readDemoSessionToken(validToken))?.mode, 'demo');
    assert.equal(await readDemoSessionToken(expiredToken), null);
  });
});
