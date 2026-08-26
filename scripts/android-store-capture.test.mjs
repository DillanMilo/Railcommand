import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateCenteredCrop, selectTargetDimensions } from './android-store-capture.mjs';

test('selects the allowed dimensions matching the emulator orientation', () => {
  const allowed = new Set(['1080x1920', '1920x1080']);
  assert.deepEqual(selectTargetDimensions(allowed, 2560, 1600), {
    width: 1920,
    height: 1080,
    dimensions: '1920x1080',
  });
  assert.deepEqual(selectTargetDimensions(allowed, 1280, 2856), {
    width: 1080,
    height: 1920,
    dimensions: '1080x1920',
  });
});

test('crops emulator letterboxing to the target aspect ratio without stretching', () => {
  assert.deepEqual(calculateCenteredCrop(2560, 1600, 1920, 1080), {
    width: 2560,
    height: 1440,
  });
  assert.deepEqual(calculateCenteredCrop(1280, 2856, 1080, 1920), {
    width: 1280,
    height: 2276,
  });
});
