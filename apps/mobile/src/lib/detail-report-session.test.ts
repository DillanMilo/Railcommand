import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import type { MobilePdfReportRequest, MobileRecordDetail } from '@railcommand/domain';
import { exportAndSharePdf } from './report-export';
import type { RecordReadDependencies } from './record-detail';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const projectId = '33333333-3333-4333-8333-333333333333';
const recordId = '44444444-4444-4444-8444-444444444444';
const scope = { projectId, recordId, kind: 'rfis' as const };
const selection: MobilePdfReportRequest = { projectId, kind: 'rfis', recordIds: [recordId] };
const bytes = Buffer.from('%PDF-1.7\nSynthetic fixture');
const report = { fileName: '../../untrusted.pdf', mimeType: 'application/pdf', base64: bytes.toString('base64'), byteLength: bytes.length, recordCount: 1 };
type Current = () => boolean;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((complete) => { resolve = complete; });
  return { promise, resolve };
}

function compile(path: string, mocks: Record<string, unknown>): Record<string, unknown> {
  const compiled = { exports: {} as Record<string, unknown> };
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  runInNewContext(outputText, {
    module: compiled, exports: compiled.exports, Error, console, setTimeout, clearTimeout,
    require(name: string) {
      if (name in mocks) return mocks[name];
      throw new Error(`Unexpected detail/report test dependency: ${name}`);
    },
  });
  return compiled.exports;
}

function ownership() {
  let userId: string | null = userA;
  let revision = 1;
  let generation = 0;
  return {
    auth: () => ({ session: userId ? { user: { id: userId } } : null, sessionRevision: revision,
      isSessionCurrent: (expected: string | null, expectedRevision: number) => expected === userId && expectedRevision === revision }),
    captureOfflineScope(expected: string) {
      assert.equal(expected, userA);
      const captured = generation;
      return () => captured === generation;
    },
    switchAwayAndBack() { userId = userB; revision += 1; userId = userA; revision += 1; },
    purge() { generation += 1; },
  };
}

// The native adapter and shared PDF pipeline are real; only Expo side effects
// and the owner-bound API are mocked. No file, network, or share sheet is opened.
function nativeHarness(pauseAt?: 'availability' | 'download', cancelDuringWrite = false) {
  const owner = ownership();
  const initialAuth = owner.auth();
  const reached = deferred(); const released = deferred();
  const calls: string[] = [];
  const guards: Current[] = [];
  let current = true;
  async function pause(stage: 'availability' | 'download') {
    if (stage === pauseAt) { reached.resolve(); await released.promise; }
  }
  class Directory {
    uri: string;
    constructor(root: string, ...parts: string[]) { this.uri = [root, ...parts].join('/'); }
    create() { calls.push('mkdir'); }
  }
  class File {
    uri: string;
    exists = false;
    constructor(directory: Directory, name: string) {
      assert.equal(name, 'rfis-report-local-uuid.pdf');
      this.uri = `${directory.uri}/${name}`;
      assert.equal(this.uri, `file:///owned/railcommand/${userA}/exports/rfis-report-local-uuid.pdf`);
      calls.push('allocate');
    }
    write(value: string, options: { encoding: string }) {
      assert.equal(value, report.base64); assert.equal(options.encoding, 'base64');
      this.exists = true; calls.push('write');
      if (cancelDuringWrite) current = false;
    }
    delete() { this.exists = false; calls.push('remove'); }
  }
  const exports = compile('./native-report-export.ts', {
    'expo-crypto': { randomUUID: () => 'local-uuid' },
    'expo-file-system': { Directory, File, Paths: { document: 'file:///owned' } },
    'expo-sharing': {
      async isAvailableAsync() { calls.push('available'); await pause('availability'); return true; },
      async shareAsync(uri: string) { assert.match(uri, new RegExp(`/railcommand/${userA}/exports/`)); calls.push('share'); },
    },
    'react-native': { Platform: { OS: 'ios' } },
    './report-export': { exportAndSharePdf },
    './storage-scope': { captureOfflineScope: owner.captureOfflineScope },
    './api': { mobileApiForUser(expected: string, isCurrent: Current) {
      assert.equal(expected, userA); assert.equal(typeof isCurrent, 'function'); guards.push(isCurrent);
      return { async exportPdfReport(input: MobilePdfReportRequest) {
        assert.equal(isCurrent(), true, 'no report fetch after cancellation');
        assert.deepEqual(input, selection); calls.push('fetch'); await pause('download'); return report;
      } };
    } },
  });
  const share = exports.shareNativePdfReport as (userId: string, input: MobilePdfReportRequest, current: Current) => Promise<void>;
  return { calls, guards, reached: reached.promise, release: released.resolve, ...owner,
    run: () => share(userA, selection, () => current && initialAuth.isSessionCurrent(userA, initialAuth.sessionRevision)) };
}

type Element = { type: unknown; props: Record<string, unknown> };
const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props });
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
const fixture = (): MobileRecordDetail => ({ kind: 'rfis', fetchedAt: '2026-08-30T12:00:00Z', milestone: null,
  attachments: [{ id: 'attachment-1', fileName: 'photo.jpg', fileType: 'image/jpeg', size: 100, category: 'standard' }],
  record: { id: recordId, projectId, number: 'RFI-001', subject: 'Synthetic question', question: 'Question', answer: null,
    status: 'open', priority: 'high', submitDate: '2026-08-29', responseDate: null, dueDate: '2026-09-01',
    createdAt: '2026-08-29T12:00:00Z', submittedBy: null, assignedTo: null, responses: [] },
});

// One mounted render is enough to execute the actual focus/export callbacks.
// Hook stubs expose scope invalidation without pretending to render native UI.
function componentHarness(kind: 'detail' | 'button') {
  const owner = ownership();
  let readDependencies: RecordReadDependencies | undefined;
  const captured: { name: string; userId: string; guard: Current }[] = [];
  const stateWrites: unknown[] = [];
  const cleanup: (() => void)[] = [];
  const refs: { current: unknown }[] = [];
  const layouts: { deps?: readonly unknown[]; dispose?: () => void }[] = [];
  let refCursor = 0;
  let layoutCursor = 0;
  const reportPending = deferred();
  let reportGuard: Current | undefined;
  const react = {
    useRef<T>(initial: T) {
      const index = refCursor++;
      refs[index] ??= { current: initial };
      return refs[index] as { current: T };
    },
    useCallback: <T>(callback: T) => callback,
    useState(initial: unknown) {
      const value = initial && typeof initial === 'object' && 'detail' in initial
        ? { detail: fixture(), loading: false, cached: false, message: 'Up to date' } : initial;
      return [value, (next: unknown) => stateWrites.push(next)];
    },
    useEffect() {},
    useLayoutEffect(effect: () => void | (() => void), deps?: readonly unknown[]) {
      const index = layoutCursor++;
      const previous = layouts[index];
      if (previous?.deps && deps && previous.deps.length === deps.length
        && previous.deps.every((value, position) => Object.is(value, deps[position]))) return;
      previous?.dispose?.();
      layouts[index] = { deps, dispose: effect() || undefined };
    },
  };
  const capture = (name: string, userId: string, guard: Current) => {
    assert.equal(userId, userA); assert.equal(typeof guard, 'function');
    captured.push({ name, userId, guard });
  };
  const mocks: Record<string, unknown> = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-native': { ActivityIndicator: 'ActivityIndicator', Text: 'Text', View: 'View', Modal: 'Modal', Pressable: 'Pressable',
      StyleSheet: { create: (value: unknown) => value }, Linking: { openURL: async () => undefined }, Alert: { alert() {} },
      AppState: { addEventListener: () => ({ remove() {} }) } },
    'expo-image': { Image: 'Image' }, 'expo-symbols': { SymbolView: 'SymbolView' },
    'expo-router': { router: { push() {}, replace() {} }, useFocusEffect(effect: () => () => void) { cleanup.push(effect()); } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    './ui': { Screen: 'Screen', StatusBanner: 'StatusBanner' },
    './web-shell': { BreadcrumbRow: 'BreadcrumbRow', WebActionButton: 'WebActionButton', WebHeader: 'WebHeader' },
    './record-body': { RecordBody: 'RecordBody', recordStyles: {} },
    '@/theme': { colors: {} }, '@/lib/config': { mobileConfig: { supabaseUrl: 'https://example.invalid' } },
    '@/providers/auth-provider': { useAuth: owner.auth },
    '@/lib/storage-scope': { captureOfflineScope: owner.captureOfflineScope },
    '@/lib/record-detail': {
      loadRecordDetail(_scope: unknown, _online: boolean, deps: RecordReadDependencies) { readDependencies = deps; return Promise.resolve(); },
      verifiedAttachmentUrl: () => 'https://example.invalid/signed-photo',
    },
    '@/lib/offline-store': {
      async readCachedRecord(userId: string, _scope: unknown, guard: Current) { capture('read', userId, guard); return fixture(); },
      async cacheRecord(userId: string, _scope: unknown, _value: unknown, guard: Current) { capture('save', userId, guard); },
      async removeCachedRecord(userId: string, _scope: unknown, guard: Current) { capture('remove', userId, guard); },
    },
    '@/lib/api': { mobileApiForUser(userId: string, guard: Current) {
      capture('api', userId, guard);
      return {
        async getRecordDetail() { capture('fetch', userId, guard); return fixture(); },
        async getRecordAttachment() { capture('attachment', userId, guard); return { url: 'https://example.invalid/signed-photo' }; },
      };
    } },
    '@/lib/native-report-export': { shareNativePdfReport(userId: string, input: MobilePdfReportRequest, guard: Current) {
      assert.equal(userId, userA); assert.deepEqual(Array.from(input.recordIds), selection.recordIds);
      reportGuard = guard; return reportPending.promise;
    } },
  };
  const path = kind === 'detail' ? '../components/record-detail-screen.tsx' : '../components/report-export-button.tsx';
  const exported = compile(path, mocks);
  const render = exported[kind === 'detail' ? 'RecordDetailScreen' : 'ReportExportButton'] as (props: unknown) => Element;
  const renderCurrent = (selectedProjectId = projectId) => {
    refCursor = 0; layoutCursor = 0;
    return render(kind === 'detail' ? { userId: userA, scope, projectName: 'Synthetic project', online: true }
      : { kind: 'rfis', projectId: selectedProjectId, recordIds: [recordId], online: true });
  };
  let tree = renderCurrent();
  return { ...owner, captured, stateWrites, reportPending,
    get deps() { assert.ok(readDependencies); return readDependencies; },
    get reportGuard() { assert.ok(reportGuard); return reportGuard; },
    press() {
      const target = elements(tree).find((element) => kind === 'detail'
        ? element.type === 'Pressable' : element.props.title === 'Export PDF');
      assert.ok(target); (target.props.onPress as () => void)();
    },
    rerenderProject(nextProjectId: string) { assert.equal(kind, 'button'); tree = renderCurrent(nextProjectId); },
    blur() { cleanup.forEach((dispose) => dispose()); layouts.forEach((layout) => layout.dispose?.()); },
  };
}

describe('owner-scoped detail reads and native report handoff', () => {
  it('fetches, writes, shares, and removes a validated report within the owning user’s directory', async () => {
    const h = nativeHarness(); await h.run();
    assert.deepEqual(h.calls, ['available', 'fetch', 'allocate', 'mkdir', 'write', 'share', 'remove']);
    assert.ok(h.guards.length); assert.equal(h.guards.every((current) => current()), true);
  });

  for (const stage of ['availability', 'download'] as const) {
    for (const reason of ['A→B→A', 'purge'] as const) {
      it(`cancels report ${stage} after ${reason} before any later fetch, file write, or share`, async () => {
        const h = nativeHarness(stage); const running = h.run(); await h.reached;
        if (reason === 'purge') h.purge(); else h.switchAwayAndBack();
        h.release(); await assert.rejects(running, /cancelled|changed/i);
        assert.deepEqual(h.calls, stage === 'availability' ? ['available'] : ['available', 'fetch']);
        assert.equal(h.guards.every((current) => !current()), true);
      });
    }
  }

  it('removes the existing temporary file without sharing when cancellation occurs before handoff', async () => {
    const h = nativeHarness(undefined, true);
    await assert.rejects(h.run(), /cancelled|changed/i);
    assert.deepEqual(h.calls, ['available', 'fetch', 'allocate', 'mkdir', 'write', 'remove']);
  });

  for (const reason of ['A→B→A', 'purge', 'focus loss'] as const) {
    it(`binds detail read/cache/attachment callbacks to a guard invalidated by ${reason}`, async () => {
      const h = componentHarness('detail');
      assert.equal(h.deps.isCurrent(), true);
      await h.deps.read(); await h.deps.save(fixture()); await h.deps.remove(); await h.deps.fetch();
      h.press();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
      assert.deepEqual(h.captured.filter((call) => call.name !== 'api').map((call) => call.name), ['read', 'save', 'remove', 'fetch', 'attachment']);
      assert.equal(h.captured.every((call) => call.guard()), true);
      if (reason === 'purge') h.purge(); else if (reason === 'focus loss') h.blur(); else h.switchAwayAndBack();
      assert.equal(h.deps.isCurrent(), false);
      assert.equal(h.captured.every((call) => !call.guard()), true);
    });
  }

  for (const reason of ['A→B→A', 'purge', 'unmount'] as const) {
    it(`passes a report-button guard that remains invalid after ${reason}`, async () => {
      const h = componentHarness('button'); h.press(); assert.equal(h.reportGuard(), true);
      if (reason === 'purge') h.purge(); else if (reason === 'unmount') h.blur(); else h.switchAwayAndBack();
      assert.equal(h.reportGuard(), false);
      h.reportPending.resolve();
      for (let index = 0; index < 4; index += 1) await Promise.resolve();
    });
  }

  it('does not revive an in-flight report button guard after project P→Q→P', async () => {
    const h = componentHarness('button'); h.press();
    const original = h.reportGuard;
    assert.equal(original(), true);
    h.rerenderProject('55555555-5555-4555-8555-555555555555');
    assert.equal(original(), false);
    h.rerenderProject(projectId);
    assert.equal(original(), false);
    h.reportPending.resolve();
    for (let index = 0; index < 4; index += 1) await Promise.resolve();
    h.blur();
  });
});
