import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'mocha';

function source(path: string) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

function asset(path: string) {
  return fileURLToPath(new URL(path, import.meta.url));
}

describe('Phase 5 RailCommand visual foundation', () => {
  it('uses the authoritative RailCommand command-shell colors', () => {
    const theme = source('../theme/index.ts');
    assert.match(theme, /ink: '#0F172A'/);
    assert.match(theme, /orange: '#F97316'/);
    assert.match(theme, /cream: '#F3F3EE'/);
    assert.match(theme, /paper: '#FBFBF8'/);
  });

  it('bundles cross-platform TTF typography instead of loading UI fonts from the network', () => {
    for (const file of [
      '../../assets/fonts/DMSans_400Regular.ttf',
      '../../assets/fonts/DMSans_500Medium.ttf',
      '../../assets/fonts/DMSans_700Bold.ttf',
      '../../assets/fonts/PlusJakartaSans_700Bold.ttf',
      '../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf',
      '../../assets/fonts/JetBrainsMono_600SemiBold.ttf',
    ]) assert.equal(existsSync(asset(file)), true, `${file} must remain bundled`);

    const layout = source('../app/_layout.tsx');
    assert.match(layout, /useFonts/);
    assert.doesNotMatch(layout, /https?:\/\//);
  });

  it('uses the real RailCommand mark and accessible connectivity/navigation labels', () => {
    const ui = source('../components/ui.tsx');
    const tabs = source('../app/(tabs)/_layout.tsx');
    assert.match(ui, /assets\/images\/icon\.png/);
    assert.match(ui, /accessibilityLabel=\{`Connectivity:/);
    assert.match(tabs, /tabBarAccessibilityLabel: 'Daily logs'/);
    assert.match(tabs, /tabBarAccessibilityLabel: 'Sync Center'/);
  });

  it('keeps browser visual QA memory-only while native auth remains in Keychain or Keystore', () => {
    const auth = source('./supabase.ts');
    const layout = source('../app/_layout.tsx');
    assert.match(auth, /Platform\.OS === 'web' \? previewStorage : nativeSecureStorage/);
    assert.doesNotMatch(auth, /localStorage|sessionStorage/);
    assert.match(layout, /if \(Platform\.OS === 'web'\) return/);
  });
});
