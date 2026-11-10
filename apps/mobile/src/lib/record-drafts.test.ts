import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'mocha';
import type { MobileRecordDraft, MobileRecordFormOptions } from '@railcommand/domain';
import { cleanFormOptions, cleanRecordDraft, createDraftWriter, createRecordDraftStore, type RecordDraftDatabase } from './record-drafts';

const projectId = '20000000-0000-4000-8000-000000000001';
const otherProject = '20000000-0000-4000-8000-000000000002';
const clientId = '30000000-0000-4000-8000-000000000001';
const draft: MobileRecordDraft = { version: 1, kind: 'rfis', projectId, clientId, title: 'Synthetic question', body: '', priority: 'medium', assignedTo: '', dueDate: '', milestoneId: '', specSection: '', updatedAt: new Date().toISOString() };
function harness() {
  const databases = new Map<string, DatabaseSync>();
  let opens = 0;
  const open = async (user: string): Promise<RecordDraftDatabase> => {
    opens += 1;
    if (!databases.has(user)) {
      const db = new DatabaseSync(':memory:');
      db.exec('CREATE TABLE record_drafts(draft_key TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE TABLE cache_records(cache_key TEXT PRIMARY KEY, payload TEXT NOT NULL, cached_at TEXT NOT NULL);');
      databases.set(user, db);
    }
    const db = databases.get(user)!;
    return {
      getFirstAsync: async <T>(sql: string, ...params: string[]) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
      getAllAsync: async <T>(sql: string, ...params: string[]) => db.prepare(sql).all(...params) as T[],
      runAsync: async (sql, ...params) => db.prepare(sql).run(...params),
    };
  };
  return { store: createRecordDraftStore(open), open, databases, opens: () => opens, close: () => databases.forEach((db) => db.close()) };
}

describe('Native RFI/Submittal draft persistence', () => {
  it('partitions actual SQLite records by user, project and kind across store instances', async () => {
    const h = harness();
    try {
      await h.store.save('A', draft);
      await h.store.save('A', { ...draft, kind: 'submittals', title: 'Submittal' });
      await h.store.save('A', { ...draft, projectId: otherProject, title: 'Other project' });
      assert.equal(await h.store.read('B', 'rfis', projectId), null);
      const restarted = createRecordDraftStore(h.open);
      assert.deepEqual(await restarted.read('A', 'rfis', projectId), draft);
      assert.equal((await restarted.list('A')).length, 3);
      assert.equal((await restarted.read('A', 'submittals', projectId))?.title, 'Submittal');
      assert.equal((await restarted.read('A', 'rfis', otherProject))?.title, 'Other project');
    } finally { h.close(); }
  });
  it('never erases a newer draft when clearing an old creation receipt', async () => {
    const h = harness();
    try {
      const next = { ...draft, clientId: '30000000-0000-4000-8000-000000000002' };
      await h.store.save('A', next); await h.store.removeCreated('A', { ...draft, createdId: clientId });
      assert.equal((await h.store.read('A', 'rfis', projectId))?.clientId, next.clientId);
      await h.store.removeCreated('A', { ...next, createdId: next.clientId });
      assert.equal(await h.store.read('A', 'rfis', projectId), null);
    } finally { h.close(); }
  });
  it('does not replace or delete unreadable persisted input', async () => {
    const h = harness();
    try {
      await h.store.save('A', draft);
      h.databases.get('A')!.exec("UPDATE record_drafts SET payload = 'unreadable'");
      await assert.rejects(h.store.read('A', 'rfis', projectId));
      await assert.rejects(h.store.list('A'));
      assert.equal(h.databases.get('A')!.prepare('SELECT payload FROM record_drafts').get()?.payload, 'unreadable');
    } finally { h.close(); }
  });
  it('strips transport fields, rejects invalid kind/receipt and oversized storage', () => {
    assert.deepEqual(cleanRecordDraft({ ...draft, accessToken: 'not-persisted' }, 'rfis', projectId), draft);
    for (const invalid of [{ ...draft, kind: 'profiles' }, { ...draft, createdId: otherProject }, { ...draft, body: 'x'.repeat(256 * 1024) }]) {
      assert.throws(() => cleanRecordDraft(invalid, invalid.kind as 'rfis', projectId));
    }
  });
  it('serializes writes, snapshots input and recovers after a failed write', async () => {
    const seen: string[] = [];
    const writer = createDraftWriter(async (value) => { seen.push(value.title); if (value.title === 'bad') throw new Error('quota'); });
    const first = { ...draft, title: 'first' }; const p1 = writer(first); first.title = 'mutated';
    const p2 = writer({ ...draft, title: 'bad' }); const p3 = writer({ ...draft, title: 'last' });
    await p1; await assert.rejects(p2, /quota/); await p3;
    assert.deepEqual(seen, ['first', 'bad', 'last']);
  });
  it('does not reopen a user database after its caller scope has ended', async () => {
    const h = harness();
    await assert.rejects(h.store.save('A', draft, () => false));
    assert.equal(h.opens(), 0);
    let current = true;
    const store = createRecordDraftStore(async (user) => { const db = await h.open(user); current = false; return db; });
    try { await assert.rejects(store.save('A', draft, () => current)); assert.equal(await h.store.read('A', 'rfis', projectId), null); }
    finally { h.close(); }
  });
  it('expires scoped choices after seven days and stores no extra profile fields', async () => {
    const h = harness();
    const options = { kind: 'rfis', projectId, fetchedAt: new Date().toISOString(), assignees: [{ id: clientId, name: 'Reviewer', email: 'not-cached' }], milestones: [] } as unknown as MobileRecordFormOptions;
    try {
      await h.store.saveOptions('A', options);
      assert.deepEqual((await h.store.readOptions('A', 'rfis', projectId))?.assignees, [{ id: clientId, name: 'Reviewer' }]);
      assert.equal(await h.store.readOptions('B', 'rfis', projectId), null);
      assert.equal(cleanFormOptions(options, 'rfis', otherProject), null);
      assert.equal(cleanFormOptions({ ...options, fetchedAt: new Date(Date.now() - 8 * 86400000).toISOString() }, 'rfis', projectId), null);
    } finally { h.close(); }
  });
  it('cancels stale reads and receipt cleanup before opening storage or after a delayed open', async () => {
    const h = harness();
    try {
      await h.store.save('A', { ...draft, createdId: draft.clientId });
      const opened = h.opens();
      await assert.rejects(h.store.read('A', 'rfis', projectId, () => false), /cancelled/);
      assert.equal(await h.store.readOptions('A', 'rfis', projectId, () => false), null);
      await h.store.removeCreated('A', draft, () => false);
      assert.equal(h.opens(), opened);
      let current = true;
      const delayed = createRecordDraftStore(async (user) => {
        const db = await h.open(user);
        current = false;
        return db;
      });
      await delayed.removeCreated('A', draft, () => current);
      assert.equal((await h.store.read('A', 'rfis', projectId))?.createdId, draft.clientId);
      current = true;
      await assert.rejects(delayed.read('A', 'rfis', projectId, () => current), /cancelled/);
      current = true;
      assert.equal(await delayed.readOptions('A', 'rfis', projectId, () => current), null);
    } finally { h.close(); }
  });
});
