import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { buildAndroidInputCommands, centerOfBounds } from './android-emulator-input.mjs';
import { validateMobileEnvironment } from './mobile-environment-guard.mjs';

const validated = validateMobileEnvironment(process.env);
if (validated.profile === 'production') {
  throw new Error('Android reviewer sign-in helper never runs against production');
}

const serial = process.argv[2]?.trim();
if (!/^emulator-\d+$/.test(serial ?? '')) {
  throw new Error('Provide a local Android emulator serial such as emulator-5554');
}
const androidHome = process.env.ANDROID_HOME?.trim();
if (!androidHome) throw new Error('ANDROID_HOME is required');
const email = process.env.STORE_REVIEWER_EMAIL?.trim()
  || process.env.ACCOUNT_DELETION_QA_EMAIL?.trim();
const password = process.env.STORE_REVIEWER_PASSWORD
  || process.env.ACCOUNT_DELETION_QA_PASSWORD;
if (!email || !password) throw new Error('Synthetic reviewer credentials are required');
if (!email.endsWith('@railcommand.io')) {
  throw new Error('Reviewer helper accepts only a controlled RailCommand staging inbox');
}

// Build every command before interacting so unsupported input fails without a partial credential.
const emailCommands = buildAndroidInputCommands(email);
const passwordCommands = buildAndroidInputCommands(password);
const adb = join(androidHome, 'platform-tools', 'adb');

function run(args, { capture = false } = {}) {
  const result = spawnSync(adb, ['-s', serial, ...args], {
    encoding: capture ? 'utf8' : undefined,
    stdio: capture ? 'pipe' : 'ignore',
  });
  if (result.status !== 0) throw new Error('Android emulator command failed');
  return capture ? result.stdout : '';
}

function dumpHierarchy() {
  return run(['exec-out', 'uiautomator', 'dump', '/dev/tty'], { capture: true });
}

function boundsFor(xml, pattern) {
  const match = xml.match(pattern);
  if (!match) throw new Error('Required Android sign-in control was not found');
  return centerOfBounds(match[1]);
}

function enter(commands) {
  for (const command of commands) run(['shell', 'input', ...command]);
}

run(['shell', 'am', 'force-stop', validated.appId]);
run(['shell', 'am', 'start', '-n', `${validated.appId}/.MainActivity`]);
await delay(1_000);
const hierarchy = dumpHierarchy();
const editBounds = [...hierarchy.matchAll(/class="android\.widget\.EditText"[^>]*bounds="([^"]+)"/g)]
  .map((match) => centerOfBounds(match[1]));
if (editBounds.length !== 2) throw new Error('Expected exactly two Android sign-in fields');
const signIn = boundsFor(
  hierarchy,
  /class="android\.widget\.Button"[^>]*content-desc="Sign in"[^>]*bounds="([^"]+)"/,
);

run(['shell', 'input', 'tap', ...editBounds[0].map(String)]);
enter(emailCommands);
run(['shell', 'input', 'tap', ...editBounds[1].map(String)]);
enter(passwordCommands);
run(['shell', 'input', 'tap', ...signIn.map(String)]);

let signedIn = false;
for (let attempt = 0; attempt < 10; attempt += 1) {
  await delay(2_000);
  const current = dumpHierarchy();
  signedIn = !current.includes('class="android.widget.EditText"')
    && /ACTIVE PROJECT|Field synchronization|Project Control|Overview/.test(current);
  if (signedIn) break;
}
if (!signedIn) throw new Error('Synthetic reviewer did not reach the project dashboard');

console.log(JSON.stringify({
  appId: validated.appId,
  profile: validated.profile,
  emulator: serial,
  signedIn: true,
}, null, 2));
