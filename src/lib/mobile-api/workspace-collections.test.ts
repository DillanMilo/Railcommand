import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { readProjectCollection } from '../project-collection-client';

type Result = { data?: unknown[]; error?: string };
function route(result: Result = { data: [] }, reject = false) {
  const calls: string[] = [];
  const exports: { GET?: (request: Request, context: { params: Promise<{ projectId: string; collection: string }> }) => Promise<Response> } = {};
  const code = ts.transpileModule(readFileSync(new URL('../../app/api/workspace/projects/[projectId]/[collection]/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const action = (kind: string) => async (id: string) => { calls.push(`${kind}:${id}`); if (reject) throw new Error('unavailable'); return result; };
  runInNewContext(code, { exports, Response, require: (name: string) => {
    if (name === '@/lib/actions/documents') return { getProjectDocuments: action('documents') };
    if (name === '@/lib/actions/photos') return { getProjectPhotos: action('photos') };
    throw new Error(name);
  } });
  return { calls, get: (collection: string, projectId = '10000000-0000-4000-8000-000000000001') => exports.GET!(new Request('https://railcommand.io/api/workspace'), { params: Promise.resolve({ projectId, collection }) }) };
}
describe('parallel private project collection reads', () => {
  it('delegates exact projects to existing authorized reads and never caches their responses', async () => {
    const h = route({ data: [{ id: 'synthetic-photo' }] });
    for (const kind of ['documents', 'photos']) {
      const response = await h.get(kind);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('cache-control')?.includes('no-store'));
      assert.match(response.headers.get('vary')!, /Cookie/);
      assert.deepEqual(await response.json(), { data: [{ id: 'synthetic-photo' }] });
    }
    assert.deepEqual(h.calls, ['documents:10000000-0000-4000-8000-000000000001', 'photos:10000000-0000-4000-8000-000000000001']);
  });
  it('denies failed authorization and invalid requests without returning data', async () => {
    const h = route({ error: 'Not authorized', data: [{ private: true }] });
    const denied = await h.get('documents');
    assert.equal(denied.status, 403);
    assert.deepEqual(await denied.json(), { error: 'Not authorized' });
    const invalid = route();
    assert.equal((await invalid.get('users')).status, 404);
    assert.equal((await invalid.get('photos', 'not-a-project')).status, 404);
    assert.equal(invalid.calls.length, 0);
    const failure = await route({}, true).get('photos');
    assert.equal(failure.status, 503);
    assert.ok(failure.headers.get('cache-control')?.includes('no-store'));
  });
  it('starts both reads independently with same-origin credentials and no-store', async () => {
    const original = globalThis.fetch;
    const pending: ((value: Response) => void)[] = [];
    try {
      globalThis.fetch = async (_url, options) => {
        assert.equal(options?.cache, 'no-store');
        assert.equal(options?.credentials, 'same-origin');
        assert.equal(options?.redirect, 'error');
        return new Promise<Response>((resolve) => pending.push(resolve));
      };
      const documents = readProjectCollection('documents', 'project');
      const photos = readProjectCollection('photos', 'project');
      assert.equal(pending.length, 2);
      pending.forEach((resolve) => resolve(Response.json({ data: [] })));
      assert.deepEqual(await Promise.all([documents, photos]), [{ data: [] }, { data: [] }]);
    } finally { globalThis.fetch = original; }
  });
  it('surfaces connectivity and rejected sessions instead of hanging the loader', async () => {
    const original = globalThis.fetch;
    try {
      globalThis.fetch = async () => { throw new Error('offline'); };
      assert.ok((await readProjectCollection('photos', 'project')).error);
      globalThis.fetch = async () => Response.json({ error: 'Not authorized' }, { status: 403 });
      assert.deepEqual(await readProjectCollection('documents', 'project'), { error: 'Not authorized' });
    } finally { globalThis.fetch = original; }
  });
});
