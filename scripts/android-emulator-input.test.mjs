import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildAndroidInputCommands, centerOfBounds } from './android-emulator-input.mjs';

test('keeps safe runs compact and sends punctuation as explicit key events', () => {
  assert.deepEqual(buildAndroidInputCommands('qa-user@example.io'), [
    ['text', 'qa'],
    ['keyevent', 'KEYCODE_MINUS'],
    ['text', 'user'],
    ['keyevent', 'KEYCODE_AT'],
    ['text', 'example'],
    ['keyevent', 'KEYCODE_PERIOD'],
    ['text', 'io'],
  ]);
  assert.deepEqual(buildAndroidInputCommands('A_1!'), [
    ['text', 'A'],
    ['keycombination', 'KEYCODE_SHIFT_LEFT', 'KEYCODE_MINUS'],
    ['text', '1'],
    ['keycombination', 'KEYCODE_SHIFT_LEFT', 'KEYCODE_1'],
  ]);
});

test('rejects empty or unsupported input before sending any command', () => {
  assert.throws(() => buildAndroidInputCommands(''));
  assert.throws(() => buildAndroidInputCommands('qa🙂'));
});

test('finds the center of an accessibility bound', () => {
  assert.deepEqual(centerOfBounds('[99,638][1181,782]'), [640, 710]);
});
