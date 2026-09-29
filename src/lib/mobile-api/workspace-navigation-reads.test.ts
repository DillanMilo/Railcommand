import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createProjectCollectionReader } from '../project-collection-client';

describe('workspace navigation read overlap', () => {
  it('shares only a pending read, then fetches fresh data on the next visit', async () => {
    const original = globalThis.fetch;
    const responses: ((response: Response) => void)[] = [];
    const pool = createProjectCollectionReader();
    try {
      globalThis.fetch = async () => new Promise<Response>((resolve) => responses.push(resolve));
      const selected = pool.read('photos', 'a');
      const mounted = pool.read('photos', 'a');
      assert.equal(selected, mounted);
      assert.equal(responses.length, 1);
      responses[0](Response.json({ data: [{ id: 'first' }] }));
      assert.deepEqual(await mounted, { data: [{ id: 'first' }] });
      const revisit = pool.read('photos', 'a');
      assert.equal(responses.length, 2);
      responses[1](Response.json({ data: [{ id: 'new' }] }));
      assert.deepEqual(await revisit, { data: [{ id: 'new' }] });
    } finally { pool.clear(); globalThis.fetch = original; }
  });

  it('keeps projects, collections and mounted accounts separate', async () => {
    const original = globalThis.fetch;
    const responses: ((response: Response) => void)[] = [];
    const a = createProjectCollectionReader(), b = createProjectCollectionReader();
    try {
      globalThis.fetch = async (_url, options) => {
        assert.equal(options?.credentials, 'same-origin');
        assert.equal(options?.cache, 'no-store');
        return new Promise<Response>((resolve) => responses.push(resolve));
      };
      const reads = [a.read('photos', 'one'), a.read('photos', 'two'), a.read('documents', 'one'), b.read('photos', 'one')];
      assert.equal(responses.length, 4);
      responses.forEach((resolve, i) => resolve(Response.json({ data: [{ id: String(i) }] })));
      const results = await Promise.all(reads);
      assert.deepEqual(results.map((r) => r.data?.[0].id), ['0', '1', '2', '3']);
    } finally { a.clear(); b.clear(); globalThis.fetch = original; }
  });

  it('cancels old-session work without deleting a newer request and retries denied reads', async () => {
    const original = globalThis.fetch;
    const pool = createProjectCollectionReader();
    const responses: ((response: Response) => void)[] = [];
    try {
      globalThis.fetch = async (_url, options) => new Promise<Response>((resolve, reject) => {
        responses.push(resolve);
        options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
      const old = pool.read('documents', 'a');
      pool.clear();
      const next = pool.read('documents', 'a');
      assert.ok((await old).error);
      assert.equal(pool.read('documents', 'a'), next);
      responses[1](Response.json({ error: 'Not authorized' }, { status: 403 }));
      assert.deepEqual(await next, { error: 'Not authorized' });
      const retry = pool.read('documents', 'a');
      assert.equal(responses.length, 3);
      responses[2](Response.json({ data: [] }));
      assert.deepEqual(await retry, { data: [] });
    } finally { pool.clear(); globalThis.fetch = original; }
  });
});
