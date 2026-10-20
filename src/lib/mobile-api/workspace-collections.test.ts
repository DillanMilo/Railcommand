import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { readProjectCollection } from '../project-collection-client';
import { parsePhotoPageOptions } from '../project-photo-page';
import { PhotoPageError } from '../project-photo-page-server';

type Result = { data?: unknown[]; error?: string };
function route(result: Result = { data: [] }, reject = false) {
  const calls: string[] = [];
  const exports: { GET?: (request: Request, context: { params: Promise<{ projectId: string; collection: string }> }) => Promise<Response> } = {};
  const code = ts.transpileModule(readFileSync(new URL('../../app/api/workspace/projects/[projectId]/[collection]/route.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const action = (kind: string) => async (id: string) => { calls.push(`${kind}:${id}`); if (reject) throw new Error('unavailable'); return result; };
  runInNewContext(code, { exports, Response, URL, require: (name: string) => {
    if (name === '@/lib/actions/documents') return { getProjectDocuments: action('documents') };
    if (name === '@/lib/actions/photos') return { getProjectPhotos: action('photos') };
    if (name === '@/lib/supabase/server') return { createClient: async () => ({ fixture: true }) };
    if (name === '@/lib/project-photo-page') return { parsePhotoPageOptions };
    if (name === '@/lib/project-photo-page-server') return { PhotoPageError, getProjectPhotoPage: async (_client: unknown, id: string) => {
      calls.push(`page:${id}`);
      if (reject) throw new Error('unavailable');
      if (result.error) throw new PhotoPageError(result.error, 403);
      return { page: { data: result.data, nextCursor: null }, serverTiming: 'query;dur=1.0, signing;dur=2.0' };
    } };
    throw new Error(name);
  } });
  return { calls, get: (collection: string, projectId = '10000000-0000-4000-8000-000000000001', query = '') => exports.GET!(new Request(`https://railcommand.io/api/workspace${query}`), { params: Promise.resolve({ projectId, collection }) }) };
}
describe('parallel private project collection reads', () => {
  it('opts into bounded photo reads with private stage timings without changing legacy responses', async () => {
    const h = route({ data: [{ id: 'synthetic-photo' }] });
    const response = await h.get('photos', undefined, '?page=cursor&category=thermal');
    assert.deepEqual(await response.json(), { data: [{ id: 'synthetic-photo' }], nextCursor: null });
    assert.equal(response.headers.get('server-timing'), 'query;dur=1.0, signing;dur=2.0');
    assert.match(response.headers.get('cache-control')!, /private, no-store/);
    assert.equal(h.calls.length, 1); assert.match(h.calls[0], /^page:/);
    assert.equal((await h.get('photos', undefined, '?page=cursor&category=invalid')).status, 400);
    assert.equal(h.calls.length, 1);
    assert.equal((await route({ error: 'Access revoked' }).get('photos', undefined, '?page=cursor')).status, 403);
    assert.equal((await route({}, true).get('photos', undefined, '?page=cursor')).status, 503);
  });
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
