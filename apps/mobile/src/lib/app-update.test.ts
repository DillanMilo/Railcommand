import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createAppUpdateChecker, openTestFlight, TESTFLIGHT_APP_URL, TESTFLIGHT_STORE_URL } from './app-update';
const installed = { platform: 'ios', profile: 'production', applicationId: 'io.railcommand.app', buildNumber: '300013' };
const release = (buildNumber = 300014) => ({ schemaVersion: 1, ios: { buildNumber, version: '1.0.0', channel: 'testflight' } });
describe('nonblocking native app update checks', () => {
  it('checks once while in flight and only shows a build once per app session', async () => {
    let time = 1000, calls = 0; const shown: number[] = [];
    let finish!: (value: unknown) => void;
    const pending = new Promise(resolve => { finish = resolve; });
    const check = createAppUpdateChecker(() => time);
    const input = { installed, isCurrent: () => true, fetchRelease: async () => { calls++; return pending; }, show: (r: { buildNumber: number }) => { shown.push(r.buildNumber); } };
    const first = check(input); await check(input); assert.equal(calls, 1);
    finish(release()); await first; assert.deepEqual(shown, [300014]);
    time += 16 * 60_000; await check(input); assert.equal(calls, 2); assert.deepEqual(shown, [300014]);
    time += 16 * 60_000; await check({ ...input, fetchRelease: async () => release(300015) }); assert.deepEqual(shown, [300014, 300015]);
  });
  it('does not check unsupported builds or an unsafe/offline/changed screen', async () => {
    let calls = 0;
    const check = createAppUpdateChecker();
    const input = { installed, isCurrent: () => false, fetchRelease: async () => { calls++; return release(); }, show: () => assert.fail('Unexpected prompt') };
    await check(input); await check({ ...input, installed: { ...installed, profile: 'staging' }, isCurrent: () => true });
    assert.equal(calls, 0);
  });
  it('drops a response when editing, backgrounding or account switching made it stale', async () => {
    let current = true;
    await createAppUpdateChecker()({ installed, isCurrent: () => current, fetchRelease: async () => { current = false; return release(); }, show: () => assert.fail('Stale prompt') });
  });
  it('ignores a missing endpoint/network failure and retries later without blocking work', async () => {
    let time = 1000, calls = 0;
    const check = createAppUpdateChecker(() => time);
    const input = { installed, isCurrent: () => true, fetchRelease: async () => { calls++; throw new Error('offline or old backend'); }, show: () => assert.fail('Unexpected prompt') };
    await check(input); await check(input); assert.equal(calls, 1);
    time += 60_001; await check(input); assert.equal(calls, 2);
  });
  it('times out a stalled release request without showing or blocking an update', async () => {
    let aborted = false;
    await createAppUpdateChecker(Date.now, 10)({ installed, isCurrent: () => true,
      fetchRelease: signal => new Promise((_resolve, reject) => signal.addEventListener('abort', () => { aborted = true; reject(new Error('timeout')); })),
      show: () => assert.fail('Timed out prompt') });
    assert.equal(aborted, true);
  });
  it('opens only the fixed RailCommand TestFlight link and falls back to Apple’s TestFlight listing', async () => {
    const calls: string[] = [];
    await openTestFlight(async url => { calls.push(url); if (url === TESTFLIGHT_APP_URL) throw new Error('TestFlight not installed'); });
    assert.deepEqual(calls, [TESTFLIGHT_APP_URL, TESTFLIGHT_STORE_URL]);
    await assert.rejects(openTestFlight(async () => { throw new Error('OS refused'); }), /OS refused/);
  });
});
