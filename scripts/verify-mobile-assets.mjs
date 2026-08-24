import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const capacitorConfig = readFileSync(
  new URL('../apps/mobile/capacitor.config.ts', import.meta.url),
  'utf8',
);
assert.match(
  capacitorConfig,
  /loggingBehavior:\s*'none'/,
  'Capacitor bridge logging must stay disabled so secure-storage payloads never enter native logs',
);

function pngDimensions(path) {
  const bytes = readFileSync(new URL(`../${path}`, import.meta.url));
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG', `${path} must be a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function expectPng(path, width, height) {
  assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is missing`);
  assert.deepEqual(pngDimensions(path), { width, height }, `${path} has the wrong dimensions`);
}

expectPng('apps/mobile/public/icon-512.png', 512, 512);
expectPng('apps/mobile/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024);
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
  expectPng(`apps/mobile/ios/App/App/Assets.xcassets/Splash.imageset/${name}`, 2732, 2732);
}

for (const density of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  for (const name of ['ic_launcher.png', 'ic_launcher_foreground.png', 'ic_launcher_round.png']) {
    const path = `apps/mobile/android/app/src/main/res/mipmap-${density}/${name}`;
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is missing`);
  }
  for (const orientation of ['port', 'land']) {
    const path = `apps/mobile/android/app/src/main/res/drawable-${orientation}-${density}/splash.png`;
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `${path} is missing`);
  }
}

console.log('Mobile icon and splash asset inventory is complete.');
