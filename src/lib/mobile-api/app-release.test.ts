import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { mobileJson, mobileOptions } from './auth';
import { availableMobileRelease } from './app-release';

function handler(mode: 'signed-in' | 'anonymous' | 'unavailable') {
  const compiled = { exports: {} as { GET: (r: Request) => Promise<Response> } };
  const dependencies: Record<string, unknown> = {
    '@/lib/mobile-api/auth': { mobileJson, mobileOptions, authenticateMobileRequest: async () => {
      if (mode === 'unavailable') throw new Error('private synthetic auth failure');
      return mode === 'signed-in' ? { user: { id: 'synthetic' } } : null;
    } },
    '@/lib/mobile-api/app-release': { availableMobileRelease },
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
