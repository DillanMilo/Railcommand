import type { MobileRecordDraft, MobileRecordKind, MobileRecordFormOptions } from '@railcommand/domain';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const recordDraftKey = (kind: MobileRecordKind, projectId: string) => `${kind}:${projectId}`;
export function cleanRecordDraft(value: unknown, kind: MobileRecordKind, projectId: string): MobileRecordDraft {
  if (!value || typeof value !== 'object') throw new Error('Saved draft is unreadable. It has not been deleted.');
  const row = value as Record<string, unknown>;
  if ((kind !== 'rfis' && kind !== 'submittals') || row.version !== 1 || row.kind !== kind || row.projectId !== projectId || !uuid.test(projectId) || typeof row.clientId !== 'string' || !uuid.test(row.clientId)) throw new Error('Saved draft identity could not be verified.');
  const fields = ['title', 'body', 'priority', 'assignedTo', 'dueDate', 'milestoneId', 'specSection', 'updatedAt'] as const;
  for (const field of fields) if (typeof row[field] !== 'string') throw new Error('Saved draft fields could not be read.');
  if (row.createdId !== undefined && row.createdId !== row.clientId) throw new Error('Saved creation receipt could not be verified.');
  const draft = Object.fromEntries(fields.map((key) => [key, row[key]])) as unknown as MobileRecordDraft;
  Object.assign(draft, { version: 1, kind, projectId, clientId: row.clientId });
  if (row.createdId) draft.createdId = row.createdId as string;
  if (new TextEncoder().encode(JSON.stringify(draft)).length > 256 * 1024) throw new Error('Draft storage limit reached. Shorten the text before leaving.');
  return draft;
}

export interface RecordDraftDatabase {
  getFirstAsync<T>(sql: string, ...params: string[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: string[]): Promise<T[]>;
  runAsync(sql: string, ...params: string[]): Promise<unknown>;
}

export function createRecordDraftStore(open: (userId: string) => Promise<RecordDraftDatabase>) {
  return {
    async read(userId: string, kind: MobileRecordKind, projectId: string, isCurrent: () => boolean = () => true) {
      if (!isCurrent()) throw new Error('Draft read cancelled after the account or screen changed.');
      const db = await open(userId);
      if (!isCurrent()) throw new Error('Draft read cancelled after the account or screen changed.');
      const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM record_drafts WHERE draft_key = ?', recordDraftKey(kind, projectId));
      if (!isCurrent()) throw new Error('Draft read cancelled after the account or screen changed.');
      return row ? cleanRecordDraft(JSON.parse(row.payload), kind, projectId) : null;
    },
    async save(userId: string, value: MobileRecordDraft, isCurrent: () => boolean = () => true) {
      if (!isCurrent()) throw new Error('Draft save cancelled after the account or screen changed.');
      const draft = cleanRecordDraft(value, value.kind, value.projectId);
      const db = await open(userId);
      if (!isCurrent()) throw new Error('Draft save cancelled after the account or screen changed.');
      await db.runAsync(`INSERT INTO record_drafts(draft_key, payload, updated_at) VALUES(?, ?, ?)
        ON CONFLICT(draft_key) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      recordDraftKey(draft.kind, draft.projectId), JSON.stringify(draft), draft.updatedAt);
    },
    async removeCreated(userId: string, value: MobileRecordDraft, isCurrent: () => boolean = () => true) {
      if (!isCurrent()) return;
      const db = await open(userId);
      if (!isCurrent()) return;
      // Never remove a newer draft which happens to use the same form route.
      await db.runAsync('DELETE FROM record_drafts WHERE draft_key = ? AND json_extract(payload, \'$.clientId\') = ?', recordDraftKey(value.kind, value.projectId), value.clientId);
    },
    async list(userId: string) {
      const db = await open(userId);
      const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM record_drafts ORDER BY updated_at DESC');
      return rows.map((row) => {
        const value = JSON.parse(row.payload) as MobileRecordDraft;
        return cleanRecordDraft(value, value.kind, value.projectId);
      });
    },
    async saveOptions(userId: string, options: MobileRecordFormOptions, isCurrent: () => boolean = () => true) {
      if (!isCurrent()) return;
      const clean = cleanFormOptions(options, options.kind, options.projectId);
      if (!clean) throw new Error('Form choices could not be verified');
      const db = await open(userId);
      if (!isCurrent()) return;
      await db.runAsync(`INSERT INTO cache_records(cache_key, payload, cached_at) VALUES(?, ?, ?)
        ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at`,
      `record-options:${recordDraftKey(clean.kind, clean.projectId)}`, JSON.stringify(clean), clean.fetchedAt);
    },
    async readOptions(userId: string, kind: MobileRecordKind, projectId: string, isCurrent: () => boolean = () => true) {
      if (!isCurrent()) return null;
      const db = await open(userId);
      if (!isCurrent()) return null;
      const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM cache_records WHERE cache_key = ?', `record-options:${recordDraftKey(kind, projectId)}`);
      if (!isCurrent()) return null;
      try { return row ? cleanFormOptions(JSON.parse(row.payload), kind, projectId) : null; } catch { return null; }
    },
  };
}

export function cleanFormOptions(value: MobileRecordFormOptions, kind: MobileRecordKind, projectId: string): MobileRecordFormOptions | null {
  try {
    const age = Date.now() - Date.parse(value.fetchedAt);
    if ((kind !== 'rfis' && kind !== 'submittals') || !uuid.test(projectId) || value.kind !== kind || value.projectId !== projectId || !Number.isFinite(age) || age < -300_000 || age > 7 * 24 * 60 * 60_000) return null;
    const people = (rows: MobileRecordFormOptions['assignees']) => {
      if (!Array.isArray(rows) || rows.length > 500 || rows.some((row) => !uuid.test(row.id) || typeof row.name !== 'string')) throw new Error('Invalid choices');
      return rows.map(({ id, name }) => ({ id, name }));
    };
    return { kind, projectId, fetchedAt: value.fetchedAt, assignees: people(value.assignees), milestones: people(value.milestones) };
  } catch { return null; }
}

// Serialize autosaves so an earlier slow write cannot replace newer input.
export function createDraftWriter(write: (draft: MobileRecordDraft) => Promise<void>) {
  let pending = Promise.resolve();
  return (draft: MobileRecordDraft) => {
    const snapshot = { ...draft };
    pending = pending.catch(() => undefined).then(() => write(snapshot));
    return pending;
  };
}
