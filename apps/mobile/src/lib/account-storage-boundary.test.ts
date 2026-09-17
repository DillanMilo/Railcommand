import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { MobileApiClient } from '@railcommand/api-client';
import type { MobileBootstrap } from '@railcommand/domain';
import * as railbot from './railbot';
import * as storageScopes from './storage-scope';

const userA = '10000000-0000-4000-8000-000000000091';
const userB = '10000000-0000-4000-8000-000000000092';
const bootstrap: MobileBootstrap = { userId: userA, activeProjectId: null, projects: [], dailyLogs: [], team: [], synchronizedAt: '2026-08-30T12:00:00Z' };

function compiled<T>(file: string, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiledModule = { exports: {} };
  runInNewContext(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText, {
    module: compiledModule, exports: compiledModule.exports, ...globals,
    require: (name: string) => {
      if (!(name in dependencies)) throw new Error(`Unmocked boundary: ${name}`);
      return dependencies[name];
    },
  });
  return compiledModule.exports as T;
}

function storageHarness() {
  const databases = new Map<string, DatabaseSync>();
  let opens = 0;
  let beforeOpen: () => Promise<void> = async () => {};
  let beforeWrite: () => Promise<void> = async () => {};
  const store = compiled<typeof import('./offline-store')>('./offline-store.ts', {
    '@railcommand/domain': { draftToSyncOperation: () => { throw new Error('Not used in cache tests'); } },
    'expo-file-system': { Directory: class { exists = false; }, Paths: { document: 'test-only' } },
    './config': { mobileConfig: { profile: 'test' } },
    './record-detail': {}, './record-drafts': { createRecordDraftStore: () => ({}) },
    './storage-scope': storageScopes, './railbot': railbot,
    'expo-sqlite': {
      openDatabaseAsync: async (name: string) => {
        opens++;
        await beforeOpen();
        const db = new DatabaseSync(':memory:');
        databases.set(name, db);
        const adapter = {
          execAsync: async (sql: string) => db.exec(sql),
          getAllAsync: async (sql: string, ...args: string[]) => db.prepare(sql).all(...args),
          getFirstAsync: async (sql: string, ...args: string[]) => db.prepare(sql).get(...args) ?? null,
          runAsync: async (sql: string, ...args: string[]) => {
            await beforeWrite();
            return db.prepare(sql).run(...args);
          },
          closeAsync: async () => { db.close(); databases.delete(name); },
          withExclusiveTransactionAsync: async (run: (value: unknown) => Promise<void>) => {
            db.exec('BEGIN');
            try { await run(adapter); db.exec('COMMIT'); }
            catch (error) { db.exec('ROLLBACK'); throw error; }
          },
        };
        return adapter;
      },
      deleteDatabaseAsync: async (name: string) => assert.equal(databases.has(name), false, 'close before delete'),
    },
  });
  return { store, databases, opens: () => opens,
    pauseOpen: (run: () => Promise<void>) => { beforeOpen = run; },
    pauseWrite: (run: () => Promise<void>) => { beforeWrite = run; },
    close: () => databases.forEach((db) => db.close()),
  };
}

describe('Same-day queued log review (real SQLite)', () => {
  const operation = {
    operationId: '30000000-0000-4000-8000-000000000091', clientId: '30000000-0000-4000-8000-000000000091',
    userId: userA, projectId: '20000000-0000-4000-8000-000000000091',
    idempotencyKey: 'daily-log-create:30000000-0000-4000-8000-000000000091',
    payload: { log_date: '2026-09-16', work_summary: 'Saved crew work', safety_notes: 'Briefing', weather_temp: 70,
      weather_conditions: 'Clear', weather_wind: '', geo_tag: null, personnel: [{ role: 'Foreman', headcount: 2 }], equipment: [], work_items: [] },
    status: 'failed' as const, attemptCount: 2, createdAt: '2026-09-16T12:00:00Z', updatedAt: '2026-09-16T12:00:00Z', nextAttemptAt: '2026-09-16T12:00:00Z',
    lastError: 'A daily log already exists for this project and date. Saved work retained.',
    photoManifestVersion: 1 as const, photoIds: ['photo-1'],
  };
  async function seed(h: ReturnType<typeof storageHarness>) {
    await h.store.cacheBootstrap(userA, bootstrap);
    const db = [...h.databases.values()][0];
    db.prepare('INSERT INTO outbox(operation_id,project_id,payload,status,attempt_count,updated_at) VALUES(?,?,?,?,?,?)')
      .run(operation.operationId, operation.projectId, JSON.stringify(operation), 'conflicted', 2, operation.updatedAt);
    return db;
  }
  it('persists explicit consent with all original fields, identity and photo manifest unchanged', async () => {
    const h = storageHarness();
    try {
      await seed(h);
      await h.store.confirmSeparateExpoLog(userA, operation.operationId, () => true);
      const saved = (await h.store.listExpoOutbox(userA))[0];
      assert.deepEqual(JSON.parse(JSON.stringify(saved.payload)), { ...operation.payload, allow_same_day: true });
      for (const key of ['operationId', 'clientId', 'idempotencyKey', 'createdAt', 'projectId', 'userId'] as const) assert.equal(saved[key], operation[key]);
      assert.deepEqual(Array.from(saved.photoIds), operation.photoIds);
      assert.equal(saved.photoManifestVersion, 1);
      assert.equal(saved.status, 'pending');
      assert.equal(saved.lastError, null);
      // A request started before confirmation must not restore its stale payload.
      await h.store.markExpoOutbox(userA, operation, 'conflicted', operation.lastError);
      assert.equal((await h.store.listExpoOutbox(userA))[0].payload.allow_same_day, true);
      assert.equal((await h.store.listExpoSyncRows(userA))[0].state, 'pending');
      await assert.rejects(h.store.confirmSeparateExpoLog(userA, operation.operationId, () => true), /different review/);
    } finally { h.close(); }
  });
  it('rejects the wrong account and unrelated failures without changing saved work', async () => {
    const h = storageHarness();
    try {
      const db = await seed(h);
      await assert.rejects(h.store.confirmSeparateExpoLog(userB, operation.operationId, () => true), /no longer queued/);
      const unrelated = { ...operation, lastError: 'Permission denied' };
      db.prepare('UPDATE outbox SET payload=?').run(JSON.stringify(unrelated));
      await assert.rejects(h.store.confirmSeparateExpoLog(userA, operation.operationId, () => true), /different review/);
      assert.equal((await h.store.listExpoOutbox(userA))[0].payload.allow_same_day, undefined);
    } finally { h.close(); }
  });
  it('rolls confirmation back if the account/storage scope changes during persistence', async () => {
    const h = storageHarness(); let current = true;
    try {
      await seed(h);
      h.pauseWrite(async () => { current = false; });
      await assert.rejects(h.store.confirmSeparateExpoLog(userA, operation.operationId, () => current), /canceled/);
      assert.equal((await h.store.listExpoOutbox(userA))[0].payload.allow_same_day, undefined);
      assert.equal((await h.store.listExpoSyncRows(userA))[0].state, 'conflicted');
    } finally { h.close(); }
  });
});

describe('Native cache purge and owner boundary (real SQLite, mocked native bridge)', () => {
  it('keeps RailBot drafts separate by account/project and warns before sign-out', async () => {
    const h = storageHarness();
    try {
      await h.store.saveBotDraft(userA, { ...railbot.newBotDraft('projectA'), input: 'Private draft' }, () => true);
      assert.equal((await h.store.readBotDraft(userA, 'projectA', () => true))?.input, 'Private draft');
      assert.equal(await h.store.readBotDraft(userB, 'projectA', () => true), null);
      assert.equal(await h.store.readBotDraft(userA, 'projectB', () => true), null);
      assert.equal((await h.store.inspectExpoUnsynced(userA)).drafts, 1);
      await assert.rejects(h.store.saveBotDraft(userA, railbot.newBotDraft('projectA'), () => false));
      assert.equal((await h.store.readBotDraft(userA, 'projectA', () => true))?.input, 'Private draft');
    } finally { h.close(); }
  });
  it('rejects wrong-owner or canceled cache writes before opening a database', async () => {
    const h = storageHarness();
    try {
      await assert.rejects(h.store.cacheBootstrap(userB, bootstrap), /another account/);
      await assert.rejects(h.store.cacheBootstrap(userA, bootstrap, () => false), /canceled/);
      assert.equal(h.opens(), 0);
    } finally { h.close(); }
  });

  it('rejects wrong-owner/corrupt cached payloads without exposing them', async () => {
    const h = storageHarness();
    try {
      await h.store.cacheBootstrap(userA, bootstrap);
      const db = [...h.databases.values()][0];
      db.prepare("UPDATE cache_records SET payload = ? WHERE cache_key = 'bootstrap'").run(JSON.stringify({ ...bootstrap, userId: userB }));
      assert.equal(await h.store.readCachedBootstrap(userA), null);
      db.exec("UPDATE cache_records SET payload = 'unreadable'");
      assert.equal(await h.store.readCachedBootstrap(userA), null);
    } finally { h.close(); }
  });

  it('rolls back an in-flight stale cache transaction', async () => {
    const h = storageHarness();
    let current = true;
    try {
      await h.store.cacheBootstrap(userA, bootstrap);
      h.pauseWrite(async () => { current = false; });
      await assert.rejects(h.store.cacheBootstrap(userA, { ...bootstrap, synchronizedAt: 'stale-response' }, () => current), /canceled/);
      assert.equal((await h.store.readCachedBootstrap(userA))?.synchronizedAt, bootstrap.synchronizedAt);
    } finally { h.close(); }
  });

  it('invalidates a pending open before purge; old callbacks cannot recreate a purged cache', async () => {
    const h = storageHarness();
    let release!: () => void;
    h.pauseOpen(() => new Promise<void>((resolve) => { release = resolve; }));
    const originalScope = storageScopes.captureOfflineScope(userA);
    const write = h.store.cacheBootstrap(userA, bootstrap, originalScope);
    const rejected = assert.rejects(write, /canceled/);
    const purge = h.store.purgeExpoUser(userA);
    assert.equal(originalScope(), false);
    release();
    await Promise.all([purge, rejected]);
    await assert.rejects(h.store.cacheBootstrap(userA, bootstrap, originalScope), /canceled/);
    assert.equal(h.opens(), 1);
    h.pauseOpen(async () => {});
    try {
      // A fresh same-account lifetime can work normally after cleanup.
      await h.store.cacheBootstrap(userA, bootstrap, storageScopes.captureOfflineScope(userA));
      assert.equal((await h.store.readCachedBootstrap(userA))?.userId, userA);
    } finally { h.close(); }
  });
});

describe('Owner-bound API authentication (real API client, synthetic transport)', () => {
  function apiHarness() {
    let current = true;
    let session = { user: { id: userA }, access_token: 'synthetic-token-a' };
    let refreshes = 0;
    let beforeGet: () => void = () => {};
    let beforeRefresh: () => void = () => {};
    let response: (call: number) => Response = () => new Response(JSON.stringify(bootstrap));
    const requests: string[] = [];
    const { mobileApiForUser } = compiled<typeof import('./api')>('./api.ts', {
      '@railcommand/api-client': { MobileApiClient },
      './config': { mobileConfig: { apiBaseUrl: 'https://synthetic.example' } },
      './request-metrics': { recordMobileRequestMetric() {} },
      './supabase': { supabase: { auth: {
        getSession: async () => { beforeGet(); return { data: { session }, error: null }; },
        refreshSession: async () => { refreshes++; beforeRefresh(); return { data: { session }, error: null }; },
      } } },
    }, { fetch: async (_input: unknown, init: RequestInit) => {
      requests.push(new Headers(init.headers).get('Authorization')!);
      return response(requests.length);
    } });
    return {
      api: mobileApiForUser(userA, () => current), requests,
      cancel: () => { current = false; },
      switchUser: () => { session = { user: { id: userB }, access_token: 'synthetic-token-b' }; },
      onGet: (run: () => void) => { beforeGet = run; },
      onRefresh: (run: () => void) => { beforeRefresh = run; },
      respond: (run: (call: number) => Response) => { response = run; },
      refreshes: () => refreshes,
    };
  }

  it('does not dispatch after cancellation during token lookup', async () => {
    const h = apiHarness(); h.onGet(h.cancel);
    await assert.rejects(h.api.getBootstrap());
    assert.deepEqual(h.requests, []);
  });
  it('never refreshes/replays A’s 401 using B’s session', async () => {
    const h = apiHarness();
    h.respond(() => { h.switchUser(); return new Response('{}', { status: 401 }); });
    await assert.rejects(h.api.getBootstrap());
    assert.equal(h.refreshes(), 0);
    assert.deepEqual(h.requests, ['Bearer synthetic-token-a']);
  });
  it('rejects an owner change during refresh instead of replaying with the new token', async () => {
    const h = apiHarness();
    h.respond(() => new Response('{}', { status: 401 })); h.onRefresh(h.switchUser);
    await assert.rejects(h.api.getBootstrap());
    assert.equal(h.refreshes(), 1);
    assert.deepEqual(h.requests, ['Bearer synthetic-token-a']);
  });
  it('keeps the existing same-owner 401 refresh/retry working', async () => {
    const h = apiHarness();
    h.respond((call) => call === 1 ? new Response('{}', { status: 401 }) : new Response(JSON.stringify(bootstrap)));
    assert.equal((await h.api.getBootstrap()).userId, userA);
    assert.equal(h.refreshes(), 1);
    assert.deepEqual(h.requests, ['Bearer synthetic-token-a', 'Bearer synthetic-token-a']);
  });
});
import { URL } from 'node:url';
