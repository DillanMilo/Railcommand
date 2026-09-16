import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';

type TestSession = { user: { id: string }; access_token: string };
type AuthValue = {
  session: TestSession | null;
  sessionRevision: number;
  loading: boolean;
  googleEnabled: boolean | null;
  isSessionCurrent(userId: string | null, revision: number): boolean;
};
type Slot = { value?: unknown; deps?: readonly unknown[]; setter?: (value: unknown) => void; cleanup?: () => void };
type Context = { value: unknown; Provider: { context: Context } };

const session = (userId: string, token = 'synthetic-test-token'): TestSession => ({ user: { id: userId }, access_token: token });

// Run the real auth-provider effects, refs, and callbacks. The tiny hook scheduler
// replaces React rendering only; Supabase, links, and the settings request never
// reach a device or network. This verifies the owner lifetime that protects the
// offline read-only cache and draft/outbox, not real sign-in or token persistence.
function authHarness(settingsResponse: { ok: boolean; json?: () => Promise<unknown> } = { ok: false }) {
  let finishInitial!: (value: { data: { session: TestSession | null } }) => void;
  const initial = new Promise<{ data: { session: TestSession | null } }>((resolve) => { finishInitial = resolve; });
  let listener: ((event: string, next: TestSession | null) => void) | null = null;
  let unsubscribed = 0;
  let linksRemoved = 0;
  let settingsSignal: AbortSignal | undefined;
  let live = true;
  let dirty = true;
  let cursor = 0;
  const slots: Slot[] = [];
  const effects: { slot: Slot; effect: () => void | (() => void) }[] = [];
  const writes: unknown[] = [];
  const nextSlot = () => slots[cursor] ?? (slots[cursor] = {});
  const takeSlot = () => { const slot = nextSlot(); cursor += 1; return slot; };
  const sameDeps = (left: readonly unknown[] | undefined, right: readonly unknown[] | undefined) =>
    Boolean(left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index])));
  const react = {
    createContext(initialValue: unknown): Context {
      const context = { value: initialValue } as Context;
      context.Provider = { context };
      return context;
    },
    useContext: (context: Context) => context.value,
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
    useMemo<T>(factory: () => T, deps?: readonly unknown[]): T {
      const slot = takeSlot();
      if (!sameDeps(slot.deps, deps)) { slot.value = factory(); slot.deps = deps; }
      return slot.value as T;
    },
    useCallback<T>(callback: T, deps?: readonly unknown[]): T { return react.useMemo(() => callback, deps); },
    useEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const slot = takeSlot();
      if (!sameDeps(slot.deps, deps)) { slot.deps = deps; effects.push({ slot, effect }); }
    },
  };
  const jsx = (provider: Context['Provider'], props: { value: unknown }) => {
    provider.context.value = props.value;
    return null;
  };
  const compiled = { exports: {} as Record<string, unknown> };
  const source = readFileSync(new URL('../providers/auth-provider.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, URL, AbortController, console,
    fetch: async (url: URL, options: { signal: AbortSignal }) => {
      assert.equal(url.toString(), 'https://staging.example.invalid/auth/v1/settings');
      settingsSignal = options.signal;
      return settingsResponse;
    },
    require(name: string) {
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === '@/lib/supabase') return { supabase: { auth: {
        getSession: () => initial,
        onAuthStateChange: (callback: (event: string, next: TestSession | null) => void) => {
          listener = callback;
          return { data: { subscription: { unsubscribe: () => { unsubscribed += 1; } } } };
        },
      } } };
      if (name === '@/lib/config') return { mobileConfig: {
        supabaseUrl: 'https://staging.example.invalid', publishableKey: 'synthetic-public-key', linkHost: 'staging.example.invalid',
      } };
      if (name === 'expo-linking') return {
        getInitialURL: async () => null,
        addEventListener: () => ({ remove: () => { linksRemoved += 1; } }),
      };
      if (name === 'expo-router') return { router: { replace: () => { throw new Error('Unexpected navigation in auth lifecycle test'); } } };
      if (name === '@railcommand/domain') return { parseMobileDeepLink: () => { throw new Error('Unexpected deep-link parsing in auth lifecycle test'); } };
      throw new Error(`Unexpected auth test dependency: ${name}`);
    },
  });
  const render = () => {
    dirty = false;
    cursor = 0;
    (compiled.exports.AuthProvider as (props: { children: null }) => unknown)({ children: null });
    for (const { slot, effect } of effects.splice(0)) { slot.cleanup?.(); slot.cleanup = effect() || undefined; }
  };
  const flush = async () => {
    for (let tick = 0; tick < 20; tick += 1) { if (live && dirty) render(); await Promise.resolve(); }
  };
  return {
    writes, flush,
    value: () => (compiled.exports.useAuth as () => AuthValue)(),
    initialSession: (next: TestSession | null) => finishInitial({ data: { session: next } }),
    emit(event: string, next: TestSession | null) { assert.ok(listener); listener(event, next); },
    cleanupState: () => ({ unsubscribed, linksRemoved, settingsAborted: settingsSignal?.aborted }),
    unmount() { live = false; for (const slot of slots) slot.cleanup?.(); },
  };
}

describe('auth provider session ownership lifetime', () => {
  it('does not let a delayed initial getSession replace a newer auth event', async () => {
    const h = authHarness();
    await h.flush();
    h.emit('SIGNED_IN', session('user-b'));
    await h.flush();
    const revision = h.value().sessionRevision;
    assert.equal(h.value().session?.user.id, 'user-b');
    assert.equal(h.value().loading, false);
    h.initialSession(session('user-a'));
    await h.flush();
    assert.equal(h.value().session?.user.id, 'user-b');
    assert.equal(h.value().sessionRevision, revision);
    assert.equal(h.value().isSessionCurrent('user-b', revision), true);
    h.unmount();
  });

  it('synchronously invalidates the old A revision during A → B → A before a rerender', async () => {
    const h = authHarness();
    await h.flush();
    h.emit('SIGNED_IN', session('user-a'));
    await h.flush();
    const before = h.value();
    assert.equal(before.isSessionCurrent('user-a', before.sessionRevision), true);
    h.emit('SIGNED_IN', session('user-b'));
    h.emit('SIGNED_IN', session('user-a'));
    assert.equal(h.value(), before, 'No render has run between the two auth events');
    assert.equal(before.isSessionCurrent('user-a', before.sessionRevision), false, 'Returning to A must not revive A’s old requests');
    await h.flush();
    assert.equal(h.value().session?.user.id, 'user-a');
    assert.equal(h.value().sessionRevision, before.sessionRevision + 2);
    assert.equal(h.value().isSessionCurrent('user-a', h.value().sessionRevision), true);
    h.unmount();
  });

  it('retains the owner revision when only the same account’s token is refreshed', async () => {
    const h = authHarness();
    await h.flush();
    h.initialSession(session('user-a', 'synthetic-original'));
    await h.flush();
    const before = h.value();
    h.emit('TOKEN_REFRESHED', session('user-a', 'synthetic-refreshed'));
    assert.equal(before.isSessionCurrent('user-a', before.sessionRevision), true);
    await h.flush();
    assert.equal(h.value().sessionRevision, before.sessionRevision);
    assert.equal(h.value().session?.access_token, 'synthetic-refreshed');
    assert.equal(h.value().isSessionCurrent('user-a', before.sessionRevision), true);
    h.unmount();
  });

  it('unsubscribes on cleanup and ignores a late initial callback or auth event', async () => {
    const h = authHarness();
    await h.flush();
    const before = h.value();
    assert.equal(before.isSessionCurrent(null, before.sessionRevision), true);
    h.unmount();
    assert.deepEqual(h.cleanupState(), { unsubscribed: 1, linksRemoved: 1, settingsAborted: true });
    assert.equal(before.isSessionCurrent(null, before.sessionRevision), false);
    h.writes.length = 0;
    h.initialSession(session('user-a'));
    await h.flush();
    assert.equal(h.writes.length, 0, 'The late initial result is ignored even when no auth event was observed');
    h.emit('SIGNED_IN', session('user-b'));
    await h.flush();
    assert.equal(h.writes.length, 0, 'No state write is accepted after cleanup');
  });
});
import { URL } from 'node:url';


describe('Google provider discovery', () => {
  it('keeps Google available when discovery fails instead of treating failure as disabled', async () => {
    const h = authHarness();
    await h.flush();
    assert.equal(h.value().googleEnabled, null);
    h.unmount();
  });
  for (const enabled of [true, false]) {
    it(`honors an explicit Google provider setting of ${enabled}`, async () => {
      const h = authHarness({ ok: true, json: async () => ({ external: { google: enabled } }) });
      await h.flush();
      assert.equal(h.value().googleEnabled, enabled);
      h.unmount();
    });
  }
});
