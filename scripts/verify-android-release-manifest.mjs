import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve(
  process.argv[2]
    ?? 'apps/mobile/android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml',
);
const bundlePath = resolve(
  process.argv[3]
    ?? 'apps/mobile/android/app/build/outputs/bundle/release/app-release.aab',
);

assert.ok(existsSync(manifestPath), `Release manifest not found: ${manifestPath}`);
assert.ok(existsSync(bundlePath), `Release AAB not found: ${bundlePath}`);

const manifest = readFileSync(manifestPath, 'utf8');

const requiredFragments = [
  'package="io.railcommand.app"',
  'android:versionCode="300001"',
  'android:versionName="1.0.0"',
  'android:minSdkVersion="24"',
  'android:targetSdkVersion="36"',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.CAMERA',
  'android.permission.INTERNET',
  'android.permission.POST_NOTIFICATIONS',
  'android:scheme="railcommand"',
  'android:host="railcommand.io"',
  'android:autoVerify="true"',
];

for (const fragment of requiredFragments) {
  assert.ok(manifest.includes(fragment), `Release manifest is missing: ${fragment}`);
}

const forbiddenFragments = [
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.RECORD_AUDIO',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.MANAGE_EXTERNAL_STORAGE',
  'com.google.android.gms.permission.AD_ID',
  'android:scheme="exp+railcommand"',
  'expo.modules.devlauncher',
  'expo.modules.devmenu',
];

for (const fragment of forbiddenFragments) {
  assert.ok(!manifest.includes(fragment), `Release manifest contains forbidden surface: ${fragment}`);
}

const bundleBytes = statSync(bundlePath).size;
assert.ok(bundleBytes > 0, 'Release AAB is empty');

console.log(JSON.stringify({
  manifest: manifestPath,
  bundle: bundlePath,
  bundleBytes,
  applicationId: 'io.railcommand.app',
  versionName: '1.0.0',
  versionCode: 300001,
  minSdk: 24,
  targetSdk: 36,
  forbiddenSurfaceAbsent: true,
}, null, 2));
