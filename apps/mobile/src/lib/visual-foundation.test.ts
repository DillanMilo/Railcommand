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

function relativeLuminance(hex: string) {
  const channels = hex.match(/../g)?.map((value) => Number.parseInt(value, 16) / 255) ?? [];
  const [red, green, blue] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

describe('Phase 5 RailCommand visual foundation', () => {
  it('uses the authoritative RailCommand command-shell colors', () => {
    const theme = source('../theme/index.ts');
    assert.match(theme, /ink: '#0F172A'/);
    assert.match(theme, /orange: '#F97316'/);
    assert.match(theme, /cream: '#F3F3EE'/);
    assert.match(theme, /paper: '#FBFBF8'/);
  });

  it('keeps brand text, controls, and normal copy above their contrast thresholds', () => {
    const theme = source('../theme/index.ts');
    assert.match(theme, /orangeText: '#9A3412'/);
    assert.match(theme, /muted: '#5F6672'/);
    assert.match(theme, /controlLine: '#7C8490'/);
    assert.ok(contrast('0F172A', 'F97316') >= 4.5);
    assert.ok(contrast('9A3412', 'F3F3EE') >= 4.5);
    assert.ok(contrast('5F6672', 'FBFBF8') >= 4.5);
    assert.ok(contrast('FFFFFF', 'DC2626') >= 4.5);
    assert.ok(contrast('7C8490', 'FFFFFF') >= 3);
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

  it('caps decorative brand typography while leaving field content available to Dynamic Type', () => {
    const ui = source('../components/ui.tsx');
    assert.match(ui, /maxFontSizeMultiplier=\{1\.5\}[^>]*style=\{styles\.eyebrow\}/s);
    assert.match(ui, /maxFontSizeMultiplier=\{1\.4\}[^>]*numberOfLines=\{2\}[^>]*style=\{styles\.title\}/s);
    assert.doesNotMatch(ui, /<TextInput[^>]*allowFontScaling=\{false\}/s);
  });

  it('keeps interactive targets at least 48 points and adds no custom motion dependency', () => {
    const ui = source('../components/ui.tsx');
    const tabs = source('../app/(tabs)/_layout.tsx');
    const mobileSources = `${ui}\n${tabs}\n${source('../app/_layout.tsx')}`;
    assert.match(ui, /button: \{[\s\S]*?minHeight: 52/);
    assert.match(ui, /secondary: \{[\s\S]*?minHeight: 48/);
    assert.match(ui, /input: \{[\s\S]*?minHeight: 50/);
    assert.match(tabs, /item: \{ minHeight: 54 \}/);
    assert.doesNotMatch(mobileSources, /Animated|withTiming|withSpring|react-native-reanimated/);
  });

  it('conceals field content whenever the native app is inactive or backgrounded', () => {
    const shield = source('../components/privacy-shield.tsx');
    const layout = source('../app/_layout.tsx');
    assert.match(shield, /AppState\.addEventListener\('change'/);
    assert.match(shield, /setConcealed\(state !== 'active'\)/);
    assert.match(shield, /position: 'absolute'/);
    assert.match(shield, /inset: 0/);
    assert.match(shield, /importantForAccessibility="no-hide-descendants"/);
    assert.match(layout, /<PrivacyShield \/>/);
  });

  it('keeps browser visual QA memory-only while native auth remains in Keychain or Keystore', () => {
    const auth = source('./supabase.ts');
    const layout = source('../app/_layout.tsx');
    assert.match(auth, /Platform\.OS === 'web' \? previewStorage : nativeSecureStorage/);
    assert.doesNotMatch(auth, /localStorage|sessionStorage/);
    assert.match(layout, /if \(Platform\.OS === 'web'\) return/);
  });
});
