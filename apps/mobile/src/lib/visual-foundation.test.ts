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
    assert.match(tabs, /tabBarAccessibilityLabel: 'Dashboard'/);
    assert.match(tabs, /tabBarAccessibilityLabel: 'Submittals'/);
    assert.match(tabs, /tabBarAccessibilityLabel: 'RFIs'/);
    assert.match(tabs, /tabBarAccessibilityLabel: 'Daily logs'/);
    assert.match(tabs, /tabBarAccessibilityLabel: 'More RailCommand modules'/);
  });

  it('matches the web navigation hierarchy without exposing incomplete record controls', () => {
    const tabs = source('../app/(tabs)/_layout.tsx');
    const submittals = source('../app/(tabs)/submittals.tsx');
    const rfis = source('../app/(tabs)/rfis.tsx');
    const more = source('../app/(tabs)/more.tsx');
    assert.ok(tabs.indexOf('name="index"') < tabs.indexOf('name="submittals"'));
    assert.ok(tabs.indexOf('name="submittals"') < tabs.indexOf('name="rfis"'));
    assert.ok(tabs.indexOf('name="rfis"') < tabs.indexOf('name="logs"'));
    assert.ok(tabs.indexOf('name="logs"') < tabs.indexOf('name="more"'));
    assert.match(tabs, /name="sync" options=\{\{ href: null \}\}/);
    assert.match(tabs, /name="account" options=\{\{ href: null \}\}/);
    assert.match(submittals, /Online-only in this Release/);
    assert.match(submittals, /without presenting a dead or incomplete record control/);
    assert.match(rfis, /Online-only in this Release/);
    assert.match(rfis, /without claiming that native RFI records are available/);
    assert.doesNotMatch(`${submittals}\n${rfis}`, /<Pressable|<PrimaryButton|<SecondaryButton/);
    assert.match(more, /href="\/\(tabs\)\/sync"/);
    assert.match(more, /href="\/team"/);
    assert.match(more, /href="\/\(tabs\)\/account"/);
    assert.match(more, /The field app does not claim full offline project work/);
  });

  it('carries the web command-shell hierarchy into native sign-in and dashboard screens', () => {
    const signIn = source('../app/sign-in.tsx');
    const dashboard = source('../app/(tabs)/index.tsx');
    const tabs = source('../app/(tabs)/_layout.tsx');
    assert.match(signIn, /SECURE PROJECT ACCESS/);
    assert.match(signIn, /Welcome back/);
    assert.match(signIn, /Sign in to continue to your projects/);
    assert.match(dashboard, /PROJECT CONTROL \/ LIVE OVERVIEW/);
    assert.match(dashboard, /label="BUDGET"/);
    assert.match(dashboard, /label="SCHEDULE"/);
    assert.match(dashboard, /label="SUBMITTALS"/);
    assert.match(dashboard, /label="OPEN RFIS"/);
    assert.match(dashboard, /label="PUNCH LIST"/);
    assert.match(dashboard, /label="DAILY LOGS"/);
    assert.match(dashboard, /Online-only in this field release/);
    assert.match(tabs, /title: 'Dashboard'/);
  });

  it('matches the measured web phone and tablet shell proportions', () => {
    const ui = source('../components/ui.tsx');
    const dashboard = source('../app/(tabs)/index.tsx');
    const tabs = source('../app/(tabs)/_layout.tsx');
    assert.match(ui, /header: \{[\s\S]*?minHeight: 66/);
    assert.match(ui, /projectControl: \{[\s\S]*?minHeight: 36/);
    assert.match(ui, /breadcrumbRoot/);
    assert.match(ui, /metricTile: \{[\s\S]*?width: '48%'[\s\S]*?minHeight: 148/);
    assert.match(dashboard, /metrics: \{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 \}/);
    assert.match(tabs, /bar: \{ minHeight: 64/);
  });

  it('reuses the web-style hierarchy across every implemented field workflow', () => {
    const ui = source('../components/ui.tsx');
    const logs = source('../app/(tabs)/logs.tsx');
    const sync = source('../app/(tabs)/sync.tsx');
    const account = source('../app/(tabs)/account.tsx');
    const draft = source('../app/daily-log/new.tsx');
    const detail = source('../app/daily-log/[id].tsx');
    const team = source('../app/team.tsx');
    assert.match(ui, /export function PageHeading/);
    assert.match(ui, /export function StatusBanner/);
    assert.match(ui, /export function MetricTile/);
    assert.match(logs, /FIELD RECORDS \/ DAILY LOGS/);
    assert.match(sync, /DEVICE OUTBOX \/ FIELD SYNCHRONIZATION/);
    assert.match(account, /SETTINGS \/ PROFILE & PRIVACY/);
    assert.match(draft, /FIELD RECORD \/ DAILY LOG/);
    assert.match(detail, /FIELD RECORD \/ DAILY LOG/);
    assert.match(team, /PROJECT ACCESS \/ TEAM/);
  });

  it('caps decorative brand typography while leaving field content available to Dynamic Type', () => {
    const ui = source('../components/ui.tsx');
    assert.match(ui, /maxFontSizeMultiplier=\{1\.5\}[^>]*style=\{styles\.eyebrow\}/s);
    assert.match(ui, /maxFontSizeMultiplier=\{1\.4\}[^>]*numberOfLines=\{1\}[^>]*style=\{styles\.title\}/s);
    assert.doesNotMatch(ui, /<TextInput[^>]*allowFontScaling=\{false\}/s);
  });

  it('keeps interactive targets at least 48 points and adds no custom motion dependency', () => {
    const ui = source('../components/ui.tsx');
    const tabs = source('../app/(tabs)/_layout.tsx');
    const mobileSources = `${ui}\n${tabs}\n${source('../app/_layout.tsx')}`;
    assert.match(ui, /button: \{[\s\S]*?minHeight: 52/);
    assert.match(ui, /secondary: \{[\s\S]*?minHeight: 48/);
    assert.match(ui, /input: \{[\s\S]*?minHeight: 50/);
    assert.match(tabs, /item: \{ minHeight: 56 \}/);
    assert.doesNotMatch(mobileSources, /Animated|withTiming|withSpring|react-native-reanimated/);
  });

  it('gives dashboard links and cached-log rows explicit spoken navigation semantics', () => {
    const overview = source('../app/(tabs)/index.tsx');
    const logs = source('../app/(tabs)/logs.tsx');
    assert.match(overview, /accessibilityRole="link" accessibilityLabel=\{`Project team/);
    assert.match(overview, /accessibilityRole="link" accessibilityLabel="Sync Center, review device work"/);
    assert.match(logs, /accessibilityRole="button"/);
    assert.match(logs, /accessibilityLabel=\{`Daily log,/);
    assert.match(logs, /accessibilityHint="Opens the cached daily log"/);
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
