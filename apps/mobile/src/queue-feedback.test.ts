import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

describe('mobile queue feedback', () => {
  it('clears the submitted form and surfaces queue and sync state beside it', () => {
    assert.match(appSource, /setDraftValues\(EMPTY_DRAFT\)/);
    assert.match(appSource, /setDraftFeedback\(queuedMessage\)/);
    assert.match(appSource, /setDraftFeedback\(syncMessage\)/);
  });

  it('makes a disabled queue button visibly different from an actionable one', () => {
    assert.match(css, /\.primary-button:disabled\s*\{/);
    assert.match(css, /cursor:\s*not-allowed/);
    assert.match(css, /box-shadow:\s*none/);
  });
});
