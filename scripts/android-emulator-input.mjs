const directKeyCodes = new Map([
  [' ', 'KEYCODE_SPACE'],
  ["'", 'KEYCODE_APOSTROPHE'],
  [',', 'KEYCODE_COMMA'],
  ['-', 'KEYCODE_MINUS'],
  ['.', 'KEYCODE_PERIOD'],
  ['/', 'KEYCODE_SLASH'],
  [';', 'KEYCODE_SEMICOLON'],
  ['=', 'KEYCODE_EQUALS'],
  ['@', 'KEYCODE_AT'],
  ['[', 'KEYCODE_LEFT_BRACKET'],
  ['\\', 'KEYCODE_BACKSLASH'],
  [']', 'KEYCODE_RIGHT_BRACKET'],
  ['`', 'KEYCODE_GRAVE'],
]);

const shiftedKeyCodes = new Map([
  ['!', 'KEYCODE_1'],
  ['"', 'KEYCODE_APOSTROPHE'],
  ['#', 'KEYCODE_3'],
  ['$', 'KEYCODE_4'],
  ['%', 'KEYCODE_5'],
  ['&', 'KEYCODE_7'],
  ['(', 'KEYCODE_9'],
  [')', 'KEYCODE_0'],
  ['*', 'KEYCODE_8'],
  ['+', 'KEYCODE_EQUALS'],
  [':', 'KEYCODE_SEMICOLON'],
  ['<', 'KEYCODE_COMMA'],
  ['>', 'KEYCODE_PERIOD'],
  ['?', 'KEYCODE_SLASH'],
  ['^', 'KEYCODE_6'],
  ['_', 'KEYCODE_MINUS'],
  ['{', 'KEYCODE_LEFT_BRACKET'],
  ['|', 'KEYCODE_BACKSLASH'],
  ['}', 'KEYCODE_RIGHT_BRACKET'],
  ['~', 'KEYCODE_GRAVE'],
]);

export function buildAndroidInputCommands(value) {
  if (!value) throw new Error('Android emulator input cannot be empty');
  const commands = [];
  let plainText = '';
  const flushPlainText = () => {
    if (!plainText) return;
    commands.push(['text', plainText]);
    plainText = '';
  };

  for (const character of value) {
    if (/^[A-Za-z0-9]$/.test(character)) {
      plainText += character;
      continue;
    }
    flushPlainText();
    const direct = directKeyCodes.get(character);
    if (direct) {
      commands.push(['keyevent', direct]);
      continue;
    }
    const shifted = shiftedKeyCodes.get(character);
    if (shifted) {
      commands.push(['keycombination', 'KEYCODE_SHIFT_LEFT', shifted]);
      continue;
    }
    throw new Error('Synthetic credential contains an unsupported Android input character');
  }
  flushPlainText();
  return commands;
}

export function centerOfBounds(bounds) {
  const match = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(bounds);
  if (!match) throw new Error('Android accessibility bounds are invalid');
  const [, left, top, right, bottom] = match.map(Number);
  return [Math.round((left + right) / 2), Math.round((top + bottom) / 2)];
}
