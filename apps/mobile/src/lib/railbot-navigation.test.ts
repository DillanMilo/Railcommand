import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, it } from 'mocha';
import { newBotDraft } from './railbot';

describe('RailBot navigation native recorder lifetime', () => {
  it('can leave an idle screen after Expo releases its recorder, even when audio-mode reset fails', async () => {
    const effects: (() => void | (() => void))[] = [];
    let released = false;
    let nativeReads = 0;
    let navigations = 0;
    const recorder = {
      get uri() { nativeReads++; if (released) throw new Error('Native shared object already released'); return 'file:///draft.m4a'; },
      stop() { nativeReads++; if (released) throw new Error('Native shared object already released'); return Promise.resolve(); },
    };
    const jsx = (type: unknown, props: unknown) => ({ type, props });
    const modules: Record<string, unknown> = {
      react: { useState: (initial: unknown) => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: (current: unknown) => ({ current }), useMemo: (f: () => unknown) => f(), useCallback: (f: unknown) => f, useEffect: (f: () => void | (() => void)) => effects.push(f) },
      'react/jsx-runtime': { jsx, jsxs: jsx },
      'react-native': { StyleSheet: { create: (s: unknown) => s }, Platform: { OS: 'ios' } },
      'react-native-safe-area-context': {},
      'expo-router': { router: { back: () => { navigations++; } } },
      'expo-audio': { RecordingPresets: { HIGH_QUALITY: {} }, useAudioRecorder: () => { effects.push(() => () => { released = true; }); return recorder; }, setAudioModeAsync: () => Promise.reject(new Error('Unavailable audio session')) },
      'expo-file-system': {},
      '@/providers/auth-provider': { useAuth: () => ({ session: { user: { id: 'user-a' } }, sessionRevision: 1, isSessionCurrent: () => true }) },
      '@/providers/mobile-data-provider': { useMobileData: () => ({ activeProjectId: 'project-a', online: true }) },
      '@/lib/offline-store': { readBotDraft: async () => null, saveBotDraft: async () => {} },
      '@/lib/railbot': { newBotDraft, botPrompts: [] },
      '@/lib/railbot-api': { railbotClient: () => {} },
      '@/lib/config': { mobileConfig: { profile: 'production' } },
      '@/components/railbot-message': {},
      '@/theme': { colors: {}, fonts: {} },
    };
    const exports: Record<string, any> = {};
    const source = ts.transpileModule(readFileSync(new URL('../app/railbot.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
    runInNewContext(source, { exports, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; }, AbortController, setTimeout, clearTimeout });
    const screen = exports.default();
    const tree = screen.type(screen.props);
    const findBack = (node: any): any => {
      if (!node || typeof node !== 'object') return null;
      if (node.props?.label === 'Back') return node;
      for (const child of [node.props?.children].flat()) { const found = findBack(child); if (found) return found; }
      return null;
    };
    const cleanups = effects.map(effect => effect());
    await Promise.resolve();
    findBack(tree).props.onPress();
    assert.equal(navigations, 1);
    for (const cleanup of cleanups) cleanup?.();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(released, true);
    assert.equal(nativeReads, 0, 'unmount must never access an already released native recorder');
  });
});
