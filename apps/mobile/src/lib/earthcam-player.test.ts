import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, it } from 'mocha';
import ts from 'typescript';
import { EARTHCAM_DISPATCH_ORIGINS, earthCamAccessNotice, earthCamFeedsForProject, earthCamPlayerState, isAllowedEarthCamNavigation, isEarthCamShareUrl } from './earthcam-player';

const feed = 'https://share.earthcam.net/railcommand-test-feed';

// Execute the installed library's real JS dispatch boundary with only its native
// bridge stubbed. This catches origin-vs-path matching and implicit OS handoffs;
// it is not a claim that the remote video or a native WebView was rendered.
function webViewDispatcher() {
  const require = createRequire(import.meta.url);
  const packageRoot = dirname(require.resolve('react-native-webview/package.json'));
  const source = readFileSync(join(packageRoot, 'src/WebViewShared.tsx'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  });
  const nativeCalls: string[] = [];
  const compiledModule = { exports: {} as Record<string, unknown> };
  runInNewContext(outputText, {
    module: compiledModule,
    exports: compiledModule.exports,
    require: (name: string) => {
      if (name === 'react-native') return { Linking: {
        canOpenURL: async (url: string) => { nativeCalls.push(`canOpen:${url}`); return true; },
        openURL: async (url: string) => { nativeCalls.push(`open:${url}`); },
      } };
      if (name === 'react') return require('react');
      if (name === 'escape-string-regexp') return require(name);
      if (name === './WebView.styles') return {};
      throw new Error(`Unexpected WebView test dependency: ${name}`);
    },
    console,
  });
  type Request = { nativeEvent: { url: string; lockIdentifier: number } };
  const create = compiledModule.exports.createOnShouldStartLoadWithRequest as (
    load: (allow: boolean, url: string, lockId: number) => void,
    origins: string[],
    decide: (request: { url: string }) => boolean,
  ) => (event: Request) => void;
  return { create, nativeCalls };
}

describe('EarthCam player navigation and recovery', () => {
  it('distinguishes absent project/capabilities from an explicit role denial without granting access', () => {
    assert.equal(earthCamAccessNotice(null, undefined, true)?.title, 'Select a project');
    assert.equal(earthCamAccessNotice('project-a', undefined, true)?.title, 'Project data unavailable');
    assert.equal(earthCamAccessNotice('project-a', {}, true)?.title, 'Camera access not verified');
    assert.equal(earthCamAccessNotice('project-a', { canViewEarthCam: false }, true)?.title, 'Camera access unavailable');
    assert.equal(earthCamAccessNotice('project-a', { canViewEarthCam: true }, true), null);
    assert.equal(earthCamAccessNotice('project-a', { canViewEarthCam: true }, false), null);
    assert.match(earthCamAccessNotice('project-a', {}, false)!.detail, /Reconnect.*online-only/);
    assert.match(earthCamAccessNotice('project-a', undefined, false)!.detail, /not available on this device/);
    const screen = readFileSync(new URL('../app/(tabs)/cameras.tsx', import.meta.url), 'utf8');
    assert.match(screen, /const canView = project\?\.canViewEarthCam === true/);
    assert.match(screen, /canView && embeds.length > 0/);
    assert.match(screen, /count=\{canView \? embeds.length : undefined\}/);
  });

  it('allows approved HTTPS feeds but rejects credentials, alternate ports, and lookalike hosts', () => {
    assert.equal(isEarthCamShareUrl(feed), true);
    assert.equal(isEarthCamShareUrl(`${feed}?view=live#player`), true);
    for (const url of [
      'http://share.earthcam.net/feed', 'https://share.earthcam.net.evil.example/feed',
      'https://evil.example/share.earthcam.net', 'https://share.earthcam.net:8443/feed',
      'https://user:password@share.earthcam.net/feed', 'file:///tmp/photo.jpg',
      'javascript:alert(1)', 'railcommand://projects/test', 'about:blank', 'invalid',
    ]) assert.equal(isEarthCamShareUrl(url), false, url);
    assert.equal(isAllowedEarthCamNavigation('about:blank'), true);
  });

  it('reproduces the old path-pattern bug in the installed WebView dispatcher', async () => {
    const { create, nativeCalls } = webViewDispatcher();
    let validatorCalled = false;
    let allowed: boolean | undefined;
    create((value) => { allowed = value; }, ['https://share.earthcam.net/*'], () => {
      validatorCalled = true;
      return true;
    })({ nativeEvent: { url: feed, lockIdentifier: 1 } });
    await Promise.resolve();
    assert.equal(allowed, false);
    assert.equal(validatorCalled, false);
    assert.deepEqual(nativeCalls, [`canOpen:${feed}`, `open:${feed}`]);
  });

  it('keeps an approved feed in the player and blocks unsafe navigation without any OS handoff', async () => {
    const { create, nativeCalls } = webViewDispatcher();
    const decisions: boolean[] = [];
    const dispatch = create((allow) => decisions.push(allow), EARTHCAM_DISPATCH_ORIGINS,
      (request) => isAllowedEarthCamNavigation(request.url));
    const cases = [
      [feed, true], ['about:blank', true], ['https://evil.example/feed', false],
      ['http://share.earthcam.net/feed', false], ['https://share.earthcam.net.evil.example/feed', false],
      ['https://share.earthcam.net:8443/feed', false], ['file:///tmp/file', false],
      ['railcommand://projects/test', false], ['javascript:alert(1)', false],
    ] as const;
    for (const [url] of cases) dispatch({ nativeEvent: { url, lockIdentifier: 1 } });
    await Promise.resolve();
    assert.deepEqual(decisions, cases.map(([, expected]) => expected));
    assert.deepEqual(nativeCalls, []);
  });

  it('never mounts a feed while offline or for a rejected initial URL, and supports failure-to-retry', () => {
    assert.equal(earthCamPlayerState(false, feed, false), 'offline');
    assert.equal(earthCamPlayerState(false, feed, true), 'offline');
    assert.equal(earthCamPlayerState(true, 'file:///tmp/file', false), 'blocked');
    assert.equal(earthCamPlayerState(true, feed, true), 'failed');
    assert.equal(earthCamPlayerState(true, feed, false), 'playable');
  });

  it('does not present the previous project’s feed after a project switch, even before refresh completes', () => {
    const cached = [{ id: 'feed-a', projectId: 'project-a', label: 'A feed', url: feed, createdAt: '2026-08-29' }];
    assert.deepEqual(earthCamFeedsForProject(cached, 'project-a'), cached);
    assert.deepEqual(earthCamFeedsForProject(cached, 'project-b'), []);
    assert.deepEqual(earthCamFeedsForProject(cached, null), []);
    assert.deepEqual(earthCamFeedsForProject(cached, 'project-a'), cached);
  });
});
