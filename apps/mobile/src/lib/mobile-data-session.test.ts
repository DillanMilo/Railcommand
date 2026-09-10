import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import type { MobileBootstrap } from '@railcommand/domain';
import { MobileApiError } from '@railcommand/api-client';
import { bootstrapForProject } from './bootstrap-scope';
import { createRequestDeduper } from './request-deduper';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const PROJECT_P = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_Q = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const NOW = '2026-08-30T15:00:00.000Z';

function bootstrap(userId = USER_A, projectId = PROJECT_P): MobileBootstrap {
  return {
    userId,
    projects: [PROJECT_P, PROJECT_Q].map((id) => ({
      id, name: id === PROJECT_P ? 'Synthetic P' : 'Synthetic Q', status: 'active',
      location: 'Synthetic fixture', client: 'QA', role: 'engineer', canEdit: true, updatedAt: NOW,
    })),
    activeProjectId: projectId,
    dailyLogs: [{ id: `${userId}:${projectId}:log`, projectId, logDate: '2026-08-30', weatherConditions: 'Clear',
      workSummary: 'Synthetic fixture only', safetyNotes: '', createdAt: NOW }],
    team: [{ id: `${userId}:${projectId}:member`, projectId, fullName: 'QA member', email: 'qa@example.invalid', role: 'engineer', canEdit: true }],
    submittals: [{ id: `${projectId}:submittal`, projectId, number: 'S-1', title: 'Synthetic submittal', status: 'draft', dueDate: '2026-09-01', createdAt: NOW }],
    rfis: [{ id: `${projectId}:rfi`, projectId, number: 'R-1', subject: 'Synthetic RFI', status: 'open', priority: 'low', dueDate: '2026-09-01', createdAt: NOW }],
    earthCamEmbeds: [{ id: `${projectId}:camera`, projectId, label: 'Synthetic camera', url: 'https://share.earthcam.net/test', createdAt: NOW }],
    dashboard: { submittalsTotal: 1, submittalsPending: 1, openRfis: 1, overdueRfis: 0, openPunchItems: projectId === PROJECT_P ? 7 : 2, criticalPunchItems: 0 },
    synchronizedAt: NOW,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

type DataValue = {
  bootstrap: MobileBootstrap | null;
  activeProjectId: string | null;
  loading: boolean;
  online: boolean;
  message: string;
  syncRows: { id: string }[];
  refresh(projectId?: string): Promise<void>;
  selectProject(projectId: string): Promise<void>;
  synchronize(): Promise<void>;
  reloadSyncRows(): Promise<void>;
};
type Component = (props: Record<string, unknown>) => Element | null;
type Context = { value: unknown; Provider: { context: Context } };
type Element = { type: Component | Context['Provider']; key: string | null; props: Record<string, unknown> };
type Slot = { value?: unknown; deps?: readonly unknown[]; cleanup?: () => void; setter?: (value: unknown) => void };
type Fiber = { component: Component; key: string | null; slots: Slot[]; cursor: number; live: boolean };

// This executes the provider's real callbacks/effects with deterministic promises.
// Only React's hook scheduler and native/network/storage adapters are stubbed: it
// is an offline read-only/cache and draft/outbox lifecycle test, not a native UI
// rendering or SQLite persistence claim. No request leaves this process.
function providerHarness() {
  let auth = { userId: USER_A as string | null, revision: 1 };
  const isSessionCurrent = (userId: string | null, revision: number) => auth.userId === userId && auth.revision === revision;
  const caches = new Map<string, MobileBootstrap>([[USER_A, bootstrap()], [USER_B, bootstrap(USER_B, PROJECT_Q)]]);
  const generations = new Map<string, number>();
  const cacheWrites: { userId: string; value: MobileBootstrap }[] = [];
  const stateWrites: unknown[] = [];
  const requests: { userId: string; projectId?: string; current: () => boolean; result: ReturnType<typeof deferred<MobileBootstrap>> }[] = [];
  const syncCalls: { userId: string; current: () => boolean; result: ReturnType<typeof deferred<number>> }[] = [];
  const networkListeners = new Set<(state: { isConnected: boolean; isInternetReachable: boolean }) => void>();
  const appStateListeners = new Set<(state: string) => void>();
  const apiFor = (userId: string, current: () => boolean) => ({
    getBootstrap(projectId?: string) {
      const result = deferred<MobileBootstrap>();
      requests.push({ userId, projectId, current, result });
      return result.promise;
    },
  });
  let cacheReads = 0;
  let activeFiber: Fiber | null = null;
  let dirty = true;
  const fibers = new Map<string, Fiber>();
  const pendingEffects: { fiber: Fiber; slot: Slot; effect: () => void | (() => void) }[] = [];
  const sameDeps = (left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) =>
    Boolean(left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index])));
  const nextSlot = () => {
    assert.ok(activeFiber, 'A hook must run in a mounted test component');
    const index = activeFiber.cursor++;
    return { fiber: activeFiber, slot: activeFiber.slots[index] ?? (activeFiber.slots[index] = {}) };
  };
  const react = {
    createContext(initial: unknown): Context {
      const context = { value: initial } as Context;
      context.Provider = { context };
      return context;
    },
    useContext: (context: Context) => context.value,
    useState<T>(initial: T | (() => T)) {
      const { fiber, slot } = nextSlot();
      if (!slot.setter) {
        slot.value = typeof initial === 'function' ? (initial as () => T)() : initial;
        slot.setter = (next) => {
          const value = typeof next === 'function' ? (next as (previous: unknown) => unknown)(slot.value) : next;
          stateWrites.push(value);
          if (fiber.live && !Object.is(value, slot.value)) { slot.value = value; dirty = true; }
        };
      }
      return [slot.value as T, slot.setter] as const;
    },
    useRef<T>(initial: T) {
      const { slot } = nextSlot();
      if (!('value' in slot)) slot.value = { current: initial };
      return slot.value as { current: T };
    },
    useMemo<T>(factory: () => T, deps?: readonly unknown[]): T {
      const { slot } = nextSlot();
      if (!sameDeps(slot.deps, deps)) { slot.value = factory(); slot.deps = deps; }
      return slot.value as T;
    },
    useCallback<T>(callback: T, deps?: readonly unknown[]): T { return react.useMemo(() => callback, deps); },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const { fiber, slot } = nextSlot();
      if (!sameDeps(slot.deps, deps)) { slot.deps = deps; pendingEffects.push({ fiber, slot, effect }); }
    },
  };
  const jsx = (type: Element['type'], props: Element['props'], key?: string) => ({ type, props, key: key ?? null });
  const compiled = { exports: {} as Record<string, unknown> };
  const source = readFileSync(new URL('../providers/mobile-data-provider.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports,
    require(name: string) {
      if (name === 'react') return react;
      if (name === '@railcommand/api-client') return { MobileApiError };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === './auth-provider') return { useAuth: () => ({
        session: auth.userId ? { user: { id: auth.userId } } : null,
        sessionRevision: auth.revision, isSessionCurrent,
      }) };
      if (name === 'expo-network') return {
        getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
        addNetworkStateListener: (listener: (state: { isConnected: boolean; isInternetReachable: boolean }) => void) => {
          networkListeners.add(listener);
          return { remove: () => networkListeners.delete(listener) };
        },
      };
      if (name === 'react-native') return { AppState: { addEventListener: (_event: string, listener: (state: string) => void) => {
        appStateListeners.add(listener);
        return { remove: () => appStateListeners.delete(listener) };
      } } };
      if (name === '@/lib/bootstrap-scope') return { bootstrapForProject };
      if (name === '@/lib/request-deduper') return { createRequestDeduper };
      if (name === '@/lib/storage-scope') return { captureOfflineScope: (userId: string) => {
        const generation = generations.get(userId) ?? 0;
        return () => (generations.get(userId) ?? 0) === generation;
      } };
      if (name === '@/lib/api') return {
        mobileApiForUser: apiFor,
        // Keep the old global client shape available so the same behavioral
        // cases fail on the pre-fix provider, not merely on a missing mock.
        mobileApi: { getBootstrap: (projectId?: string) => apiFor(auth.userId ?? '', () => true).getBootstrap(projectId) },
      };
      if (name === '@/lib/offline-store') return {
        readCachedBootstrap: async (userId: string, current: () => boolean = () => true) => {
          cacheReads += 1;
          return current() ? caches.get(userId) ?? null : null;
        },
        cacheBootstrap: async (userId: string, value: MobileBootstrap, current: () => boolean = () => true) => {
          if (!current()) return;
          cacheWrites.push({ userId, value });
          caches.set(userId, value);
        },
        listExpoSyncRows: async (userId: string) => [{ id: `${userId}:pending`, kind: 'daily_log', state: 'pending', label: 'QA log', detail: null, updatedAt: NOW }],
      };
      if (name === '@/lib/sync') return { synchronizeExpoOutbox: (userId: string, current: () => boolean = () => true) => {
        const result = deferred<number>();
        syncCalls.push({ userId, current, result });
        return result.promise;
      } };
      throw new Error(`Unexpected provider test dependency: ${name}`);
    },
    console,
  });
  const dispose = (fiber: Fiber) => {
    fiber.live = false;
    for (const slot of fiber.slots) slot.cleanup?.();
  };
  const renderElement = (element: Element | null, path: string, seen: Set<string>): void => {
    if (!element) return;
    if (typeof element.type !== 'function') {
      element.type.context.value = element.props.value;
      renderElement(element.props.children as Element | null, `${path}/context`, seen);
      return;
    }
    seen.add(path);
    let fiber = fibers.get(path);
    if (fiber && (fiber.component !== element.type || fiber.key !== element.key)) { dispose(fiber); fiber = undefined; }
    if (!fiber) {
      fiber = { component: element.type, key: element.key, slots: [], cursor: 0, live: true };
      fibers.set(path, fiber);
    }
    fiber.cursor = 0;
    activeFiber = fiber;
    const child = element.type(element.props);
    activeFiber = null;
    renderElement(child, `${path}/child`, seen);
  };
  const render = () => {
    dirty = false;
    const seen = new Set<string>();
    renderElement(jsx(compiled.exports.MobileDataProvider as Component, { children: null }), 'root', seen);
    for (const [path, fiber] of fibers) if (!seen.has(path)) { dispose(fiber); fibers.delete(path); }
    for (const { fiber, slot, effect } of pendingEffects.splice(0)) {
      if (!fiber.live) continue;
      slot.cleanup?.();
      slot.cleanup = effect() || undefined;
    }
  };
  const flush = async () => {
    // Drain promise/effect chains without timers, real I/O, or sleeps.
    for (let tick = 0; tick < 30; tick += 1) { if (dirty) render(); await Promise.resolve(); }
    if (dirty) render();
  };
  return {
    requests, syncCalls, cacheWrites, stateWrites, caches,
    value: () => (compiled.exports.useMobileData as () => DataValue)(),
    cacheReadCount: () => cacheReads,
    flush,
    async start() {
      await flush();
      assert.equal(requests.length, 1, 'Initial authenticated refresh starts once');
      requests[0].result.resolve(bootstrap());
      await flush();
      assert.equal(this.value().activeProjectId, PROJECT_P);
      cacheWrites.length = 0;
      stateWrites.length = 0;
    },
    setOwner(userId: string | null, rerender = true) {
      auth = { userId, revision: auth.revision + 1 };
      if (rerender) dirty = true;
    },
    invalidateStorage(userId: string) { generations.set(userId, (generations.get(userId) ?? 0) + 1); },
    emitForeground() { for (const listener of appStateListeners) listener('active'); },
    emitReconnect() { for (const listener of networkListeners) listener({ isConnected: true, isInternetReachable: true }); },
    emitOffline() { for (const listener of networkListeners) listener({ isConnected: false, isInternetReachable: false }); },
    dispose() { for (const fiber of fibers.values()) dispose(fiber); fibers.clear(); },
  };
}

function assertOnlyProject(value: DataValue, projectId: string) {
  assert.equal(value.activeProjectId, projectId);
  assert.equal(value.bootstrap?.activeProjectId, projectId);
  for (const rows of [value.bootstrap?.dailyLogs, value.bootstrap?.team, value.bootstrap?.rfis,
    value.bootstrap?.submittals, value.bootstrap?.earthCamEmbeds]) {
    assert.ok((rows ?? []).every((row) => row.projectId === projectId), 'No previous-project records are displayed under the new project');
  }
}

describe('mobile provider account/project request lifetimes', () => {
  for (const [status, expected] of [
    [401, 'Refresh failed: the server could not verify your session. Please retry or contact support.'],
    [403, 'Refresh failed: the server denied project access. Check your organization permissions or contact support.'],
    [503, 'Project refresh failed. Check your connection and try again.'],
  ] as const) {
    for (const cached of [false, true]) {
      it(`explains HTTP ${status} with ${cached ? 'current saved data' : 'no cache'} without discarding field work`, async () => {
        const h = providerHarness();
        if (!cached) h.caches.delete(USER_A);
        await h.flush();
        const queueBefore = h.value().syncRows;
        h.requests[0].result.reject(new MobileApiError('Unsafe raw response token must never be shown', status, status >= 500));
        await h.flush();
        assert.equal(h.value().message, expected + (cached
          ? ' Showing saved device data.'
          : ' No saved project data is available on this device yet.'));
        assert.equal(h.value().loading, false);
        assert.equal(h.value().online, true, 'An HTTP failure must not invent an offline transition');
        assert.equal(h.value().syncRows, queueBefore, 'Refresh errors do not change the pending queue');
        assert.equal(h.cacheWrites.length, 0, 'A failed refresh never overwrites the device cache');
        if (cached) {
          assertOnlyProject(h.value(), PROJECT_P);
          assert.equal(h.value().bootstrap?.dailyLogs.length, 1);
          assert.equal(h.caches.get(USER_A)?.dailyLogs.length, 1);
        } else {
          assert.equal(h.value().bootstrap, null);
          assert.equal(h.caches.has(USER_A), false);
        }
        assert.doesNotMatch(h.value().message, /Unsafe|token|Synchronized/);
        h.dispose();
      });
    }
  }

  it('replaces a prior synchronized status with a clear refresh failure while retaining the current cache', async () => {
    const h = providerHarness();
    await h.start();
    assert.match(h.value().message, /^Synchronized /);
    const pending = h.value().refresh();
    h.requests[1].result.reject(new Error('Synthetic network failure with private response text'));
    await pending;
    await h.flush();
    assert.equal(h.value().message, 'Project refresh failed. Check your connection and try again. Showing saved device data.');
    assertOnlyProject(h.value(), PROJECT_P);
    assert.equal(h.value().bootstrap?.dailyLogs.length, 1);
    assert.equal(h.cacheWrites.length, 0);
    h.dispose();
  });

  for (const cached of [false, true]) {
    it(`preserves the known-offline ${cached ? 'saved-data' : 'empty-cache'} fallback`, async () => {
      const h = providerHarness();
      if (!cached) h.caches.delete(USER_A);
      await h.flush();
      h.emitOffline();
      h.requests[0].result.reject(new Error('Synthetic offline request'));
      await h.flush();
      assert.equal(h.value().online, false);
      assert.equal(h.value().message, cached
        ? 'Showing saved device data'
        : 'No saved project data is available on this device yet.');
      assert.equal(h.cacheWrites.length, 0);
      h.dispose();
    });
  }

  it('ignores delayed HTTP verification failures after batched A → B → A changes', async () => {
    const h = providerHarness();
    await h.start();
    const pending = h.value().refresh(PROJECT_P);
    await h.flush();
    h.stateWrites.length = 0;
    const readsBefore = h.cacheReadCount();
    h.setOwner(USER_B, false);
    h.setOwner(USER_A, false);
    h.requests[1].result.reject(new MobileApiError('Expired private session detail', 401, false));
    await pending;
    await h.flush();
    assert.equal(h.stateWrites.length, 0, 'A canceled account lifetime must not display a stale error');
    assert.equal(h.cacheReadCount(), readsBefore);
    assert.equal(h.cacheWrites.length, 0);
    h.dispose();
  });

  it('immediately removes P records/summary when Q is selected and ignores a late P success', async () => {
    const h = providerHarness();
    await h.start();
    const oldRefresh = h.value().refresh(PROJECT_P);
    const selection = h.value().selectProject(PROJECT_Q);
    await h.flush();
    assertOnlyProject(h.value(), PROJECT_Q);
    assert.equal(h.value().bootstrap?.dailyLogs.length, 0);
    assert.equal(h.value().bootstrap?.dashboard, undefined);
    assert.equal(h.requests[2].projectId, PROJECT_Q);
    h.requests[2].result.resolve(bootstrap(USER_A, PROJECT_Q));
    await h.flush();
    const writesAfterQ = h.cacheWrites.length;
    h.requests[1].result.resolve(bootstrap(USER_A, PROJECT_P));
    await Promise.all([oldRefresh, selection]);
    await h.flush();
    assertOnlyProject(h.value(), PROJECT_Q);
    assert.equal(h.value().bootstrap?.dashboard?.openPunchItems, 2);
    assert.equal(h.cacheWrites.length, writesAfterQ, 'The stale request cannot overwrite the persistent cache');
    h.dispose();
  });

  it('does not let an old success/finally clear Q loading while Q is still pending', async () => {
    const h = providerHarness();
    await h.start();
    const oldRefresh = h.value().refresh(PROJECT_P);
    const selection = h.value().selectProject(PROJECT_Q);
    await h.flush();
    h.requests[1].result.resolve(bootstrap(USER_A, PROJECT_P));
    await oldRefresh;
    await h.flush();
    assertOnlyProject(h.value(), PROJECT_Q);
    assert.equal(h.value().loading, true);
    h.requests[2].result.resolve(bootstrap(USER_A, PROJECT_Q));
    await selection;
    await h.flush();
    assert.equal(h.value().loading, false);
    h.dispose();
  });

  it('ignores an old P failure instead of replacing Q with an offline fallback', async () => {
    const h = providerHarness();
    await h.start();
    const oldRefresh = h.value().refresh(PROJECT_P);
    const selection = h.value().selectProject(PROJECT_Q);
    await h.flush();
    h.requests[2].result.resolve(bootstrap(USER_A, PROJECT_Q));
    await h.flush();
    const readsAfterQ = h.cacheReadCount();
    const messageAfterQ = h.value().message;
    h.requests[1].result.reject(new Error('Synthetic delayed connectivity failure'));
    await Promise.all([oldRefresh, selection]);
    await h.flush();
    assertOnlyProject(h.value(), PROJECT_Q);
    assert.equal(h.value().message, messageAfterQ);
    assert.equal(h.cacheReadCount(), readsAfterQ, 'An obsolete request does not start a new private-cache read');
    h.dispose();
  });

  it('invalidates delayed work on a batched A → B → A account change before React rerenders', async () => {
    const h = providerHarness();
    await h.start();
    const pending = h.value().refresh(PROJECT_P);
    await h.flush();
    h.stateWrites.length = 0;
    h.setOwner(USER_B, false);
    h.setOwner(USER_A, false);
    assert.equal(h.requests[1].current(), false, 'The original account revision cannot become current again');
    h.requests[1].result.resolve(bootstrap(USER_A, PROJECT_P));
    await pending;
    await h.flush();
    assert.equal(h.stateWrites.length, 0, 'No late data, message, or loading state write is accepted');
    assert.equal(h.cacheWrites.length, 0);
    h.dispose();
  });

  it('invalidates an old refresh when device cleanup starts even if the account stays signed in', async () => {
    const h = providerHarness();
    await h.start();
    const pending = h.value().refresh(PROJECT_P);
    await h.flush();
    h.stateWrites.length = 0;
    h.invalidateStorage(USER_A);
    h.requests[1].result.resolve(bootstrap());
    await pending;
    await h.flush();
    assert.equal(h.stateWrites.length, 0);
    assert.equal(h.cacheWrites.length, 0, 'Late refresh cannot recreate a cache after account cleanup');
    h.dispose();
  });

  it('restores P’s retained device snapshot after an offline P → Q → P switch', async () => {
    const h = providerHarness();
    await h.start();
    const toQ = h.value().selectProject(PROJECT_Q);
    await h.flush();
    h.requests[1].result.reject(new Error('Synthetic offline request'));
    await toQ;
    await h.flush();
    assertOnlyProject(h.value(), PROJECT_Q);
    assert.equal(h.value().bootstrap?.dailyLogs.length, 0);
    const toP = h.value().selectProject(PROJECT_P);
    await h.flush();
    h.requests[2].result.reject(new Error('Synthetic offline request'));
    await toP;
    await h.flush();
    assertOnlyProject(h.value(), PROJECT_P);
    assert.equal(h.value().bootstrap?.dailyLogs.length, 1, 'Filtering Q must not lose the P snapshot still saved on this device');
    assert.equal(h.value().bootstrap?.dashboard?.openPunchItems, 7);
    h.dispose();
  });

  for (const event of ['emitForeground', 'emitReconnect'] as const) {
    it(`allows a fresh ${event} sync after cleanup without reviving old cache lifetimes`, async () => {
      const h = providerHarness();
      await h.start();
      h.invalidateStorage(USER_A);
      h[event]();
      await h.flush();
      assert.equal(h.syncCalls.length, 1, 'A later event captures a fresh scope instead of staying disabled forever');
      assert.equal(h.syncCalls[0].current(), true);
      h.syncCalls[0].result.resolve(0);
      await h.flush();
      h.requests[1].result.resolve(bootstrap());
      await h.flush();
      h.dispose();
    });
  }

  it('replaces an invalidated same-account sync lock without waiting for its old request', async () => {
    const h = providerHarness();
    await h.start();
    const oldSync = h.value().synchronize();
    await h.flush();
    h.invalidateStorage(USER_A);
    const freshSync = h.value().synchronize();
    await h.flush();
    assert.equal(h.syncCalls.length, 2, 'A current operation must not inherit the canceled storage lifetime’s lock');
    assert.equal(h.syncCalls[0].current(), false);
    assert.equal(h.syncCalls[1].current(), true);
    h.syncCalls[0].result.resolve(0);
    await oldSync;
    await h.flush();
    const joinedFresh = h.value().synchronize();
    await h.flush();
    assert.equal(h.syncCalls.length, 2, 'The invalidated operation’s finally cannot release the fresh lock');
    h.syncCalls[1].result.resolve(0);
    await h.flush();
    h.requests.at(-1)!.result.resolve(bootstrap());
    await Promise.all([freshSync, joinedFresh]);
    await h.flush();
    h.dispose();
  });

  it('rejects another account’s bootstrap before rendering or caching its records', async () => {
    const h = providerHarness();
    await h.start();
    const pending = h.value().refresh(PROJECT_P);
    h.requests[1].result.resolve(bootstrap(USER_B, PROJECT_P));
    await pending;
    await h.flush();
    assert.equal(h.value().bootstrap?.userId, USER_A);
    assert.ok(h.cacheWrites.every((entry) => entry.value.userId === entry.userId));
    assert.ok(h.stateWrites.every((value) => !value || typeof value !== 'object' || !('userId' in value) || value.userId !== USER_B));
    h.dispose();
  });

  it('gives B an independent sync lock and never lets A completion unlock or refresh B', async () => {
    const h = providerHarness();
    await h.start();
    const syncA = h.value().synchronize();
    await h.flush();
    assert.equal(h.syncCalls.length, 1);
    h.setOwner(USER_B);
    await h.flush();
    assert.equal(h.requests[1].userId, USER_B);
    h.requests[1].result.resolve(bootstrap(USER_B, PROJECT_Q));
    await h.flush();
    const syncB = h.value().synchronize();
    await h.flush();
    assert.equal(h.syncCalls.length, 2, 'B must not join A’s pending synchronization');
    assert.equal(h.syncCalls[0].current(), false);
    assert.equal(h.syncCalls[1].current(), true);
    const requestsBeforeACompletion = h.requests.length;
    h.syncCalls[0].result.resolve(1);
    await syncA;
    await h.flush();
    const joinedB = h.value().synchronize();
    await h.flush();
    assert.equal(h.syncCalls.length, 2, 'A’s stale finally must not unlock the still-running B request');
    assert.equal(h.requests.length, requestsBeforeACompletion, 'A completion must not launch B’s refresh');
    assert.equal(h.value().bootstrap?.userId, USER_B);
    assert.ok(h.value().syncRows.every((row) => row.id.startsWith(USER_B)));
    h.syncCalls[1].result.resolve(0);
    await h.flush();
    assert.equal(h.requests.at(-1)?.userId, USER_B);
    h.requests.at(-1)!.result.resolve(bootstrap(USER_B, PROJECT_Q));
    await Promise.all([syncB, joinedB]);
    await h.flush();
    assert.equal(h.value().bootstrap?.userId, USER_B);
    h.dispose();
  });
});
import { URL } from 'node:url';
