import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import * as updateLogic from './app-update';

type Button = { text: string; onPress?: () => void; style?: string };
function harness(options: { enabled?: boolean; pending?: Promise<unknown> } = {}) {
  const alerts: { title: string; buttons: Button[] }[] = [], links: string[] = [];
  let safe = true, signedIn = true, requests = 0;
  let cleanup!: () => void;
  let foreground!: (state: string) => void;
  const appState = { currentState: 'active', addEventListener: (_event: string, callback: (state: string) => void) => { foreground = callback; return { remove() {} }; } };
  const dependencies: Record<string, unknown> = {
    react: { useCallback: (callback: unknown) => callback },
    'react-native': { AppState: appState, Platform: { OS: 'ios' }, Alert: { alert: (title: string, _body: string, buttons: Button[]) => alerts.push({ title, buttons }) }, Linking: { openURL: async (url: string) => { links.push(url); } } },
    'expo-application': { applicationId: 'io.railcommand.app', nativeBuildVersion: '300013' },
    'expo-router': { useFocusEffect: (effect: () => () => void) => { cleanup = effect(); } },
    '@/providers/auth-provider': { useAuth: () => ({ session: { user: { id: 'synthetic' } }, sessionRevision: 1, isSessionCurrent: () => signedIn }) },
    '@/lib/api': { mobileApiForUser: (id: string, current: () => boolean) => { assert.equal(id, 'synthetic'); assert.equal(current(), true); return { getAppRelease: async () => { requests++; return options.pending ?? { schemaVersion: 1, ios: { buildNumber: 300014, version: '1.0.0', channel: 'testflight' } }; } }; } },
    '@/lib/config': { mobileConfig: { profile: 'production' } },
    '@/lib/app-update': updateLogic,
  };
  const compiled = { exports: {} as { AppUpdatePrompt: (props: { enabled: boolean; canPrompt: () => boolean }) => null } };
  const source = readFileSync(new URL('../components/app-update-prompt.tsx', import.meta.url), 'utf8');
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: compiled, exports: compiled.exports, require: (name: string) => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
  });
  compiled.exports.AppUpdatePrompt({ enabled: options.enabled ?? true, canPrompt: () => safe });
  return { alerts, links, requests: () => requests, cleanup: () => cleanup(), unsafe: () => { safe = false; }, changeAccount: () => { signedIn = false; }, foreground: () => foreground('active') };
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

describe('actual native update prompt wiring', () => {
  it('shows Update available and Update opens RailCommand in TestFlight without repeated foreground alerts', async () => {
    const h = harness(); await settle(); assert.equal(h.alerts[0].title, 'Update available');
    assert.deepEqual(Array.from(h.alerts[0].buttons, b => b.text), ['Later', 'Update']);
    h.alerts[0].buttons.find(b => b.text === 'Update')!.onPress!(); await settle();
    assert.deepEqual(h.links, [updateLogic.TESTFLIGHT_APP_URL]);
    h.foreground(); await settle(); assert.equal(h.alerts.length, 1); assert.equal(h.requests(), 1); h.cleanup();
  });
  it('does no work on a disabled/unsafe screen and leaves all app data dependencies untouched', async () => {
    const h = harness({ enabled: false }); await settle(); assert.equal(h.requests(), 0); assert.equal(h.alerts.length, 0); h.cleanup();
  });
  for (const change of ['unsafe', 'changeAccount', 'cleanup'] as const) {
    it(`ignores an update response after ${change}`, async () => {
      let finish!: (value: unknown) => void;
      const pending = new Promise(resolve => { finish = resolve; });
      const h = harness({ pending }); h[change]();
      finish({ schemaVersion: 1, ios: { buildNumber: 300014, version: '1.0.0', channel: 'testflight' } }); await settle();
      assert.equal(h.alerts.length, 0); h.cleanup();
    });
  }
});
