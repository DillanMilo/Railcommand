import type { MobileBootstrap, MobileDailyLogDraft, MobileDailyLogSyncOperation, MobileGeoTag } from '@railcommand/domain';
import { draftToSyncOperation } from '@railcommand/domain';
import { Directory, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { mobileConfig } from './config';

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

const dbPromises = new Map<string, Promise<SQLite.SQLiteDatabase>>();

function databaseName(userId: string): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error('Invalid offline user scope');
  return `railcommand-${mobileConfig.profile}-${userId}.db`;
}

async function openUserDatabase(userId: string): Promise<SQLite.SQLiteDatabase> {
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
  return pending;
}

export async function cacheBootstrap(userId: string, bootstrap: MobileBootstrap): Promise<void> {
  const db = await openUserDatabase(userId);
  await db.runAsync(
    `INSERT INTO cache_records(cache_key, payload, cached_at) VALUES('bootstrap', ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET payload = excluded.payload, cached_at = excluded.cached_at`,
    JSON.stringify(bootstrap), bootstrap.synchronizedAt,
  );
}

export async function readCachedBootstrap(userId: string): Promise<MobileBootstrap | null> {
  const db = await openUserDatabase(userId);
  const row = await db.getFirstAsync<{ payload: string }>(
    `SELECT payload FROM cache_records WHERE cache_key = 'bootstrap'`,
  );
  if (!row) return null;
  const cached = JSON.parse(row.payload) as MobileBootstrap;
  return { ...cached, team: cached.team ?? [] };
}

export async function saveExpoDraft(userId: string, draft: MobileDailyLogDraft): Promise<void> {
  const db = await openUserDatabase(userId);
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

export async function saveExpoPhoto(userId: string, photo: ExpoStoredPhoto): Promise<void> {
  const db = await openUserDatabase(userId);
  await db.runAsync(
    `INSERT INTO photos(photo_id, project_id, parent_client_id, payload, status, last_error, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(photo_id) DO UPDATE SET payload = excluded.payload, status = excluded.status,
       last_error = excluded.last_error, updated_at = excluded.updated_at`,
    photo.photoId, photo.projectId, photo.parentClientId, JSON.stringify(photo), photo.status,
    photo.lastError, new Date().toISOString(),
  );
}

export async function listExpoPhotos(userId: string, parentClientId: string): Promise<ExpoStoredPhoto[]> {
  const db = await openUserDatabase(userId);
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM photos WHERE parent_client_id = ?', parentClientId);
  return rows.map((row) => JSON.parse(row.payload) as ExpoStoredPhoto);
}

export async function queueExpoDraft(userId: string, projectId: string): Promise<MobileDailyLogSyncOperation> {
  const db = await openUserDatabase(userId);
  const draft = await readExpoDraft(userId, projectId);
  if (!draft) throw new Error('No saved draft is available to submit');
  const operation = draftToSyncOperation(userId, draft);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT INTO outbox(operation_id, project_id, payload, status, attempt_count, updated_at)
       VALUES(?, ?, ?, 'pending', 0, ?)
       ON CONFLICT(operation_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
      operation.operationId, operation.projectId, JSON.stringify(operation), operation.updatedAt,
    );
    await txn.runAsync('DELETE FROM drafts WHERE project_id = ?', projectId);
  });
  return operation;
}

export async function listExpoOutbox(userId: string): Promise<MobileDailyLogSyncOperation[]> {
  const db = await openUserDatabase(userId);
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM outbox ORDER BY updated_at');
  return rows.map((row) => JSON.parse(row.payload) as MobileDailyLogSyncOperation);
}

export async function markExpoOutbox(
  userId: string,
  operation: MobileDailyLogSyncOperation,
  status: 'retrying' | 'failed' | 'conflicted',
  error: string,
): Promise<void> {
  const db = await openUserDatabase(userId);
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
): Promise<void> {
  await saveExpoPhoto(userId, { ...photo, status, lastError: error });
}

export async function completeExpoSync(
  userId: string,
  operation: MobileDailyLogSyncOperation,
  photos: ExpoStoredPhoto[],
): Promise<void> {
  const db = await openUserDatabase(userId);
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const photo of photos) {
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
  });
}

export async function listExpoSyncRows(userId: string): Promise<ExpoSyncRow[]> {
  const db = await openUserDatabase(userId);
  const pending = await db.getAllAsync<{ operation_id: string; status: ExpoSyncRow['state']; last_error: string | null; updated_at: string; payload: string }>(
    'SELECT operation_id, status, last_error, updated_at, payload FROM outbox ORDER BY updated_at DESC',
  );
  const history = await db.getAllAsync<{ item_id: string; kind: ExpoSyncRow['kind']; label: string; completed_at: string }>(
    'SELECT item_id, kind, label, completed_at FROM sync_history ORDER BY completed_at DESC LIMIT 25',
  );
  const photos = await db.getAllAsync<{ photo_id: string; status: ExpoSyncRow['state']; last_error: string | null; updated_at: string; payload: string }>(
    'SELECT photo_id, status, last_error, updated_at, payload FROM photos ORDER BY updated_at DESC',
  );
  return [
    ...pending.map((row) => {
      const operation = JSON.parse(row.payload) as MobileDailyLogSyncOperation;
      return { id: row.operation_id, kind: 'daily_log' as const, state: row.status, label: operation.payload.log_date,
        detail: row.last_error, updatedAt: row.updated_at };
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
  const counts = await Promise.all(['drafts', 'outbox', 'photos'].map((table) =>
    db.getFirstAsync<{ count: number }>(`SELECT count(*) AS count FROM ${table}`)));
  return { drafts: counts[0]?.count ?? 0, outbox: counts[1]?.count ?? 0, photos: counts[2]?.count ?? 0 };
}

export async function purgeExpoUser(userId: string): Promise<void> {
  const name = databaseName(userId);
  const db = await openUserDatabase(userId);
  await db.closeAsync();
  dbPromises.delete(name);
  await SQLite.deleteDatabaseAsync(name);
  const userFiles = new Directory(Paths.document, 'railcommand', userId);
  if (userFiles.exists) userFiles.delete();
}
