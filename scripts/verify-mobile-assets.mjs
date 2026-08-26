import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const expoConfig = readFileSync(
  new URL('../apps/mobile/app.config.ts', import.meta.url),
  'utf8',
);
assert.doesNotMatch(expoConfig, /server\s*:/, 'Expo must bundle its application and never use a remote server.url');
assert.match(expoConfig, /io\.railcommand\.app\.dev/, 'Development app identifier is missing');
assert.match(expoConfig, /io\.railcommand\.app\.staging/, 'Staging app identifier is missing');
assert.match(expoConfig, /io\.railcommand\.app['"]/, 'Production app identifier is missing');

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

assert.match(expoConfig, /ACCESS_BACKGROUND_LOCATION/, 'Background location must be explicitly blocked');
assert.match(expoConfig, /RECORD_AUDIO/, 'Microphone access must be explicitly blocked');
assert.match(expoConfig, /SYSTEM_ALERT_WINDOW/, 'Release overlay access must be explicitly blocked');
assert.match(expoConfig, /CoarseLocation/, 'Approximate-location collection must be declared');
assert.match(expoConfig, /with-foreground-location-only/, 'Foreground-only iOS location cleanup is missing');

console.log('Expo icon, splash, application identifiers, and bundled-runtime boundary are complete.');
