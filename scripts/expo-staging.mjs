import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { delimiter } from 'node:path';
import { validateMobileEnvironment } from './mobile-environment-guard.mjs';

const validated = validateMobileEnvironment(process.env);
if (validated.profile !== 'development') {
  throw new Error('Physical Expo acceptance must use the development application profile');
}

const expoEnvironment = {
  ...process.env,
  NODE_PATH: [
    process.env.NODE_PATH,
    fileURLToPath(new URL('../apps/mobile/node_modules', import.meta.url)),
  ]
    .filter(Boolean)
    .join(delimiter),
  EXPO_PUBLIC_BUILD_PROFILE: validated.profile,
  EXPO_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_APP_URL,
  EXPO_PUBLIC_EXPECTED_SUPABASE_PROJECT_REF: process.env.MOBILE_EXPECTED_SUPABASE_PROJECT_REF,
  EXPO_PUBLIC_EXPECTED_API_HOST: process.env.MOBILE_EXPECTED_APP_HOST,
  EXPO_PUBLIC_BLOCKED_SUPABASE_PROJECT_REFS: process.env.MOBILE_BLOCKED_SUPABASE_PROJECT_REFS,
  EXPO_PUBLIC_BLOCKED_API_HOSTS: process.env.MOBILE_BLOCKED_APP_HOSTS,
};

const mobileRoot = fileURLToPath(new URL('../apps/mobile/', import.meta.url));
const [action, argument] = process.argv.slice(2);
const isDeviceAction = action === 'run-ios' || action === 'build-ios-release';
if (isDeviceAction && !/^[0-9A-F-]{20,40}$/i.test(argument ?? '')) {
  throw new Error(`${action} requires an Apple device UDID`);
}

const commands = {
  config: ['npx', ['expo', 'config', '--type', 'public']],
  'prebuild-ios': ['npx', ['expo', 'prebuild', '--platform', 'ios', '--clean']],
  'prebuild-android': ['npx', ['expo', 'prebuild', '--platform', 'android', '--clean']],
  'run-ios': ['npx', ['expo', 'run:ios', '--device', argument, '--no-bundler']],
  start: ['npx', ['expo', 'start', '--dev-client', '--lan']],
  'build-ios-release': ['xcodebuild', [
    '-workspace', `${mobileRoot}ios/RailCommandDevelopment.xcworkspace`,
    '-scheme', 'RailCommandDevelopment',
    '-configuration', 'Release',
    '-destination', `id=${argument}`,
    '-derivedDataPath', '/private/tmp/railcommand-expo-phase3-release',
    '-allowProvisioningUpdates',
    'build',
  ]],
  'build-android-debug': ['./android/gradlew', ['-p', 'android', 'app:testDebugUnitTest', 'app:assembleDebug']],
};

const command = commands[action];
if (!command) {
  throw new Error('Use config, prebuild-ios, prebuild-android, run-ios <device-id>, build-ios-release <device-udid>, build-android-debug, or start');
}

const result = spawnSync(command[0], command[1], {
  cwd: mobileRoot,
  env: expoEnvironment,
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
