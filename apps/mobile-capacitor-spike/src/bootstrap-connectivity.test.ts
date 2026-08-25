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
      /onConnectivityChange\(updateConnectivity\)/,
    );
    assert.match(
      appSource,
      /updateConnectivity[\s\S]*status\.connected[\s\S]*synchronizeAndRefresh/,
    );
  });

  it('drains the durable outbox at startup and whenever the app returns to the foreground', () => {
    assert.match(
      appSource,
      /getConnectivity\(\)\.then\(updateConnectivity\)/,
    );
    assert.match(
      appSource,
      /registerForegroundLifecycle[\s\S]*getConnectivity\(\)[\s\S]*updateConnectivity/,
    );
    assert.match(
      appSource,
      /synchronizeMobileOutbox\(session\.user\.id, api\)[\s\S]*await loadProject\(session\.user\.id/,
    );
  });
});
