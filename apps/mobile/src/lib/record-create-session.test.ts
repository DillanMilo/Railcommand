import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { MobileApiError } from '@railcommand/api-client';
import { MOBILE_SPEC_SECTIONS, validateRecordDraft, type MobileProject, type MobileRecordCreateResult,
  type MobileRecordDraft, type MobileRecordFormOptions } from '@railcommand/domain';
import { cleanFormOptions, createDraftWriter } from './record-drafts';

const USER_A = '10000000-0000-4000-8000-000000000001';
const USER_B = '10000000-0000-4000-8000-000000000002';
const PROJECT = '20000000-0000-4000-8000-000000000001';
const CLIENT = '30000000-0000-4000-8000-000000000001';
const ASSIGNEE = '40000000-0000-4000-8000-000000000001';
const project: MobileProject = { id: PROJECT, name: 'Synthetic client test', status: 'active', location: 'QA only',
  client: 'QA', role: 'engineer', canEdit: true, updatedAt: new Date().toISOString() };
const original: MobileRecordDraft = { version: 1, kind: 'rfis', projectId: PROJECT, clientId: CLIENT,
  title: 'Synthetic question', body: 'Preserve this input after cancellation.', priority: 'medium', assignedTo: ASSIGNEE,
  dueDate: '2026-09-10', milestoneId: '', specSection: '', updatedAt: new Date().toISOString() };
const choices = (): MobileRecordFormOptions => ({ kind: 'rfis', projectId: PROJECT, fetchedAt: new Date().toISOString(),
  assignees: [{ id: ASSIGNEE, name: 'Synthetic reviewer' }], milestones: [] });
const receipt = (): MobileRecordCreateResult => ({ id: CLIENT, number: 'RFI-QA-1', projectId: PROJECT, kind: 'rfis', duplicate: false });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}
type Slot = { value?: unknown; deps?: readonly unknown[]; setter?: (value: unknown) => void; cleanup?: () => void };
type Node = { type: string | symbol; props: Record<string, unknown> };

// Execute the actual screen, field/button callbacks and async sequencing without
// rendering native views. Draft serialization and validation are real; auth,
// storage, network and deadlines are deterministic stubs. This covers offline
// draft preservation and explicitly online-only creation, not native SQLite or
// a successful deployed-server submission.
function createHarness({ online = true, canCreate = true } = {}) {
  let owner = { userId: USER_A, revision: 1 };
  let generation = 0;
  let saved = { ...original };
  let saveCompletion: ReturnType<typeof deferred<void>> | null = null;
  let live = true;
  let dirty = true;
  let cursor = 0;
  let tree: Node;
  let timerId = 0;
  const timers = new Set<number>();
  const slots: Slot[] = [];
  const effects: { slot: Slot; effect: () => void | (() => void) }[] = [];
  const layoutEffects: typeof effects = [];
  const writes: unknown[] = [];
  const saveCalls: MobileRecordDraft[] = [];
  const optionSaves: MobileRecordFormOptions[] = [];
  const removals: MobileRecordDraft[] = [];
  const navigation: unknown[] = [];
  const requests: { draft: MobileRecordDraft; current: () => boolean; result: ReturnType<typeof deferred<MobileRecordCreateResult>> }[] = [];
  const optionRequests: { current: () => boolean; result: ReturnType<typeof deferred<MobileRecordFormOptions>> }[] = [];
  const currentSession = (userId: string, revision: number) => owner.userId === userId && owner.revision === revision;
  const navigator = { dispatch: (action: unknown) => navigation.push(action) };
  const takeSlot = () => { const index = cursor++; return slots[index] ?? (slots[index] = {}); };
  const sameDeps = (left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) =>
    Boolean(left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index])));
  const effectHook = (queue: typeof effects) => (effect: () => void | (() => void), deps?: readonly unknown[]) => {
    const slot = takeSlot();
    if (!sameDeps(slot.deps, deps)) { slot.deps = deps; queue.push({ slot, effect }); }
  };
  const react = {
    useState<T>(initialValue: T | (() => T)) {
      const slot = takeSlot();
      if (!slot.setter) {
        slot.value = typeof initialValue === 'function' ? (initialValue as () => T)() : initialValue;
        slot.setter = (next) => {
          const value = typeof next === 'function' ? (next as (previous: unknown) => unknown)(slot.value) : next;
          writes.push(value);
          if (live && !Object.is(slot.value, value)) { slot.value = value; dirty = true; }
        };
      }
      return [slot.value as T, slot.setter] as const;
    },
    useRef<T>(initialValue: T) {
      const slot = takeSlot();
      if (!('value' in slot)) slot.value = { current: initialValue };
      return slot.value as { current: T };
    },
    useCallback<T>(callback: T, deps?: readonly unknown[]): T {
      const slot = takeSlot();
      if (!sameDeps(slot.deps, deps)) { slot.value = callback; slot.deps = deps; }
      return slot.value as T;
    },
    useEffect: effectHook(effects),
    useLayoutEffect: effectHook(layoutEffects),
  };
  const jsx = (type: Node['type'], props: Node['props']): Node => ({ type, props });
  const compiled = { exports: {} as Record<string, unknown> };
  const source = readFileSync(new URL('../components/record-create-screen.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, console,
    setTimeout: () => { const id = ++timerId; timers.add(id); return id; },
    clearTimeout: (id: number) => timers.delete(id),
    require(name: string) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: Symbol.for('test.fragment') };
      if (name === '@railcommand/domain') return { MOBILE_SPEC_SECTIONS, validateRecordDraft };
      if (name === '@railcommand/api-client') return { MobileApiError };
      if (name === 'expo-crypto') return { randomUUID: () => CLIENT };
      if (name === 'expo-router') return { useNavigation: () => navigator,
        router: { replace: (route: unknown) => navigation.push(route), push: (route: unknown) => navigation.push(route) } };
      if (name === 'expo-router/build/react-navigation/core/usePreventRemove') return { usePreventRemove: () => undefined };
      if (name === 'react-native') return { ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View',
        Alert: { alert: (...args: unknown[]) => navigation.push(args) }, StyleSheet: { create: (styles: unknown) => styles } };
      if (name === './ui') return { Field: 'Field', Screen: 'Screen', StatusBanner: 'StatusBanner' };
      if (name === './web-shell') return { BreadcrumbRow: 'BreadcrumbRow', ModuleHeading: 'ModuleHeading', WebActionButton: 'WebActionButton', WebHeader: 'WebHeader' };
      if (name === './form-choice') return { FormChoice: 'FormChoice' };
      if (name === '@/theme') return { colors: {}, fonts: {} };
      if (name === '@/providers/auth-provider') return { useAuth: () => ({ sessionRevision: owner.revision, isSessionCurrent: currentSession }) };
      if (name === '@/lib/storage-scope') return { captureOfflineScope: () => {
        const captured = generation;
        return () => generation === captured;
      } };
      if (name === '@/lib/record-drafts') return { cleanFormOptions, createDraftWriter };
      if (name === '@/lib/offline-store') return { recordDraftStore: {
        read: async () => ({ ...saved }),
        readOptions: async () => choices(),
        save: async (_userId: string, value: MobileRecordDraft, current: () => boolean) => {
          saveCalls.push({ ...value });
          if (!current()) throw new Error('Synthetic canceled device write');
          saved = { ...value };
          const completion = saveCompletion;
          saveCompletion = null;
          // The local write can commit before its completion reaches the caller.
          if (completion) await completion.promise;
        },
        saveOptions: async (_userId: string, options: MobileRecordFormOptions) => { optionSaves.push(options); },
        removeCreated: async (_userId: string, value: MobileRecordDraft, current: () => boolean) => { if (current()) removals.push(value); },
      } };
      if (name === '@/lib/api') return { mobileApiForUser: (_userId: string, current: () => boolean) => ({
        getRecordFormOptions: () => {
          const result = deferred<MobileRecordFormOptions>();
          optionRequests.push({ current, result });
          return result.promise;
        },
        createRecord: (value: MobileRecordDraft) => {
          const result = deferred<MobileRecordCreateResult>();
          requests.push({ draft: { ...value }, current, result });
          return result.promise;
        },
      }) };
      throw new Error(`Unexpected record-create test dependency: ${name}`);
    },
  });
  const render = () => {
    dirty = false;
    cursor = 0;
    tree = (compiled.exports.RecordCreateScreen as (props: unknown) => Node)({ userId: USER_A, project, kind: 'rfis', online, canCreate });
    for (const queue of [layoutEffects, effects]) for (const { slot, effect } of queue.splice(0)) {
      slot.cleanup?.(); slot.cleanup = effect() || undefined;
    }
  };
  const flush = async () => {
    for (let tick = 0; tick < 30; tick += 1) { if (live && dirty) render(); await Promise.resolve(); }
  };
  const nodes = () => {
    const result: Node[] = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (!value || typeof value !== 'object' || !('props' in value)) return;
      const node = value as Node;
      result.push(node); visit(node.props.children);
    };
    visit(tree);
    return result;
  };
  const button = (title: string) => {
    const match = nodes().find((node) => node.type === 'WebActionButton' && node.props.title === title);
    assert.ok(match, `Expected actual screen button: ${title}`);
    return match;
  };
  return {
    requests, optionRequests, saveCalls, optionSaves, removals, navigation, writes, flush, button,
    saved: () => saved,
    status: () => nodes().find((node) => node.type === 'StatusBanner')?.props.detail as string,
    input: (label: string) => nodes().find((node) => node.type === 'Field' && node.props.label === label)?.props.value,
    press(title: string) { (button(title).props.onPress as () => void)(); },
    async start(resolveOptions = true) {
      await flush();
      if (resolveOptions && optionRequests.length) { optionRequests[0].result.resolve(choices()); await flush(); }
      assert.equal(this.input('Subject *'), original.title);
      writes.length = 0;
    },
    changeOwner(userId: string) { owner = { userId, revision: owner.revision + 1 }; },
    purge() { generation += 1; },
    delayNextSaveCompletion() { const completion = deferred<void>(); saveCompletion = completion; return completion; },
    dispose() { live = false; for (const slot of slots) slot.cleanup?.(); timers.clear(); },
  };
}

describe('record creation account/storage lifetime', () => {
  it('does not accept a late create receipt after A → B → A before React rerenders', async () => {
    const h = createHarness();
    await h.start();
    h.press('Create RFI');
    await h.flush();
    assert.equal(h.requests.length, 1);
    h.changeOwner(USER_B); h.changeOwner(USER_A);
    assert.equal(h.requests[0].current(), false);
    h.writes.length = 0;
    h.requests[0].result.resolve(receipt());
    await h.flush();
    assert.equal(h.writes.length, 0, 'No receipt, status or busy-state mutation crosses the old account lifetime');
    assert.ok(h.saveCalls.every((value) => !value.createdId));
    assert.deepEqual(h.saved(), original);
    assert.deepEqual(h.navigation, []);
    h.dispose();
  });

  it('does not write a late receipt after same-account device cleanup', async () => {
    const h = createHarness();
    await h.start();
    h.press('Create RFI');
    await h.flush();
    h.purge(); h.writes.length = 0;
    h.requests[0].result.resolve(receipt());
    await h.flush();
    assert.equal(h.writes.length, 0);
    assert.equal(h.saveCalls.length, 1, 'Only the pre-request draft persistence occurred');
    assert.equal(h.saved().createdId, undefined);
    assert.deepEqual(h.navigation, []);
    h.dispose();
  });

  it('persists a verified same-client-ID receipt and opens it only on explicit request', async () => {
    const h = createHarness();
    await h.start();
    h.press('Create RFI');
    await h.flush();
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].draft.clientId, CLIENT);
    h.requests[0].result.resolve(receipt());
    await h.flush();
    assert.equal(h.saved().createdId, CLIENT);
    assert.equal(h.saveCalls.length, 2);
    assert.match(h.status(), /RFI-QA-1 created/);
    assert.deepEqual(h.navigation, []);
    h.press('Open created record');
    await h.flush();
    assert.equal(h.removals.length, 1);
    assert.equal(JSON.stringify(h.navigation), JSON.stringify([{ pathname: '/record/[kind]/[id]', params: { kind: 'rfis', id: CLIENT, projectId: PROJECT } }]));
    h.dispose();
  });

  it('does not render or cache an options response after its account scope is canceled', async () => {
    const h = createHarness();
    await h.start(false);
    assert.equal(h.optionRequests.length, 1);
    h.changeOwner(USER_B); h.writes.length = 0;
    h.optionRequests[0].result.resolve(choices());
    await h.flush();
    assert.equal(h.writes.length, 0);
    assert.equal(h.optionSaves.length, 0);
    assert.equal(h.requests.length, 0);
    assert.deepEqual(h.saved(), original);
    h.dispose();
  });

  it('does not dispatch creation when the account changes between local persistence and API dispatch', async () => {
    const h = createHarness();
    await h.start();
    const persisted = h.delayNextSaveCompletion();
    h.press('Create RFI');
    await h.flush();
    assert.equal(h.saveCalls.length, 1);
    assert.equal(h.requests.length, 0);
    h.changeOwner(USER_B); h.writes.length = 0;
    persisted.resolve();
    await h.flush();
    assert.equal(h.requests.length, 0);
    assert.equal(h.writes.length, 0);
    assert.deepEqual(h.saved(), original);
    h.dispose();
  });

  it('keeps the original draft and refuses creation both offline and without project permission', async () => {
    for (const settings of [{ online: false, canCreate: true }, { online: true, canCreate: false }]) {
      const h = createHarness(settings);
      await h.start();
      assert.equal(h.button('Create RFI').props.disabled, true);
      // Exercise the defensive handler as well as the disabled UI contract.
      h.press('Create RFI');
      await h.flush();
      assert.equal(h.requests.length, 0);
      assert.equal(h.optionRequests.length, 0);
      assert.equal(h.saveCalls.length, 0);
      assert.deepEqual(h.saved(), original);
      assert.equal(h.input('Subject *'), original.title);
      assert.match(h.status(), /online-only.*permission/);
      h.dispose();
    }
  });
});
import { URL } from 'node:url';
