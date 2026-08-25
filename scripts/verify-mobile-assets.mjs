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

expectPng('apps/mobile/assets/images/icon.png', 512, 512);
expectPng('apps/mobile/assets/images/android-icon-foreground.png', 512, 512);
expectPng('apps/mobile/assets/images/android-icon-background.png', 512, 512);
expectPng('apps/mobile/assets/images/android-icon-monochrome.png', 432, 432);
expectPng('apps/mobile/assets/images/splash-icon.png', 2732, 2732);

console.log('Expo icon, splash, application identifiers, and bundled-runtime boundary are complete.');
