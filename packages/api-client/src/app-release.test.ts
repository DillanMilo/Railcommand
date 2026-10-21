import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { MobileApiClient } from './index';

describe('native release API client', () => {
  it('uses an authenticated no-store GET, preserves cancellation and deduplicates checks', async () => {
    const abort = new AbortController();
    let calls = 0;
    const release = { schemaVersion: 1, ios: null };
    const client = new MobileApiClient({ baseUrl: 'https://staging.example', getAccessToken: async () => 'synthetic-token', fetch: async (input, init) => {
      calls++;
      assert.equal(String(input), 'https://staging.example/api/mobile/v1/app-release');
      assert.equal(init?.method ?? 'GET', 'GET');
      assert.equal(init?.cache, 'no-store');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-token');
      assert.equal(init?.signal, abort.signal);
      return Response.json(release);
    } });
    const [a, b] = await Promise.all([client.getAppRelease(abort.signal), client.getAppRelease(abort.signal)]);
    assert.deepEqual(a, release); assert.deepEqual(b, release); assert.equal(calls, 1);
  });
});
