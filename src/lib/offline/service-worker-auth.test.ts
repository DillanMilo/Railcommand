import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { getOfflineDatabaseName, OFFLINE_SCOPE_STORAGE_KEY } from './storage';

// Run the provider's actual auth/initialization effects with synthetic storage.
// No React mount, browser profile, or backend calls are involved.
const source = ts.createSourceFile(
  'ServiceWorkerProvider.tsx',
  readFileSync(new URL('../../components/providers/ServiceWorkerProvider.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
);
let scopeHelper = '';
let authEffect = '';
let initializationEffect = '';
function findEffects(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name?.text === 'setActiveOfflineScope') {
    scopeHelper = node.getText(source);
  }
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect') {
    const callback = node.arguments[0].getText(source);
    if (callback.includes('supabase.auth.onAuthStateChange')) authEffect = callback;
    if (callback.includes('initializeOfflineStorage(')) initializationEffect = callback;
  }
  ts.forEachChild(node, findEffects);
}
findEffects(source);
assert.ok(scopeHelper && authEffect && initializationEffect, 'provider effects must remain testable');

function evaluate<T>(code: string, context: Record<string, unknown>): T {
  return runInNewContext(ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText, context) as T;
}

function harness() {
  const userId = 'synthetic-user-a';
  const values = new Map([[OFFLINE_SCOPE_STORAGE_KEY, getOfflineDatabaseName(userId)]]);
  const savedWork = { draft: 'Unsubmitted field work', queuedPhoto: 'Original photo bytes' };
  let deleted = false;
  let authListener!: (event: string, session: { user: { id: string } } | null) => void;
  let resolveSession!: (result: { data: { session: { user: { id: string } } | null } }) => void;
  let finishInitialization!: () => void;
  const offlineUserIdRef = { current: userId as string | null };
  const state = { userId: userId as string | null, lastConnectedAt: 'saved', lastSyncedAt: 'saved' };
  const context = {
    getOfflineDatabaseName, OFFLINE_SCOPE_STORAGE_KEY,
    offlineUserId: userId, offlineUserIdRef, isDevelopment: false,
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
    clearOfflineDataForUser: async () => { deleted = true; },
    setOfflineUserId: (value: string | null) => { state.userId = value; },
    setLastConnectedAt: (value: string) => { state.lastConnectedAt = value; },
    setLastSyncedAt: (value: string) => { state.lastSyncedAt = value; },
    createClient: () => ({ auth: {
      getSession: () => new Promise((resolve) => { resolveSession = resolve; }),
      onAuthStateChange: (callback: typeof authListener) => {
        authListener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    } }),
    initializeOfflineStorage: (id: string) => new Promise<void>((resolve) => {
      finishInitialization = () => {
        values.set(OFFLINE_SCOPE_STORAGE_KEY, getOfflineDatabaseName(id));
        resolve();
      };
    }),
    readOfflineMetadata: async () => 'saved',
    requestPersistentOfflineStorage: async () => true,
  };
  evaluate<() => void>(`${scopeHelper}; (${authEffect});`, context)();
  return {
    userId, values, state, offlineUserIdRef, savedWork,
    wasDeleted: () => deleted,
    emit: (event: string, id: string | null) => authListener(event, id ? { user: { id } } : null),
    resolveInitialSession: () => resolveSession({ data: { session: { user: { id: userId } } } }),
    initialize: () => evaluate<() => () => void>(`${scopeHelper}; (${initializationEffect});`, context)(),
    finishInitialization: () => finishInitialization(),
  };
}

describe('offline session-loss data preservation', () => {
  it('detaches the active scope without deleting saved work on involuntary SIGNED_OUT', () => {
    const test = harness();
    test.emit('SIGNED_OUT', null);
    assert.equal(test.values.has(OFFLINE_SCOPE_STORAGE_KEY), false);
    assert.equal(test.offlineUserIdRef.current, null);
    assert.equal(test.state.userId, null);
    assert.equal(test.state.lastConnectedAt, null);
    assert.equal(test.state.lastSyncedAt, null);
    assert.equal(test.wasDeleted(), false);
    assert.equal(test.savedWork.draft, 'Unsubmitted field work');
    assert.equal(test.savedWork.queuedPhoto, 'Original photo bytes');
  });

  it('does not restore an expired user from a delayed initial session response', async () => {
    const test = harness();
    test.emit('SIGNED_OUT', null);
    test.resolveInitialSession();
    await Promise.resolve();
    assert.equal(test.offlineUserIdRef.current, null);
    assert.equal(test.state.userId, null);
    assert.equal(test.values.has(OFFLINE_SCOPE_STORAGE_KEY), false);
  });

  it('does not restore a detached scope when in-flight initialization finishes', async () => {
    const test = harness();
    const cancel = test.initialize();
    test.emit('SIGNED_OUT', null);
    cancel();
    test.finishInitialization();
    await Promise.resolve();
    assert.equal(test.values.has(OFFLINE_SCOPE_STORAGE_KEY), false);
    assert.equal(test.wasDeleted(), false);
  });

  it('restores only the newly signed-in user scope after old initialization finishes', async () => {
    const test = harness();
    const cancel = test.initialize();
    test.emit('SIGNED_OUT', null);
    test.emit('SIGNED_IN', 'synthetic-user-b');
    cancel();
    test.finishInitialization();
    await Promise.resolve();
    assert.equal(test.values.get(OFFLINE_SCOPE_STORAGE_KEY), getOfflineDatabaseName('synthetic-user-b'));
    assert.equal(test.wasDeleted(), false);
  });

  it('allows the same user to reopen preserved work after signing in again', async () => {
    const test = harness();
    test.emit('SIGNED_OUT', null);
    test.emit('SIGNED_IN', test.userId);
    test.initialize();
    test.finishInitialization();
    await Promise.resolve();
    assert.equal(test.values.get(OFFLINE_SCOPE_STORAGE_KEY), getOfflineDatabaseName(test.userId));
    assert.equal(test.wasDeleted(), false);
  });
});
