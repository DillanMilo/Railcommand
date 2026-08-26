import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { delimiter, join } from 'node:path';
import { validateMobileEnvironment } from './mobile-environment-guard.mjs';

const validated = validateMobileEnvironment(process.env);
const [action, argument] = process.argv.slice(2);
const physicalDeviceActions = new Set(['run-ios', 'build-ios-release']);
if (validated.profile === 'production') {
  throw new Error('This staging helper never runs production mobile builds');
}
if (physicalDeviceActions.has(action) && validated.profile !== 'development') {
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
const simulatorActions = new Set(['build-ios-simulator', 'run-ios-simulator']);
const isDeviceAction = physicalDeviceActions.has(action) || simulatorActions.has(action);
if (isDeviceAction && !/^[0-9A-F-]{20,40}$/i.test(argument ?? '')) {
  throw new Error(`${action} requires an Apple device UDID`);
}

const nativeTarget = {
  development: 'RailCommandDevelopment',
  staging: 'RailCommandStaging',
}[validated.profile];
const simulatorDerivedData = `/private/tmp/railcommand-expo-${validated.profile}-simulator`;
const simulatorApp = `${simulatorDerivedData}/Build/Products/Release-iphonesimulator/${nativeTarget}.app`;
const androidReleaseApk = `${mobileRoot}android/app/build/outputs/apk/release/app-release.apk`;
const androidHome = process.env.ANDROID_HOME?.trim();
if (action === 'run-android-emulator' && !androidHome) {
  throw new Error('run-android-emulator requires ANDROID_HOME');
}
const adb = androidHome ? join(androidHome, 'platform-tools', 'adb') : 'adb';
const simulatorBuildArguments = [
  '-workspace', `${mobileRoot}ios/${nativeTarget}.xcworkspace`,
  '-scheme', nativeTarget,
  '-configuration', 'Release',
  '-sdk', 'iphonesimulator',
  '-destination', `id=${argument}`,
  '-derivedDataPath', simulatorDerivedData,
  '-quiet',
  'ONLY_ACTIVE_ARCH=YES',
  'ARCHS=arm64',
];
const unsignedSimulatorBuild = ['xcodebuild', [
  ...simulatorBuildArguments,
  'CODE_SIGNING_ALLOWED=NO',
  'build',
]];
const runnableSimulatorBuild = ['xcodebuild', [
  ...simulatorBuildArguments,
  'CODE_SIGNING_ALLOWED=YES',
  'CODE_SIGNING_REQUIRED=NO',
  'build',
]];

const commands = {
  config: ['npx', ['expo', 'config', '--type', 'public']],
  'prebuild-ios': ['npx', ['expo', 'prebuild', '--platform', 'ios', '--clean']],
  'prebuild-android': ['npx', ['expo', 'prebuild', '--platform', 'android', '--clean']],
  'run-ios': ['npx', ['expo', 'run:ios', '--device', argument, '--no-bundler']],
  'build-ios-simulator': unsignedSimulatorBuild,
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
  'build-android-release': ['./android/gradlew', ['-p', 'android', 'app:testReleaseUnitTest', 'app:assembleRelease']],
};

if (action === 'build-android-release' || action === 'run-android-emulator') {
  // Gradle does not treat EXPO_PUBLIC_* values as bundle task inputs. Remove only
  // generated JS outputs so a profile switch cannot reuse a bundle from another environment.
  rmSync(`${mobileRoot}android/app/build/generated/assets/react/release`, { recursive: true, force: true });
  rmSync(`${mobileRoot}android/app/build/generated/sourcemaps/react/release`, { recursive: true, force: true });
}

const command = commands[action];
const commandSequence = action === 'run-ios-simulator'
  ? [
      runnableSimulatorBuild,
      ['xcrun', ['simctl', 'install', argument, simulatorApp]],
      ['xcrun', ['simctl', 'launch', argument, validated.appId]],
    ]
  : action === 'run-android-emulator'
    ? [
        commands['build-android-release'],
        [adb, ['install', '-r', androidReleaseApk]],
        [adb, ['shell', 'am', 'force-stop', validated.appId]],
        [adb, ['shell', 'am', 'start', '-n', `${validated.appId}/.MainActivity`]],
      ]
  : command
    ? [command]
    : null;
if (!commandSequence) {
  throw new Error('Use config, prebuild-ios, prebuild-android, run-ios <device-id>, build-ios-simulator <simulator-udid>, run-ios-simulator <simulator-udid>, build-ios-release <device-udid>, build-android-debug, build-android-release, run-android-emulator, or start');
}

for (const step of commandSequence) {
  const result = spawnSync(step[0], step[1], {
    cwd: mobileRoot,
    env: expoEnvironment,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}
