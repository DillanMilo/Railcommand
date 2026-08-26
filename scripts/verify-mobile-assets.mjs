import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { readImageDimensions } from './store-media.mjs';

const expoConfig = readFileSync(
  new URL('../apps/mobile/app.config.ts', import.meta.url),
  'utf8',
);
assert.doesNotMatch(expoConfig, /server\s*:/, 'Expo must bundle its application and never use a remote server.url');
assert.match(expoConfig, /io\.railcommand\.app\.dev/, 'Development app identifier is missing');
assert.match(expoConfig, /io\.railcommand\.app\.staging/, 'Staging app identifier is missing');
assert.match(expoConfig, /io\.railcommand\.app['"]/, 'Production app identifier is missing');
assert.match(expoConfig, /version:\s*['"]1\.0\.0['"]/, 'Store marketing version must be 1.0.0');

const mobilePackage = JSON.parse(readFileSync(
  new URL('../apps/mobile/package.json', import.meta.url),
  'utf8',
));
assert.equal(mobilePackage.version, '1.0.0', 'Mobile package and store marketing versions must agree');

function pngDimensions(path) {
  const bytes = readFileSync(new URL(`../${path}`, import.meta.url));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${path} must be a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function expectPng(path, width, height) {
  assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is missing`);
  assert.deepEqual(pngDimensions(path), { width, height }, `${path} has the wrong dimensions`);
}

expectPng('apps/mobile/assets/images/icon-store-1024.png', 1024, 1024);
expectPng('apps/mobile/assets/images/android-icon-background.png', 512, 512);
expectPng('apps/mobile/assets/images/google-play-icon-512.png', 512, 512);

const featureGraphic = new URL(
  '../apps/mobile/assets/images/google-play-feature-1024x500.jpg',
  import.meta.url,
);
assert.ok(existsSync(featureGraphic), 'Google Play feature graphic is missing');
assert.deepEqual(
  readImageDimensions(featureGraphic),
  { format: 'jpg', width: 1024, height: 500, hasAlpha: false },
  'Google Play feature graphic must be a 1024 × 500 JPEG without alpha',
);
assert.ok(statSync(featureGraphic).size <= 15 * 1024 * 1024, 'Google Play feature graphic exceeds 15 MB');

assert.match(expoConfig, /ACCESS_BACKGROUND_LOCATION/, 'Background location must be explicitly blocked');
assert.match(expoConfig, /RECORD_AUDIO/, 'Microphone access must be explicitly blocked');
assert.match(expoConfig, /SYSTEM_ALERT_WINDOW/, 'Release overlay access must be explicitly blocked');
assert.match(expoConfig, /CoarseLocation/, 'Approximate-location collection must be declared');
assert.match(expoConfig, /with-foreground-location-only/, 'Foreground-only iOS location cleanup is missing');

console.log('Expo icon, splash, application identifiers, and bundled-runtime boundary are complete.');
