import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { mobileJson, mobileOptions } from './auth';
import { availableMobileRelease, mobileReleaseForUser, pilotMobileRelease } from './app-release';

function handler(mode: 'signed-in' | 'anonymous' | 'unavailable', pilot = false) {
  const compiled = { exports: {} as { GET: (r: Request) => Promise<Response> } };
  const dependencies: Record<string, unknown> = {
    '@/lib/mobile-api/auth': { mobileJson, mobileOptions, authenticateMobileRequest: async () => {
      if (mode === 'unavailable') throw new Error('private synthetic auth failure');
      return mode === 'signed-in' ? { user: { id: '10000000-0000-4000-8000-000000000001' } } : null;
    } },
    '@/lib/mobile-api/app-release': { mobileReleaseForUser: (id: string) => mobileReleaseForUser(id, pilot ? '10000000-0000-4000-8000-000000000001' : '') },
  };
  const source = readFileSync(new URL('../../app/api/mobile/v1/app-release/route.ts', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: compiled.exports, module: compiled, require: (name: string) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
    },
  });
  return compiled.exports.GET;
}
describe('read-only mobile release endpoint', () => {
  for (const [mode, status] of [['signed-in', 200], ['anonymous', 401], ['unavailable', 503]] as const) {
    it(`${mode} responds ${status} without caching or disclosing credentials`, async () => {
      const r = await handler(mode)(new Request('https://staging.example/api/mobile/v1/app-release'));
      assert.equal(r.status, status); assert.match(r.headers.get('cache-control') ?? '', /no-store/);
      assert.match(r.headers.get('vary') ?? '', /Authorization/); assert.equal(r.headers.get('set-cookie'), null);
      const body = await r.json();
      if (status === 200) assert.deepEqual(body, availableMobileRelease);
      else { assert.equal(typeof body.error, 'string'); assert.equal('ios' in body, false); assert.doesNotMatch(JSON.stringify(body), /private synthetic/); }
    });
  }
});


describe('published update audience', () => {
  const pilotId = '10000000-0000-4000-8000-000000000001';
  it('publishes Inventory build 610011 without requiring a pilot identity', () => {
    assert.equal(availableMobileRelease.ios?.buildNumber, 610011);
    assert.deepEqual(mobileReleaseForUser('20000000-0000-4000-8000-000000000002', ''), availableMobileRelease);
  });
  it('returns the available build to the authenticated audience', async () => {
    const response = await handler('signed-in', true)(new Request('https://staging.example/api/mobile/v1/app-release?userId=someone-else'));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), pilotMobileRelease);
    assert.match(response.headers.get('cache-control') ?? '', /no-store/);
    assert.deepEqual(mobileReleaseForUser('20000000-0000-4000-8000-000000000002', pilotId), availableMobileRelease);
    assert.deepEqual(mobileReleaseForUser(pilotId, '  '+pilotId.toUpperCase()+' , '), pilotMobileRelease);
  });
  it('keeps a future targeted update private even after the general Inventory release', () => {
    const future = { schemaVersion: 1 as const, ios: { buildNumber: 610012, version: '1.0.0', channel: 'testflight' as const } };
    const published = { general: availableMobileRelease, pilot: future };
    assert.deepEqual(mobileReleaseForUser(pilotId, pilotId, published), future);
    assert.deepEqual(mobileReleaseForUser('20000000-0000-4000-8000-000000000002', pilotId, published), availableMobileRelease);
  });
  it('never advertises a targeted release on missing or malformed configuration', () => {
    for (const audience of ['', 'not-a-user', pilotId+',broken', '*']) {
      assert.deepEqual(mobileReleaseForUser(pilotId, audience), availableMobileRelease);
    }
  });
  it('a later general release supersedes the pilot instead of stranding pilot users', () => {
    const newer = { schemaVersion: 1 as const, ios: { buildNumber: 610012, version: '1.0.0', channel: 'testflight' as const } };
    assert.deepEqual(mobileReleaseForUser(pilotId, pilotId, { general: newer, pilot: pilotMobileRelease }), newer);
  });
  it('does not expose rollout identities or allow anonymous targeting', async () => {
    const response = await handler('anonymous', true)(new Request('https://staging.example/api/mobile/v1/app-release?userId='+pilotId));
    assert.equal(response.status, 401);
    assert.doesNotMatch(await response.text(), /610011|10000000/);
    assert.equal('userIds' in pilotMobileRelease, false);
  });
});
