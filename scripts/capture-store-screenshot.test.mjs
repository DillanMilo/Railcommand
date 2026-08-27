import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { requiredStoriesForTarget } from './store-media.mjs';

const source = readFileSync(new URL('./capture-store-screenshot.mjs', import.meta.url), 'utf8');

test('resolves adb from ANDROID_HOME for reproducible Google Play capture', () => {
  assert.match(source, /process\.env\.ANDROID_HOME/);
  assert.match(source, /'platform-tools', 'adb'/);
  assert.match(source, /run\(adb, \['-s', device, 'exec-out', 'screencap', '-p'\]\)/);
});

test('keeps Android capture as a JPEG without overwriting by default', () => {
  assert.match(source, /Override size:/);
  assert.match(source, /calculateCenteredCrop/);
  assert.match(source, /'-c', String\(crop\.height\), String\(crop\.width\)/);
  assert.match(source, /'-z', String\(targetSize\.height\), String\(targetSize\.width\)/);
  assert.match(source, /formatOptions', '95'/);
  assert.match(source, /validateStoreImage\(temporaryJpeg, target\)/);
  assert.match(source, /renameSync\(temporaryJpeg, outputPath\)/);
  assert.match(source, /outputPath already exists|already exists; inspect it/);
  assert.match(source, /validateStoreImage\(outputPath, target\)/);
});

test('uses a lean Apple set and the complete Google offline story', () => {
  assert.deepEqual(
    requiredStoriesForTarget('apple-iphone').map((story) => story.slug),
    ['field-dashboard', 'daily-log-draft', 'privacy-controls'],
  );
  assert.equal(requiredStoriesForTarget('apple-ipad').length, 3);
  assert.equal(requiredStoriesForTarget('google-phone').length, 6);
  assert.equal(requiredStoriesForTarget('google-tablet').length, 6);
});
