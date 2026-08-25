import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';

const read = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 2 mobile foundation', () => {
  it('accounts for safe areas, keyboard visibility, and tablet layouts', () => {
    const css = read('./styles.css');
    const lifecycle = read('./device-lifecycle.ts');
    assert.match(css, /env\(safe-area-inset-top\)/);
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    assert.match(css, /@media \(min-width: 760px\)/);
    assert.match(css, /@media \(min-width: 1024px\)/);
    assert.match(lifecycle, /Keyboard\.addListener\('keyboardWillShow'/);
    assert.match(lifecycle, /data-keyboard-open/);
  });

  it('keeps native sessions in environment-partitioned secure storage', () => {
    const storage = read('./secure-storage.ts');
    const auth = read('./supabase.ts');
    assert.match(storage, /SecureStorage\.setKeyPrefix\(`railcommand_\$\{environment\}_session_`\)/);
    assert.doesNotMatch(storage, /localStorage/);
    assert.match(auth, /storageKey: `railcommand-\$\{mobileConfig\.environment\}-auth`/);
    assert.match(auth, /supabase\.auth\.startAutoRefresh\(\)/);
    assert.match(auth, /supabase\.auth\.stopAutoRefresh\(\)/);
  });

  it('declares custom links, verified links, and least-scoped device permissions', () => {
    const info = read('../ios/App/App/Info.plist');
    const entitlements = read('../ios/App/App/App.entitlements');
    const manifest = read('../android/app/src/main/AndroidManifest.xml');
    assert.match(info, /<string>railcommand<\/string>/);
    assert.match(entitlements, /applinks:railcommand\.io/);
    assert.match(manifest, /android:scheme="railcommand"/);
    assert.match(manifest, /android:autoVerify="true"/);
    assert.match(manifest, /android:host="railcommand\.io"/);
    assert.match(manifest, /android\.permission\.ACCESS_COARSE_LOCATION/);
    assert.match(manifest, /android\.permission\.ACCESS_FINE_LOCATION/);
    assert.doesNotMatch(manifest, /ACCESS_BACKGROUND_LOCATION/);
  });

  it('keeps the native shell bundled and crash uploads disabled pending privacy approval', () => {
    const config = read('../capacitor.config.ts');
    const reporting = read('./error-reporting.ts');
    assert.doesNotMatch(config, /server\s*:/);
    assert.doesNotMatch(reporting, /sentry|bugsnag|crashlytics|datadog/i);
    assert.match(reporting, /no external crash or error upload/i);
  });

  it('keeps unsigned native CI on Node 22 without repository secrets', () => {
    const workflow = read('../../../.github/workflows/ci.yml');
    const simulatorBuild = read('../../../scripts/mobile-ios-simulator-build.mjs');
    const xcodeProject = read('../ios/App/App.xcodeproj/project.pbxproj');
    assert.match(workflow, /node-version: 22/);
    assert.match(workflow, /android-unsigned:/);
    assert.match(workflow, /ios-simulator-unsigned:/);
    assert.match(workflow, /CODE_SIGNING_ALLOWED=NO|mobile-ios-simulator-build/);
    assert.doesNotMatch(workflow, /secrets\./);
    assert.match(simulatorBuild, /RAILCOMMAND_APP_BUNDLE_IDENTIFIER=/);
    assert.doesNotMatch(simulatorBuild, /`PRODUCT_BUNDLE_IDENTIFIER=/);
    assert.match(xcodeProject, /PRODUCT_BUNDLE_IDENTIFIER = "\$\(RAILCOMMAND_APP_BUNDLE_IDENTIFIER\)"/);
  });
});
