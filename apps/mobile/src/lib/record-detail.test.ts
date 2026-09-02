import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import type { MobileRecordDetail } from '@railcommand/domain';
import { cleanRecordDetail, loadRecordDetail, recordCacheKey, recordCacheMaxAge, recordScope, verifiedAttachmentUrl, type RecordReadDependencies, type RecordReadState } from './record-detail';

const projectId = '20000000-0000-4000-8000-000000000001';
const recordId = '30000000-0000-4000-8000-000000000001';
const attachmentId = '40000000-0000-4000-8000-000000000001';
const scope = { projectId, recordId, kind: 'rfis' as const };
const fixture = (): MobileRecordDetail => ({ kind: 'rfis', fetchedAt: new Date().toISOString(), milestone: null,
  attachments: [{ id: attachmentId, fileName: 'photo.jpg', fileType: 'image/jpeg', size: 100, category: 'standard' }],
  record: { id: recordId, projectId, number: 'RFI-001', subject: 'Synthetic question', question: 'Question text', answer: null,
    status: 'open', priority: 'high', submitDate: '2026-08-29', responseDate: null, dueDate: '2026-09-01', createdAt: '2026-08-29T12:00:00Z',
    submittedBy: { id: 'reviewer', name: 'Synthetic Reviewer' }, assignedTo: null, responses: [] },
});
function harness(cached: MobileRecordDetail | null = fixture()) {
  const states: RecordReadState[] = []; const actions: string[] = [];
  const deps: RecordReadDependencies = {
    read: async () => { actions.push('read'); return cached; },
    fetch: async () => { actions.push('fetch'); return fixture(); },
    save: async () => { actions.push('save'); }, remove: async () => { actions.push('remove'); },
    isCurrent: () => true, emit: (state) => states.push(state),
  };
  return { states, actions, deps };
}

describe('Native read-only record details', () => {
  it('validates routes and partitions cache keys by kind, project, and record', () => {
    assert.deepEqual(recordScope('rfis', projectId, recordId), scope);
    for (const kind of ['profiles', [], null]) assert.equal(recordScope(kind, projectId, recordId), null);
    assert.equal(recordScope('rfis', '../other', recordId), null);
    assert.equal(new Set([scope, { ...scope, kind: 'submittals' as const }, { ...scope, projectId: 'other' }, { ...scope, recordId: 'other' }].map(recordCacheKey)).size, 4);
  });
  it('caches only explicitly approved text and metadata, never transport URLs or profile extras', () => {
    const value = fixture();
    Object.assign(value, { signedUrl: 'private-token-url', accessToken: 'do-not-store' });
    Object.assign(value.record.submittedBy!, { email: 'private-email' });
    Object.assign(value.attachments[0], { url: 'private-token-url' });
    const cleaned = cleanRecordDetail(value, scope);
    assert.ok(cleaned); assert.doesNotMatch(JSON.stringify(cleaned), /private-token|private-email|do-not-store/);
    assert.equal(cleaned.record.number, 'RFI-001');
  });
  it('rejects malformed, cross-project, expired, future-dated, and oversized caches', () => {
    const now = Date.now();
    const large = fixture(); if (large.kind === 'rfis') large.record.question = 'x'.repeat(2 * 1024 * 1024);
    for (const value of [null, {}, { ...fixture(), fetchedAt: 'bad' }, { ...fixture(), fetchedAt: new Date(now - recordCacheMaxAge - 1).toISOString() },
      { ...fixture(), fetchedAt: new Date(now + 600_000).toISOString() }, { ...fixture(), record: { ...fixture().record, projectId: 'other' } }, large]) {
      assert.equal(cleanRecordDetail(value as MobileRecordDetail, scope, now), null);
    }
  });
  it('opens cached text offline without any request or queued mutation', async () => {
    const h = harness(); await loadRecordDetail(scope, false, h.deps);
    assert.deepEqual(h.actions, ['read']); assert.equal(h.states.at(-1)?.cached, true);
    assert.equal(h.states.at(-1)?.loading, false); assert.ok(h.states.at(-1)?.detail);
  });
  it('shows an explicit offline cache miss without substituting a list summary', async () => {
    const h = harness(null); await loadRecordDetail(scope, false, h.deps);
    assert.equal(h.states.at(-1)?.detail, null); assert.match(h.states.at(-1)!.message, /not been saved/);
  });
  it('refreshes cached text and persists the permission-checked result', async () => {
    const h = harness(); await loadRecordDetail(scope, true, h.deps, { force: true });
    assert.deepEqual(h.actions, ['read', 'fetch', 'save']);
    assert.equal(h.states[0].cached, true); assert.equal(h.states.at(-1)?.cached, false);
  });
  it('reuses a recently synchronized record without requesting it again', async () => {
    const h = harness(); await loadRecordDetail(scope, true, h.deps, { now: Date.now() });
    assert.deepEqual(h.actions, ['read']);
    assert.match(h.states.at(-1)!.message, /Recently synchronized/);
    assert.equal(h.states.at(-1)?.loading, false);
  });
  it('keeps saved read-only text after a dropped connection, but removes it after authoritative denial', async () => {
    for (const status of [0, 503, 401, 403, 404]) {
      const h = harness(); h.deps.fetch = async () => { throw Object.assign(new Error('failed'), { status }); };
      await loadRecordDetail(scope, true, h.deps, { force: true });
      const denied = [401, 403, 404].includes(status);
      assert.equal(h.actions.includes('remove'), denied);
      assert.equal(h.states.at(-1)?.detail === null, denied); assert.equal(h.states.at(-1)?.loading, false);
    }
  });
  it('discards stale responses after leaving the screen or switching accounts/projects', async () => {
    for (const stage of ['read', 'fetch', 'save'] as const) {
      const h = harness(); let current = true; h.deps.isCurrent = () => current;
      const original = h.deps[stage];
      if (stage === 'save') h.deps.save = async () => { current = false; };
      else h.deps[stage] = async () => { current = false; return (original as () => Promise<MobileRecordDetail | null>)() as Promise<MobileRecordDetail>; };
      await loadRecordDetail(scope, true, h.deps, { force: true });
      assert.equal(h.states.some((state) => /Up to date/.test(state.message)), false);
      if (stage === 'read') assert.deepEqual(h.actions, ['read']);
      if (stage === 'fetch') assert.equal(h.actions.includes('save'), false);
    }
  });
  it('reports storage failures without claiming offline persistence or discarding current text', async () => {
    const h = harness(null); h.deps.save = async () => { throw new Error('quota'); };
    await loadRecordDetail(scope, true, h.deps, { force: true });
    assert.ok(h.states.at(-1)?.detail); assert.match(h.states.at(-1)!.message, /not saved/);
    const denied = harness(); denied.deps.fetch = async () => { throw { status: 403 }; };
    denied.deps.remove = async () => { throw new Error('storage failure'); };
    await loadRecordDetail(scope, true, denied.deps, { force: true });
    assert.equal(denied.states.at(-1)?.detail, null); assert.match(denied.states.at(-1)!.message, /Sign out/);
  });
  it('opens only fresh signed attachments from the configured project and exact record path', () => {
    const attachment = fixture().attachments[0];
    const base = { attachmentId, expiresAt: new Date(Date.now() + 60_000).toISOString(),
      url: `https://staging.example/storage/v1/object/sign/project-photos/${projectId}/rfi/${recordId}/123-photo.jpg?token=synthetic` };
    assert.equal(verifiedAttachmentUrl(base, attachment, scope, 'https://staging.example'), base.url);
    for (const link of [{ ...base, attachmentId: 'wrong' }, { ...base, expiresAt: new Date(0).toISOString() },
      { ...base, url: base.url.replace('staging.example', 'foreign.example') }, { ...base, url: base.url.replace('/rfi/', '/daily_log/') },
      { ...base, url: base.url.replace(recordId, projectId) }, { ...base, url: base.url.replace('123-photo.jpg', '%2E%2E%2Fother.jpg') },
      { ...base, url: base.url + '&redirect=https://foreign.example' }, { ...base, url: base.url.replace('https:', 'http:') }]) {
      assert.equal(verifiedAttachmentUrl(link, attachment, scope, 'https://staging.example'), null);
    }
  });
});
