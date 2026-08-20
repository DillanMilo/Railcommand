import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';

const appSource = readFileSync(new URL('./App.tsx', import.meta.url), 'utf8');

describe('mobile bootstrap connectivity', () => {
  it('does not use navigator.onLine to suppress the authenticated bootstrap request', () => {
    assert.doesNotMatch(appSource, /if \(!navigator\.onLine\) return/);
    assert.match(appSource, /await api\.getBootstrap\(projectId\)/);
  });

  it('refreshes project state after Capacitor reports a reconnect', () => {
    assert.match(
      appSource,
      /networkStatusChange[\s\S]*status\.connected[\s\S]*await loadProject\(session\.user\.id/,
    );
  });
});
