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
  const [red, green, blue] = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(first: string, second: string) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

describe('RailCommand web-to-native visual foundation', () => {
  it('uses the authoritative command-shell colors at accessible contrast', () => {
    const theme = source('../theme/index.ts');
    assert.match(theme, /ink: '#0F172A'/);
    assert.match(theme, /orange: '#F97316'/);
    assert.match(theme, /cream: '#F3F3EE'/);
    assert.match(theme, /paper: '#FBFBF8'/);
    assert.ok(contrast('0F172A', 'F97316') >= 4.5);
    assert.ok(contrast('9A3412', 'F3F3EE') >= 4.5);
    assert.ok(contrast('5F6672', 'FBFBF8') >= 4.5);
  });

  it('bundles the matching web typography and RailCommand mark', () => {
    for (const file of [
      '../../assets/fonts/DMSans_400Regular.ttf',
      '../../assets/fonts/DMSans_500Medium.ttf',
      '../../assets/fonts/DMSans_700Bold.ttf',
      '../../assets/fonts/PlusJakartaSans_700Bold.ttf',
      '../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf',
      '../../assets/fonts/JetBrainsMono_600SemiBold.ttf',
      '../../assets/images/icon.png',
    ]) assert.equal(existsSync(asset(file)), true, `${file} must remain bundled`);
    assert.match(source('../app/_layout.tsx'), /useFonts/);
    assert.match(source('../components/web-shell.tsx'), /assets\/images\/icon\.png/);
  });

  it('matches the attached sign-in hierarchy with working pricing and demo links', () => {
    const signIn = source('../app/sign-in.tsx');
    assert.match(signIn, /SECURE PROJECT ACCESS/);
    assert.match(signIn, /Welcome back/);
    assert.match(signIn, /SEE PRICING/);
    assert.match(signIn, /Explore Demo Project/);
    assert.match(signIn, /Email address/);
    assert.match(signIn, /Forgot password/);
    assert.match(signIn, /Linking\.openURL/);
  });

  it('matches the web mobile tab order and opens the same nine-item More sheet', () => {
    const tabs = source('../app/(tabs)/_layout.tsx');
    const more = source('../app/more.tsx');
    assert.ok(tabs.indexOf('name="index"') < tabs.indexOf('name="submittals"'));
    assert.ok(tabs.indexOf('name="submittals"') < tabs.indexOf('name="rfis"'));
    assert.ok(tabs.indexOf('name="rfis"') < tabs.indexOf('name="logs"'));
    assert.ok(tabs.indexOf('name="logs"') < tabs.indexOf('name="more"'));
    for (const label of ['Punch List', 'Safety', 'QC/QA', 'Documents', 'Cameras', 'Photos', 'Reports', 'Schedule', 'Team']) {
      assert.match(more, new RegExp(`label: '${label.replace('/', '\\/')}'`));
    }
    assert.match(more, /badge: 'Beta'/);
    assert.match(more, /presentation: 'transparentModal'|backgroundColor: 'rgba/);
  });

  it('matches the attached Submittals and RFI filter/search/action screens', () => {
    const shell = source('../components/web-shell.tsx');
    const submittals = source('../app/(tabs)/submittals.tsx');
    const rfis = source('../app/(tabs)/rfis.tsx');
    assert.match(shell, /headingTitle: \{[^}]*fontSize: 24/);
    assert.match(shell, /filterTab: \{[^}]*flexGrow: 1, flexShrink: 0/);
    assert.match(submittals, /Export PDF/);
    assert.match(submittals, /New Submittal/);
    assert.match(submittals, /Under Review/);
    assert.match(submittals, /Search by title or number/);
    assert.match(submittals, /showing saved submittals/);
    assert.match(rfis, /Export PDF/);
    assert.match(rfis, /New RFI/);
    assert.match(rfis, /Overdue/);
    assert.match(rfis, /Search RFIs/);
    assert.match(rfis, /showing saved RFIs/);
  });

  it('matches the attached Daily Logs calendar/list controls while preserving device drafts', () => {
    const logs = source('../app/(tabs)/logs.tsx');
    assert.match(logs, /New Log/);
    assert.match(logs, /Calendar/);
    assert.match(logs, /List/);
    assert.match(logs, /Previous month/);
    assert.match(logs, /Next month/);
    assert.match(logs, /Today/);
    assert.match(logs, /router\.push\('\/daily-log\/new'\)/);
    assert.match(logs, /durable device drafts/);
  });

  it('uses real cached dashboard values and web-style quick actions', () => {
    const dashboard = source('../app/(tabs)/index.tsx');
    for (const label of ['BUDGET', 'SCHEDULE', 'SUBMITTALS', 'OPEN RFIS', 'PUNCH LIST', 'DAILY LOGS']) {
      assert.match(dashboard, new RegExp(`label="${label}"`));
    }
    assert.match(dashboard, /dashboard\?\.submittalsTotal/);
    assert.match(dashboard, /dashboard\?\.openRfis/);
    assert.match(dashboard, /New Daily Log/);
    assert.match(dashboard, /New RFI/);
    assert.match(dashboard, /New Submittal/);
    assert.match(dashboard, /New Punch Item/);
    assert.match(dashboard, /Milestones/);
  });

  it('adds a project-authorized EarthCam workspace with a strict navigation allowlist', () => {
    const cameras = source('../app/(tabs)/cameras.tsx');
    const more = source('../app/more.tsx');
    const bootstrap = source('../../../../src/app/api/mobile/v1/bootstrap/route.ts');
    const saveRoute = source('../../../../src/app/api/mobile/v1/earthcam/embeds/route.ts');
    const deleteRoute = source('../../../../src/app/api/mobile/v1/earthcam/embeds/delete/route.ts');
    assert.match(cameras, /Live EarthCam feeds stream from EarthCam/);
    assert.match(cameras, /url\.protocol === 'https:' && url\.hostname === 'share\.earthcam\.net'/);
    assert.match(cameras, /originWhitelist=\{\['https:\/\/share\.earthcam\.net\/\*'\]\}/);
    assert.match(cameras, /sharedCookiesEnabled=\{false\}/);
    assert.match(cameras, /thirdPartyCookiesEnabled=\{false\}/);
    assert.match(cameras, /Live feed unavailable while offline/);
    assert.match(cameras, /Add EarthCam Feed/);
    assert.match(cameras, /Edit \$\{embed\.label\}/);
    assert.match(cameras, /Remove \$\{embed\.label\}/);
    assert.match(cameras, /Your entered label and EarthCam link remain here/);
    assert.match(cameras, /mobileApi\.saveEarthCamEmbed/);
    assert.match(cameras, /mobileApi\.deleteEarthCamEmbed/);
    assert.match(more, /native: '\/\(tabs\)\/cameras'/);
    assert.match(source('../app/(tabs)/_layout.tsx'), /name="cameras" options=\{\{ href: null \}\}/);
    assert.match(bootstrap, /authenticateMobileRequest\(request\)/);
    assert.match(bootstrap, /\.from\('earthcam_embeds'\)/);
    assert.match(bootstrap, /url\.protocol !== 'https:' \|\| url\.hostname !== 'share\.earthcam\.net'/);
    assert.match(bootstrap, /canManageEarthCam/);
    assert.match(saveRoute, /authenticateMobileRequest\(request\)/);
    assert.match(saveRoute, /canManageMobileEarthCam/);
    assert.ok(saveRoute.indexOf('canManageMobileEarthCam') < saveRoute.indexOf('createAdminClient()'));
    assert.match(saveRoute, /\.from\('earthcam_embeds'\)/);
    assert.match(deleteRoute, /canManageMobileEarthCam/);
    assert.ok(deleteRoute.indexOf('canManageMobileEarthCam') < deleteRoute.indexOf('createAdminClient()'));
    assert.match(deleteRoute, /\.delete\(\)/);
  });

  it('opens web-style project module links without an unmatched route', () => {
    const bridge = source('../app/projects/[id]/[...module].tsx');
    assert.match(bridge, /nativeProjectSections/);
    assert.match(bridge, /cameras: '\/\(tabs\)\/cameras'/);
    assert.match(bridge, /router\.replace\(destination as never\)/);
  });

  it('keeps interactive targets at least 48 points and protects background content', () => {
    const ui = source('../components/ui.tsx');
    const webShell = source('../components/web-shell.tsx');
    const tabs = source('../app/(tabs)/_layout.tsx');
    const shield = source('../components/privacy-shield.tsx');
    assert.match(ui, /button: \{[\s\S]*?minHeight: 52/);
    assert.match(ui, /secondary: \{[\s\S]*?minHeight: 48/);
    assert.match(webShell, /actionButton: \{ minHeight: 48/);
    assert.doesNotMatch(webShell, />9\+<|notificationBadge/);
    assert.match(tabs, /item: \{ minHeight: 56 \}/);
    assert.match(shield, /setConcealed\(state !== 'active'\)/);
    assert.match(shield, /importantForAccessibility="no-hide-descendants"/);
  });

  it('keeps browser QA memory-only and native auth in Keychain or Keystore', () => {
    const auth = source('./supabase.ts');
    assert.match(auth, /Platform\.OS === 'web' \? previewStorage : nativeSecureStorage/);
    assert.doesNotMatch(auth, /localStorage|sessionStorage/);
    assert.match(auth, /expo-secure-store/);
  });
});
