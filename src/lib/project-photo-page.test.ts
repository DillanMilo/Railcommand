import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { createClient } from '@supabase/supabase-js';
import { getProjectPhotoPage, PhotoPageError } from './project-photo-page-server';
import { parsePhotoPageOptions, type PhotoCursor, type ProjectPhotoPageOptions } from './project-photo-page';
import { readProjectPhotoPage, PhotoPageRequestError } from './project-photo-page-client';
import type { Attachment } from './types';

const projectId = '10000000-0000-4000-8000-000000000001';
const otherProjectId = '10000000-0000-4000-8000-000000000002';
const userId = '20000000-0000-4000-8000-000000000001';
const options: ProjectPhotoPageOptions = { category: 'all', cursor: null };
const photo = (number: number, fields: Partial<Attachment> = {}): Attachment => ({
  id: `30000000-0000-4000-8000-${String(number).padStart(12, '0')}`, project_id: projectId,
  entity_type: 'project_photo', entity_id: projectId, file_name: `${number}.jpg`,
  file_url: `https://fixture.supabase.co/storage/v1/object/public/project-photos/${projectId}/${number}.jpg`,
  file_type: 'image/jpeg', file_size: 100, photo_category: 'standard', uploaded_by: userId,
  created_at: '2026-10-20T12:00:00.123456+00:00', captured_at: null, geo_lat: null, geo_lng: null, ...fields,
});

/** Exercise the real SDK request builder and Storage batch transport with synthetic
 * server rows. These are contract tests, not a substitute for a live RLS check. */
function fixture(rows: Attachment[], config: { authenticated?: boolean; member?: boolean; queryFailure?: boolean; signFailure?: boolean } = {}) {
  const queries: URL[] = [];
  const signedPaths: string[] = [];
  const client = createClient('https://fixture.supabase.co', 'synthetic-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      queries.push(url);
      if (url.pathname.endsWith('/project_members')) {
        assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
        assert.equal(url.searchParams.get('profile_id'), `eq.${userId}`);
        return config.member === false ? Response.json({ message: 'denied' }, { status: 403 }) : Response.json({ project_role: 'foreman' });
      }
      if (url.pathname.endsWith('/profiles')) return Response.json({ role: 'member' });
      if (url.pathname.endsWith('/attachments')) {
        if (config.queryFailure) return Response.json({ message: 'private database diagnostic' }, { status: 500 });
        assert.equal(url.searchParams.get('project_id'), `eq.${projectId}`);
        assert.equal(url.searchParams.get('order'), 'created_at.desc,id.desc');
        assert.equal(url.searchParams.get('limit'), '13');
        const ors = url.searchParams.getAll('or');
        assert.equal(ors[0], '(file_type.like.image/*,photo_category.eq.thermal)');
        let selected = rows.filter((row) => row.project_id === projectId && (row.file_type.startsWith('image/') || row.photo_category === 'thermal'));
        const category = url.searchParams.get('photo_category')?.slice(3);
        if (category) selected = selected.filter((row) => row.photo_category === category);
        selected.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
        if (ors[1]) {
          const match = /^\(created_at.lt.(.+),and\(created_at.eq.(.+),id.lt.(.+)\)\)$/.exec(ors[1]);
          assert.ok(match); assert.equal(match[1], match[2]);
          selected = selected.filter((row) => row.created_at < match[1] || (row.created_at === match[1] && row.id < match[3]));
        }
        return Response.json(selected.slice(0, 13));
      }
      if (url.pathname.startsWith('/storage/v1/object/sign/')) {
        const { paths } = await request.json() as { paths: string[] };
        signedPaths.push(...paths);
        if (config.signFailure) return Response.json({ message: 'private storage diagnostic' }, { status: 500 });
        return Response.json(paths.map((path) => ({ path, signedURL: `/object/sign/project-photos/${path}?token=synthetic`, error: null })));
      }
      throw new Error(`Unexpected read ${url.pathname}`);
    } },
  });
  client.auth.getUser = (async () => ({ data: { user: config.authenticated === false ? null : { id: userId } }, error: null })) as typeof client.auth.getUser;
  return { client, queries, signedPaths };
}

describe('bounded project photo reads for web and the mobile workspace', () => {
  it('reads one project page, signs only 12 rows, and traverses timestamp ties without duplication', async () => {
    const rows = Array.from({ length: 27 }, (_, i) => photo(i + 1));
    const f = fixture([...rows, photo(99, { project_id: otherProjectId })]);
    const delivered: string[] = [];
    let cursor: PhotoCursor | null = null;
    do {
      const { page, serverTiming } = await getProjectPhotoPage(f.client, projectId, { ...options, cursor });
      assert.ok(page.data.length <= 12);
      assert.ok(page.data.every((row) => row.signed_url && !row.signed_url_error));
      assert.match(serverTiming, /auth;dur=.*membership;dur=.*query;dur=.*signing;dur=.*total;dur=/);
      delivered.push(...page.data.map((row) => row.id)); cursor = page.nextCursor;
      if (cursor) assert.equal(cursor.createdAt, rows[0].created_at, 'keep all six fractional digits');
    } while (cursor);
    assert.deepEqual(delivered, rows.map((row) => row.id).sort().reverse());
    assert.equal(new Set(delivered).size, 27);
    assert.equal(f.signedPaths.length, 27);
    assert.equal(f.queries.filter((url) => url.pathname.endsWith('/attachments')).length, 3);
    assert.ok(f.queries.every((url) => !/submittals|rfis|daily_logs|punch_list_items|safety_incidents/.test(url.pathname)));
  });

  it('filters photos before the database limit even behind more than 1000 documents', async () => {
    const documents = Array.from({ length: 1100 }, (_, i) => photo(i + 100, { file_type: 'application/pdf', photo_category: 'document' }));
    const f = fixture([...documents, photo(1), photo(2, { photo_category: 'thermal' })]);
    const standard = await getProjectPhotoPage(f.client, projectId, { ...options, category: 'standard' });
    assert.deepEqual(standard.page.data.map((row) => row.id), [photo(1).id]);
    assert.equal(standard.page.nextCursor, null);
    const thermal = await getProjectPhotoPage(f.client, projectId, { ...options, category: 'thermal' });
    assert.deepEqual(thermal.page.data.map((row) => row.id), [photo(2).id]);
  });

  it('keeps the next page stable when new uploads and deletions change earlier rows', async () => {
    const rows = Array.from({ length: 27 }, (_, i) => photo(i + 1));
    const f = fixture(rows);
    const first = await getProjectPhotoPage(f.client, projectId, options);
    rows.push(photo(100, { created_at: '2026-10-21T12:00:00.000000+00:00' }));
    rows.splice(rows.findIndex((row) => row.id === first.page.data[0].id), 1);
    const second = await getProjectPhotoPage(f.client, projectId, { ...options, cursor: first.page.nextCursor });
    assert.equal(second.page.data.length, 12);
    assert.ok(second.page.data.every((row) => !first.page.data.some((prior) => prior.id === row.id)));
    assert.ok(!second.page.data.some((row) => row.id === photo(100).id));
    assert.equal((await getProjectPhotoPage(f.client, projectId, options)).page.data[0].id, photo(100).id);
  });

  it('rechecks authentication and project membership before attachments or signed URLs', async () => {
    for (const config of [{ authenticated: false }, { member: false }]) {
      const f = fixture([photo(1)], config);
      await assert.rejects(getProjectPhotoPage(f.client, projectId, options), (error: unknown) =>
        error instanceof PhotoPageError && error.status === (config.authenticated === false ? 401 : 403));
      assert.equal(f.queries.some((url) => url.pathname.endsWith('/attachments')), false);
      assert.equal(f.signedPaths.length, 0);
    }
  });

  it('keeps stored photos visible with a safe retry message when URL signing fails', async () => {
    const f = fixture([photo(1)], { signFailure: true });
    const { page } = await getProjectPhotoPage(f.client, projectId, options);
    assert.equal(page.data.length, 1); assert.equal(page.data[0].signed_url, undefined);
    assert.match(page.data[0].signed_url_error!, /Refresh/);
    assert.doesNotMatch(JSON.stringify(page), /private storage diagnostic/);
    const unavailable = fixture([photo(1)], { queryFailure: true });
    await assert.rejects(getProjectPhotoPage(unavailable.client, projectId, options), /Could not load photos/);
    assert.equal(unavailable.signedPaths.length, 0);
  });

  it('does not sign a stored path from another project', async () => {
    const f = fixture([photo(1, { file_url: `https://fixture.supabase.co/storage/v1/object/public/project-photos/${otherProjectId}/private.jpg` })]);
    const { page } = await getProjectPhotoPage(f.client, projectId, options);
    assert.ok(page.data[0].signed_url_error); assert.equal(f.signedPaths.length, 0);
  });

  it('rejects malformed cursors and filter injection before query construction', () => {
    const good = { createdAt: photo(1).created_at, id: photo(1).id };
    const params = new URLSearchParams({ page: 'cursor', cursor: JSON.stringify(good) });
    assert.deepEqual(parsePhotoPageOptions(params), { category: 'all', cursor: good });
    for (const value of ['{}', 'null', '[1]', 'not-json', JSON.stringify({ ...good, id: 'x),project_id.eq.other' }), JSON.stringify({ ...good, createdAt: 'today,project_id.eq.other' })]) {
      params.set('cursor', value); assert.throws(() => parsePhotoPageOptions(params));
    }
    assert.throws(() => parsePhotoPageOptions(new URLSearchParams({ page: 'cursor', category: 'anything' })));
  });

  it('uses same-origin uncached GETs, propagates aborts, and rejects stale/denied response formats', async () => {
    const original = globalThis.fetch;
    const controller = new AbortController();
    try {
      globalThis.fetch = async (url, init) => {
        assert.match(String(url), /page=cursor&category=thermal/);
        assert.equal(init?.signal, controller.signal); assert.equal(init?.cache, 'no-store');
        assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.redirect, 'error');
        return Response.json({ data: [], nextCursor: null });
      };
      assert.deepEqual(await readProjectPhotoPage(projectId, { ...options, category: 'thermal' }, controller.signal), { data: [], nextCursor: null });
      globalThis.fetch = async () => Response.json({ data: [] });
      await assert.rejects(readProjectPhotoPage(projectId, options, controller.signal), /refresh and retry/);
      globalThis.fetch = async () => Response.json({ error: 'Access revoked' }, { status: 403 });
      await assert.rejects(readProjectPhotoPage(projectId, options, controller.signal), (error: unknown) => error instanceof PhotoPageRequestError && error.status === 403);
    } finally { globalThis.fetch = original; }
  });
});
