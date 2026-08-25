import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('mobile viewport safety', () => {
  it('locks the bundled native viewport against focus and gesture zoom', () => {
    const viewport = html.match(/<meta name="viewport" content="([^"]+)"/i)?.[1] ?? '';

    assert.match(viewport, /width=device-width/);
    assert.match(viewport, /initial-scale=1(?:\.0)?/);
    assert.match(viewport, /maximum-scale=1(?:\.0)?/);
    assert.match(viewport, /user-scalable=no/);
    assert.match(viewport, /viewport-fit=cover/);
  });

  it('keeps every focusable form control at the iOS 16px zoom threshold', () => {
    assert.match(
      css,
      /input, textarea, select \{[\s\S]*?font-size:\s*16px;[\s\S]*?\}/,
    );
  });
});
