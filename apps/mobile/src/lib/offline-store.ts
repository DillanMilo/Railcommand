import type { MobileBootstrap, MobileDailyLogDraft, MobileDailyLogSyncOperation, MobileGeoTag, MobileRecordDetail, MobileRecordScope } from '@railcommand/domain';
import { draftToSyncOperation } from '@railcommand/domain';
import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { mobileConfig } from './config';
import { cleanRecordDetail, recordCacheKey, recordCacheMaxAge } from './record-detail';
import { parseBotDraft, serializeBotDraft, type BotDraft } from './railbot';
import { createRecordDraftStore } from './record-drafts';
import { beginOfflinePurge, captureOfflineScope } from './storage-scope';

export type ExpoStoredPhoto = {
  photoId: string;
  projectId: string;
  parentClientId: string;
  uri: string;
  fileName: string;
  fileType: string;
  size: number;
  capturedAt: string;
  geoTag: MobileGeoTag | null;
  status: 'pending' | 'retrying' | 'failed' | 'conflicted';
  lastError: string | null;
};

export type ExpoSyncRow = {
  id: string;
  kind: 'daily_log' | 'photo';
  state: 'pending' | 'retrying' | 'failed' | 'conflicted' | 'synchronized';
  label: string;
  detail: string | null;
  updatedAt: string;
};

export type ExpoDailyLogSyncOperation = MobileDailyLogSyncOperation & {
  photoManifestVersion: 0 | 1;
  photoIds: string[];
};

const dbPromises = new Map<string, Promise<SQLite.SQLiteDatabase>>();

function storageGuard(userId: string, isCurrent: () => boolean = () => true): () => boolean {
  const offlineCurrent = captureOfflineScope(userId);
  return () => offlineCurrent() && isCurrent();
}

function requireCurrent(isCurrent: () => boolean): void {
  if (!isCurrent()) throw new Error('Device operation canceled after its account or storage scope changed.');
}

function databaseName(userId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid offline user scope');
  return `railcommand-${mobileConfig.profile}-${userId}.db`;
}

async function openUserDatabase(userId: string): Promise<SQLite.SQLiteDatabase> {
  const isCurrent = captureOfflineScope(userId);
  requireCurrent(isCurrent);
  const name = databaseName(userId);
  let pending = dbPromises.get(name);
  if (!pending) {
    pending = SQLite.openDatabaseAsync(name).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS cache_records (
          cache_key TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          cached_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS drafts (
          project_id TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS railbot_drafts (project_id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, pending INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS record_drafts (
          draft_key TEXT PRIMARY KEY NOT NULL,
          payload TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS photos (
          photo_id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          parent_client_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL,
          last_error TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS photos_parent_idx ON photos(parent_client_id);
        CREATE TABLE IF NOT EXISTS outbox (
          operation_id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sync_history (
          item_id TEXT PRIMARY KEY NOT NULL,
          kind TEXT NOT NULL,
          label TEXT NOT NULL,
          completed_at TEXT NOT NULL
        );
      `);
      return db;
    });
    dbPromises.set(name, pending);
  }
  const db = await pending;
  requireCurrent(isCurrent);
  return db;
}

export const recordDraftStore = createRecordDraftStore(openUserDatabase);

export async function cacheBootstrap(userId: string, bootstrap: MobileBootstrap, isCurrent: () => boolean = () => true): Promise<void> {
  if (bootstrap.userId !== userId) throw new Error('Cannot cache another account’s project data.');
  isCurrent = storageGuard(userId, isCurrent);
  requireCurrent(isCurrent);
  const db = await openUserDatabase(userId);
  await db.withExclusiveTransactionAsync(async (txn) => {
    requireCurrent(isCurrent);
    await txn.runAsync(
    `INSERT INTO cache_records(cache_key, payload, cached_at) VALUES('bootstrap', ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at`,
    JSON.stringify(bootstrap), bootstrap.synchronizedAt,
    );
    requireCurrent(isCurrent);
  });
}

export async function readCachedBootstrap(userId: string, isCurrent: () => boolean = () => true): Promise<MobileBootstrap | null> {
  isCurrent = storageGuard(userId, isCurrent);
  requireCurrent(isCurrent);
  const db = await openUserDatabase(userId);
  requireCurrent(isCurrent);
  const row = await db.getFirstAsync<{ payload: string }>(
    `SELECT payload FROM cache_records WHERE cache_key = 'bootstrap'`,
  );
  if (!isCurrent() || !row) return null;
  try {
    const cached = JSON.parse(row.payload) as MobileBootstrap;
    if (cached.userId !== userId || !Array.isArray(cached.projects) || !Array.isArray(cached.dailyLogs)) return null;
    return { ...cached, team: cached.team ?? [] };
  } catch { return null; }
}

export async function readCachedRecord(userId: string, scope: MobileRecordScope, isCurrent: () => boolean): Promise<MobileRecordDetail | null> {
  if (!isCurrent()) return null;
  const db = await openUserDatabase(userId);
  if (!isCurrent()) return null;
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM cache_records WHERE cache_key = ?', recordCacheKey(scope));
  if (!isCurrent() || !row) return null;
  try { return cleanRecordDetail(JSON.parse(row.payload), scope); } catch { return null; }
}

export async function cacheRecord(userId: string, scope: MobileRecordScope, value: MobileRecordDetail, isCurrent: () => boolean): Promise<void> {
  const clean = cleanRecordDetail(value, scope);
  if (!clean) throw new Error('Invalid record cache payload');
  if (!isCurrent()) return;
  const db = await openUserDatabase(userId);
  if (!isCurrent()) return;
  await db.withExclusiveTransactionAsync(async (txn) => {
    if (!isCurrent()) return;
    await txn.runAsync(`INSERT INTO cache_records(cache_key, payload, cached_at) VALUES(?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at`,
    recordCacheKey(scope), JSON.stringify(clean), clean.fetchedAt);
    // Bound read-only cache growth without touching field drafts, photos, or outbox.
    await txn.runAsync("DELETE FROM cache_records WHERE cache_key LIKE 'record:%' AND cached_at < ?", new Date(Date.now() - recordCacheMaxAge).toISOString());
    await txn.runAsync("DELETE FROM cache_records WHERE cache_key IN (SELECT cache_key FROM cache_records WHERE cache_key LIKE 'record:%' ORDER BY cached_at DESC, cache_key LIMIT -1 OFFSET 50)");
  });
}

export async function removeCachedRecord(userId: string, scope: MobileRecordScope, isCurrent: () => boolean): Promise<void> {
  if (!isCurrent()) return;
  const db = await openUserDatabase(userId);
  if (isCurrent()) await db.runAsync('DELETE FROM cache_records WHERE cache_key = ?', recordCacheKey(scope));
}

export async function saveExpoDraft(userId: string, draft: MobileDailyLogDraft, isCurrent: () => boolean = () => true): Promise<void> {
  isCurrent = storageGuard(userId, isCurrent);
  if (!isCurrent()) throw new Error('Draft save canceled after the account or project changed.');
  const db = await openUserDatabase(userId);
  if (!isCurrent()) throw new Error('Draft save canceled after the account or project changed.');
  await db.runAsync(
    `INSERT INTO drafts(project_id, payload, updated_at) VALUES(?, ?, ?)
     ON CONFLICT(project_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
    draft.projectId, JSON.stringify(draft), draft.updatedAt,
  );
}

export async function readExpoDraft(userId: string, projectId: string): Promise<MobileDailyLogDraft | null> {
  const db = await openUserDatabase(userId);
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM drafts WHERE project_id = ?', projectId);
  return row ? JSON.parse(row.payload) as MobileDailyLogDraft : null;
}

export async function saveExpoPhoto(userId: string, photo: ExpoStoredPhoto, isCurrent: () => boolean = () => true): Promise<void> {
  isCurrent = storageGuard(userId, isCurrent);
  if (!isCurrent()) throw new Error('Photo save canceled after the account or project changed.');
  const db = await openUserDatabase(userId);
  if (!isCurrent()) throw new Error('Photo save canceled after the account or project changed.');
  await db.runAsync(
    `INSERT INTO photos(photo_id, project_id, parent_client_id, payload, status, last_error, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(photo_id) DO UPDATE SET payload = excluded.payload, status = excluded.status,
       last_error = excluded.last_error, updated_at = excluded.updated_at`,
    photo.photoId, photo.projectId, photo.parentClientId, JSON.stringify(photo), photo.status,
    photo.lastError, new Date().toISOString(),
  );
}

export async function listExpoPhotos(userId: string, parentClientId: string, isCurrent: () => boolean = () => true): Promise<ExpoStoredPhoto[]> {
  isCurrent = storageGuard(userId, isCurrent);
  requireCurrent(isCurrent);
  const db = await openUserDatabase(userId);
  requireCurrent(isCurrent);
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM photos WHERE parent_client_id = ?', parentClientId);
  requireCurrent(isCurrent);
  return rows.map((row) => JSON.parse(row.payload) as ExpoStoredPhoto);
}

export async function queueExpoDraft(
  userId: string,
  projectId: string,
  expectedPhotoIds: string[] = [],
  isCurrent: () => boolean = () => true,
): Promise<ExpoDailyLogSyncOperation> {
  isCurrent = storageGuard(userId, isCurrent);
  if (!isCurrent()) throw new Error('Queue canceled after the account or project changed.');
  const db = await openUserDatabase(userId);
  let operation: ExpoDailyLogSyncOperation | null = null;
  await db.withExclusiveTransactionAsync(async (txn) => {
    if (!isCurrent()) throw new Error('Queue canceled after the account or project changed.');
    const saved = await txn.getFirstAsync<{ payload: string }>('SELECT payload FROM drafts WHERE project_id = ?', projectId);
    if (!saved) throw new Error('No saved draft is available to submit');
    const draft = JSON.parse(saved.payload) as MobileDailyLogDraft;
    if (draft.projectId !== projectId) throw new Error('The saved draft project could not be verified. Nothing was queued.');
    const photoRows = await txn.getAllAsync<{ photo_id: string }>(
      'SELECT photo_id FROM photos WHERE parent_client_id = ? ORDER BY photo_id',
      draft.clientId,
    );
    const persistedPhotoIds = photoRows.map((row) => row.photo_id);
    requireCurrent(isCurrent);
    const persisted = new Set(persistedPhotoIds);
    if (expectedPhotoIds.some((photoId) => !persisted.has(photoId))) {
      throw new Error('A displayed photo is no longer available on this device. The draft was kept; capture the photo again before queueing.');
    }
    operation = { ...draftToSyncOperation(userId, draft), photoManifestVersion: 1, photoIds: persistedPhotoIds };
    if (new TextEncoder().encode(JSON.stringify(operation)).length > 64 * 1024) throw new Error('This log and photo manifest exceed the mobile request size limit. The draft and photos were kept.');
    await txn.runAsync(
      `INSERT INTO outbox(operation_id, project_id, payload, status, attempt_count, updated_at)
       VALUES(?, ?, ?, 'pending', 0, ?)
       ON CONFLICT(operation_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      operation.operationId, operation.projectId, JSON.stringify(operation), operation.updatedAt,
    );
    await txn.runAsync('DELETE FROM drafts WHERE project_id = ?', projectId);
    requireCurrent(isCurrent);
  });
  if (!operation) throw new Error('Could not create the device queue item. The draft remains saved.');
  return operation;
}

export async function listExpoOutbox(userId: string, isCurrent: () => boolean = () => true): Promise<ExpoDailyLogSyncOperation[]> {
  isCurrent = storageGuard(userId, isCurrent);
  requireCurrent(isCurrent);
  const db = await openUserDatabase(userId);
  requireCurrent(isCurrent);
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM outbox ORDER BY updated_at');
  requireCurrent(isCurrent);
  return rows.map((row) => {
    const operation = JSON.parse(row.payload) as MobileDailyLogSyncOperation & { photoManifestVersion?: number; photoIds?: string[] };
    return { ...operation, photoManifestVersion: operation.photoManifestVersion === 1 ? 1 : 0, photoIds: operation.photoIds ?? [] };
  });
}

export async function markExpoOutbox(
  userId: string,
  operation: ExpoDailyLogSyncOperation,
  status: 'retrying' | 'failed' | 'conflicted',
  error: string,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  isCurrent = storageGuard(userId, isCurrent);
  requireCurrent(isCurrent);
  const db = await openUserDatabase(userId);
  requireCurrent(isCurrent);
  const updated = { ...operation, status: status === 'retrying' ? 'retry' as const : 'failed' as const,
    attemptCount: operation.attemptCount + 1, lastError: error, updatedAt: new Date().toISOString() };
  await db.runAsync(
    'UPDATE outbox SET payload = ?, status = ?, attempt_count = ?, last_error = ?, updated_at = ? WHERE operation_id = ?',
    JSON.stringify(updated), status, updated.attemptCount, error, updated.updatedAt, operation.operationId,
  );
}

export async function markExpoPhoto(
  userId: string,
  photo: ExpoStoredPhoto,
  status: ExpoStoredPhoto['status'],
  error: string | null,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  await saveExpoPhoto(userId, { ...photo, status, lastError: error }, isCurrent);
}

export async function completeExpoSync(
  userId: string,
  operation: ExpoDailyLogSyncOperation,
  photos: ExpoStoredPhoto[],
  isCurrent: () => boolean = () => true,
): Promise<void> {
  isCurrent = storageGuard(userId, isCurrent);
  requireCurrent(isCurrent);
  const db = await openUserDatabase(userId);
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    requireCurrent(isCurrent);
    for (const photo of photos) {
      requireCurrent(isCurrent);
      await txn.runAsync(
        `INSERT OR REPLACE INTO sync_history(item_id, kind, label, completed_at) VALUES(?, 'photo', ?, ?)`,
        photo.photoId, photo.fileName, now,
      );
      await txn.runAsync('DELETE FROM photos WHERE photo_id = ?', photo.photoId);
    }
    await txn.runAsync(
      `INSERT OR REPLACE INTO sync_history(item_id, kind, label, completed_at) VALUES(?, 'daily_log', ?, ?)`,
      operation.operationId, operation.payload.log_date, now,
    );
    await txn.runAsync('DELETE FROM outbox WHERE operation_id = ?', operation.operationId);
    requireCurrent(isCurrent);
  });
}

export async function listExpoSyncRows(userId: string, isCurrent: () => boolean = () => true): Promise<ExpoSyncRow[]> {
  isCurrent = storageGuard(userId, isCurrent);
  requireCurrent(isCurrent);
  const db = await openUserDatabase(userId);
  requireCurrent(isCurrent);
  const pending = await db.getAllAsync<{ operation_id: string; status: ExpoSyncRow['state']; last_error: string | null; updated_at: string; payload: string }>(
    'SELECT operation_id, status, last_error, updated_at, payload FROM outbox ORDER BY updated_at DESC',
  );
  const history = await db.getAllAsync<{ item_id: string; kind: ExpoSyncRow['kind']; label: string; completed_at: string }>(
    'SELECT item_id, kind, label, completed_at FROM sync_history ORDER BY completed_at DESC LIMIT 25',
  );
  const photos = await db.getAllAsync<{ photo_id: string; status: ExpoSyncRow['state']; last_error: string | null; updated_at: string; payload: string }>(
    'SELECT photo_id, status, last_error, updated_at, payload FROM photos ORDER BY updated_at DESC',
  );
  requireCurrent(isCurrent);
  return [
    ...pending.map((row) => {
      const operation = JSON.parse(row.payload) as MobileDailyLogSyncOperation & { photoManifestVersion?: number; photoIds?: string[] };
      return { id: row.operation_id, kind: 'daily_log' as const, state: row.status, label: operation.payload.log_date,
        detail: row.last_error ?? (operation.photoManifestVersion === 1
          ? `${operation.photoIds?.length ?? 0} photo${operation.photoIds?.length === 1 ? '' : 's'} queued`
          : 'Photo manifest unavailable — review required'), updatedAt: row.updated_at };
    }),
    ...photos.map((row) => {
      const photo = JSON.parse(row.payload) as ExpoStoredPhoto;
      return { id: row.photo_id, kind: 'photo' as const, state: row.status, label: photo.fileName,
        detail: row.last_error, updatedAt: row.updated_at };
    }),
    ...history.map((row) => ({ id: row.item_id, kind: row.kind, state: 'synchronized' as const,
      label: row.label, detail: null, updatedAt: row.completed_at })),
  ];
}

export async function inspectExpoUnsynced(userId: string): Promise<{ drafts: number; outbox: number; photos: number }> {
  const db = await openUserDatabase(userId);
  const counts = await Promise.all(['drafts', 'outbox', 'photos', 'record_drafts', 'railbot_drafts'].map((table) =>
    db.getFirstAsync<{ count: number }>(`SELECT count(*) AS count FROM ${table}${table === 'railbot_drafts' ? ' WHERE pending = 1' : ''}`)));
  return { drafts: (counts[0]?.count ?? 0) + (counts[3]?.count ?? 0) + (counts[4]?.count ?? 0), outbox: counts[1]?.count ?? 0, photos: counts[2]?.count ?? 0 };
}

export async function purgeExpoUser(userId: string): Promise<void> {
  const name = databaseName(userId);
  const finishPurge = beginOfflinePurge(userId);
  try {
    // Do not reopen a database merely to delete it. In-flight opens must finish
    // before close/delete; every old scope is already invalid at this point.
    const pending = dbPromises.get(name);
    if (pending) {
      const db = await pending;
      const audio = await db.getAllAsync<{ payload: string }>('SELECT payload FROM railbot_drafts');
      for (const row of audio) {
        try {
          const uri = JSON.parse(row.payload).audioUri;
          // Expo creates active recordings in Documents before we move them into the user folder.
          if (typeof uri === 'string' && uri.startsWith(Paths.document.uri) && uri.endsWith('.m4a') && !uri.includes('..')) {
            const file = new File(uri); if (file.exists) file.delete();
          }
        } catch { /* User folder cleanup below still applies. */ }
      }
      await db.closeAsync();
    }
    dbPromises.delete(name);
    await SQLite.deleteDatabaseAsync(name);
    const userFiles = new Directory(Paths.document, 'railcommand', userId);
    if (userFiles.exists) userFiles.delete();
  } finally { finishPurge(); }
}

export async function readBotDraft(userId: string, projectId: string, current: () => boolean) {
  const valid = storageGuard(userId, current); requireCurrent(valid);
  const db = await openUserDatabase(userId); requireCurrent(valid);
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM railbot_drafts WHERE project_id = ?', projectId);
  requireCurrent(valid); return row ? parseBotDraft(row.payload, projectId) : null;
}
export async function saveBotDraft(userId: string, draft: BotDraft, current: () => boolean) {
  const valid = storageGuard(userId, current); requireCurrent(valid);
  const raw = serializeBotDraft(draft);
  const db = await openUserDatabase(userId); requireCurrent(valid);
  await db.runAsync('INSERT INTO railbot_drafts(project_id,payload,pending) VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET payload=excluded.payload,pending=excluded.pending', draft.projectId, raw, draft.input.trim() || draft.audioUri || draft.proposal || draft.uncertain ? 1 : 0);
}
