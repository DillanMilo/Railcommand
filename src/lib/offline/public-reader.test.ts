import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import {
  deleteOfflineDatabase,
  getOfflineDatabaseName,
  OFFLINE_SCOPE_STORAGE_KEY,
  OFFLINE_STORES,
  openOfflineDatabase,
  writeOfflineMetadata,
  writeOfflineRecords,
} from './storage';
import { deleteDailyLogDraft, readDailyLogDraft, writeDailyLogDraft, type DailyLogDraftRecord } from './daily-log-draft';
import { createOfflineRecord } from './project-cache';
import { listOutboxOperations } from './outbox';

type TestEvent = { type: string; key?: string | null; target?: TestNode };
class TestEvents {
  private listeners = new Map<string, Set<(event: TestEvent) => void>>();
  addEventListener(type: string, listener: (event: TestEvent) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }
  removeEventListener(type: string, listener: (event: TestEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }
  dispatchEvent(event: TestEvent) {
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
  }
}

// Only DOM operations used by the shipped recovery reader are modeled here.
class TestNode extends TestEvents {
  children: TestNode[] = [];
  hidden = false;
  disabled = false;
  value = '';
  private ownText = '';
  constructor(readonly tagName = 'div') { super(); }
  get textContent(): string { return this.ownText + this.children.map((node) => node.textContent).join(''); }
  set textContent(value: string) { this.ownText = value; this.children = []; }
  get firstChild() { return this.children[0] ?? null; }
  appendChild(node: TestNode) { this.children.push(node); return node; }
  removeChild(node: TestNode) { this.children = this.children.filter((child) => child !== node); }
  replaceChildren(...nodes: TestNode[]) { this.ownText = ''; this.children = nodes; }
  setAttribute(name: string, value: string) { Reflect.set(this, name, value); }
  querySelectorAll(selector: string): TestNode[] {
    const tags = selector.split(',').map((tag) => tag.trim());
    return this.children.flatMap((node) => [
      ...(tags.includes(node.tagName) ? [node] : []), ...node.querySelectorAll(selector),
    ]);
  }
}

const userA = 'synthetic-public-reader-a';
const userB = 'synthetic-public-reader-b';
const projectId = 'synthetic-shared-project';

async function flushReaderCallbacks() {
  for (let index = 0; index < 10; index += 1) await new Promise<void>(setImmediate);
}

describe('public offline reader scope changes', () => {
  let factory: IDBFactory;
  let originalIndexedDB: PropertyDescriptor | undefined;
  const originalGet = IDBObjectStore.prototype.get;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  beforeEach(() => {
    factory = new IDBFactory();
    originalIndexedDB = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: factory });
  });
  afterEach(() => {
    IDBObjectStore.prototype.get = originalGet;
    if (originalIndexedDB) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDB);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
    timers.forEach(clearTimeout);
    timers.clear();
  });

  async function seedUser(userId: string) {
    await writeOfflineMetadata(userId, 'active_project_id', projectId);
    await writeOfflineRecords(userId, [
      createOfflineRecord('project', projectId, { id: projectId, name: `PRIVATE ${userId}` }),
      createOfflineRecord('daily_logs', projectId, []),
    ]);
    return writeDailyLogDraft(userId, projectId, {
      date: '2026-08-30', temp: '', conditions: '', wind: '',
      personnel: [], equipment: [], workItems: [],
      workSummary: `PRIVATE ${userId} draft`, safetyNotes: '', geoTag: null,
    });
  }

  function harness(pathname = `/projects/${projectId}/daily-logs`) {
    let scope: string | null = getOfflineDatabaseName(userA);
    const nodes = new Map<string, TestNode>([
      ['offline-project-data', new TestNode()],
      ['offline-neutral-message', new TestNode()],
      ['offline-data-status', new TestNode()],
    ]);
    nodes.get('offline-project-data')!.hidden = true;
    const document = Object.assign(new TestEvents(), {
      visibilityState: 'visible',
      getElementById: (id: string) => nodes.get(id),
      createElement: (tag: string) => new TestNode(tag),
    });
    const window = Object.assign(new TestEvents(), {
      indexedDB: factory,
      setTimeout: (callback: () => void, delay: number) => {
        const timer = setTimeout(callback, delay); timers.add(timer); return timer;
      },
      clearTimeout,
      setInterval: () => 1,
      clearInterval: () => {},
    });
    const sandbox = {
      window, document, indexedDB: factory, navigator: {},
      localStorage: { getItem: (key: string) => key === OFFLINE_SCOPE_STORAGE_KEY ? scope : null },
      location: { pathname },
      testReader: undefined as undefined | {
        render: () => Promise<void>;
        queue: (name: string, draft: DailyLogDraftRecord) => Promise<unknown>;
      },
    };
    const source = readFileSync(new URL('../../../public/offline-data.js', import.meta.url), 'utf8');
    const bootstrap = source.lastIndexOf('\n  renderOfflineData().catch(');
    assert.ok(bootstrap > 0);
    // Keep actual reader/listener logic; expose functions instead of auto-rendering.
    runInNewContext(source.slice(0, bootstrap)
      + '\n globalThis.testReader = { render: renderOfflineData, queue: queueDailyLogDraft };\n})();',
    sandbox, { timeout: 1000 });
    assert.ok(sandbox.testReader);
    return {
      window, document, reader: sandbox.testReader,
      data: nodes.get('offline-project-data')!,
      neutral: nodes.get('offline-neutral-message')!,
      switchScope(next: string | null, event = 'storage') {
        scope = next;
        window.dispatchEvent({ type: event, key: OFFLINE_SCOPE_STORAGE_KEY });
      },
    };
  }

  for (const nextUser of [userB, null]) {
    it(`hides rendered user A data when the active scope becomes ${nextUser ? 'user B' : 'empty'}`, async () => {
      await seedUser(userA);
      const page = harness();
      await page.reader.render();
      assert.equal(page.data.hidden, false);
      assert.match(page.data.textContent, /PRIVATE synthetic-public-reader-a/);
      page.switchScope(nextUser ? getOfflineDatabaseName(nextUser) : null);
      assert.equal(page.data.hidden, true);
      assert.equal(page.neutral.hidden, false);
    });
  }

  it('checks scope again when a suspended page regains focus', async () => {
    await seedUser(userA);
    const page = harness();
    await page.reader.render();
    page.switchScope(getOfflineDatabaseName(userB), 'focus');
    assert.equal(page.data.hidden, true);
  });

  it('does not render user A when scope changes during an in-flight IndexedDB read', async () => {
    await seedUser(userA);
    const page = harness();
    let changedDuringRead = false;
    IDBObjectStore.prototype.get = function (key) {
      const request = originalGet.call(this, key);
      if (key === `project:${projectId}`) request.addEventListener('success', () => {
        changedDuringRead = true;
        page.switchScope(getOfflineDatabaseName(userB));
      }, { once: true });
      return request;
    };
    await page.reader.render().catch(() => {});
    assert.equal(changedDuringRead, true);
    assert.equal(page.data.hidden, true);
    assert.equal(page.neutral.hidden, false);
    assert.doesNotMatch(page.data.textContent, /PRIVATE/);
  });

  it('rejects a detached draft queue and cannot recreate the previous user database', async () => {
    const draft = await seedUser(userA);
    const page = harness(`/projects/${projectId}/daily-logs/new`);
    await page.reader.render();
    const oldQueueButton = page.data.querySelectorAll('button').find((node) => node.textContent === 'Queue Log for Sync');
    assert.ok(oldQueueButton);
    page.switchScope(null);
    assert.equal(oldQueueButton.disabled, true);
    await deleteOfflineDatabase(userA);
    oldQueueButton.dispatchEvent({ type: 'click', target: oldQueueButton });
    page.window.dispatchEvent({ type: 'pagehide' });
    // Flush the detached event handlers and fake IndexedDB request callbacks.
    await flushReaderCallbacks();
    await assert.rejects(async () => page.reader.queue(getOfflineDatabaseName(userA), draft));
    assert.equal((await factory.databases()).some((database) => database.name === getOfflineDatabaseName(userA)), false);
    assert.equal(page.data.hidden, true);
  });

  for (const event of ['pagehide', 'storage']) {
    it(`does not overwrite a newer draft when an old reader autosaves on ${event}`, async () => {
      const draft = await seedUser(userA);
      const page = harness(`/projects/${projectId}/daily-logs/new`);
      await page.reader.render();
      const newerDraft = {
        ...draft,
        updatedAt: '2030-01-01T00:00:00.000Z',
        values: { ...draft.values, workSummary: 'NEWER synthetic work from another tab' },
      };
      const database = await openOfflineDatabase(userA);
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(OFFLINE_STORES.drafts, 'readwrite');
        transaction.objectStore(OFFLINE_STORES.drafts).put(newerDraft);
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onabort = () => { database.close(); reject(transaction.error); };
      });
      if (event === 'storage') page.switchScope(getOfflineDatabaseName(userB));
      else page.window.dispatchEvent({ type: event });
      await flushReaderCallbacks();
      assert.deepEqual(await readDailyLogDraft(userA, projectId), newerDraft);
    });

    it(`does not resurrect a removed draft when an old reader autosaves on ${event}`, async () => {
      await seedUser(userA);
      const page = harness(`/projects/${projectId}/daily-logs/new`);
      await page.reader.render();
      await deleteDailyLogDraft(userA, projectId);
      if (event === 'storage') page.switchScope(getOfflineDatabaseName(userB));
      else page.window.dispatchEvent({ type: event });
      await flushReaderCallbacks();
      assert.equal(await readDailyLogDraft(userA, projectId), null);
    });
  }

  it('does not queue stale input or delete a newer draft when an old recovery tab submits', async () => {
    const draft = await seedUser(userA);
    const page = harness(`/projects/${projectId}/daily-logs/new`);
    await page.reader.render();
    const queueButton = page.data.querySelectorAll('button').find((node) => node.textContent === 'Queue Log for Sync');
    assert.ok(queueButton);
    const newerDraft = { ...draft, updatedAt: '2030-01-01T00:00:00.000Z',
      values: { ...draft.values, workSummary: 'NEWER work must not be discarded by an old tab' } };
    const database = await openOfflineDatabase(userA);
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(OFFLINE_STORES.drafts, 'readwrite');
      transaction.objectStore(OFFLINE_STORES.drafts).put(newerDraft);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
    queueButton.dispatchEvent({ type: 'click', target: queueButton });
    await flushReaderCallbacks();
    assert.deepEqual(await readDailyLogDraft(userA, projectId), newerDraft);
    assert.deepEqual(await listOutboxOperations(userA), []);
    assert.match(page.data.textContent, /draft changed in another tab/);
    assert.equal(queueButton.disabled, false);
  });

  it('preserves the last entered text only in user A database when the scope changes to user B', async () => {
    const originalA = await seedUser(userA);
    const originalB = await seedUser(userB);
    const page = harness(`/projects/${projectId}/daily-logs/new`);
    await page.reader.render();
    const summary = page.data.querySelectorAll('textarea')[0];
    assert.ok(summary);
    summary.value = 'Latest unsaved field work from user A';
    summary.dispatchEvent({ type: 'input', target: summary });
    page.switchScope(getOfflineDatabaseName(userB));
    await flushReaderCallbacks();
    const savedA = await readDailyLogDraft(userA, projectId);
    assert.equal(savedA?.values.workSummary, summary.value);
    assert.equal(savedA?.clientId, originalA.clientId);
    assert.equal(savedA?.idempotencyKey, originalA.idempotencyKey);
    assert.deepEqual(await readDailyLogDraft(userB, projectId), originalB);
    assert.equal(page.data.hidden, true);
    assert.equal(summary.disabled, true);
  });

  it('autosaves edited text and queues that latest draft once with the original delivery identity', async () => {
    const draft = await seedUser(userA);
    const page = harness(`/projects/${projectId}/daily-logs/new`);
    await page.reader.render();
    const summary = page.data.querySelectorAll('textarea')[0];
    assert.ok(summary);
    summary.value = 'Latest recovered work ready for synchronization';
    summary.dispatchEvent({ type: 'input', target: summary });
    // Exercise the real 150ms recovery-form autosave debounce.
    await new Promise((resolve) => setTimeout(resolve, 175));
    await flushReaderCallbacks();
    assert.equal((await readDailyLogDraft(userA, projectId))?.values.workSummary, summary.value);
    const queueButton = page.data.querySelectorAll('button').find((node) => node.textContent === 'Queue Log for Sync');
    assert.ok(queueButton);
    queueButton.dispatchEvent({ type: 'click', target: queueButton });
    await flushReaderCallbacks();
    const operations = await listOutboxOperations(userA);
    assert.equal(operations.length, 1);
    assert.ok(operations[0].kind === 'daily_log_create');
    assert.equal(operations[0].payload.work_summary, summary.value);
    assert.equal(operations[0].operationId, draft.clientId);
    assert.equal(operations[0].idempotencyKey, draft.idempotencyKey);
    assert.equal(await readDailyLogDraft(userA, projectId), null);
    assert.match(page.data.textContent, /Queued for synchronization/);
  });
});
