import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';
import {
  getOfflineDatabaseName,
  isRailCommandCacheName,
} from './storage';

describe('offline storage security boundaries', () => {
  it('creates a separate database name for every user', () => {
    assert.equal(getOfflineDatabaseName('user-a'), 'railcommand-offline:user-a');
    assert.equal(getOfflineDatabaseName('user-b'), 'railcommand-offline:user-b');
    assert.notEqual(getOfflineDatabaseName('user-a'), getOfflineDatabaseName('user-b'));
  });

  it('encodes user IDs before using them in a database name', () => {
    assert.equal(
      getOfflineDatabaseName('user/name@example.com'),
      'railcommand-offline:user%2Fname%40example.com'
    );
  });

  it('rejects an empty offline user scope', () => {
    assert.throws(() => getOfflineDatabaseName('  '), /user ID is required/);
  });

  it('identifies only RailCommand-owned caches for cleanup', () => {
    assert.equal(isRailCommandCacheName('railcommand-v2'), true);
    assert.equal(isRailCommandCacheName('railcommand-static-v3'), true);
    assert.equal(isRailCommandCacheName('another-app-cache'), false);
  });
});

describe('service worker cache policy', () => {
  const serviceWorker = readFileSync(
    new URL('../../../public/sw.js', import.meta.url),
    'utf8'
  );

  it('does not pre-cache an authenticated dashboard route', () => {
    assert.doesNotMatch(serviceWorker, /PUBLIC_APP_SHELL\s*=\s*\[[\s\S]*["']\/dashboard["']/);
  });

  it('uses a neutral fallback for failed navigations', () => {
    assert.match(serviceWorker, /request\.mode === ["']navigate["']/);
    assert.match(serviceWorker, /caches\.match\(["']\/offline\.html["']\)/);
  });

  it('limits runtime caching to same-origin public static files', () => {
    assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
    assert.match(serviceWorker, /url\.pathname\.startsWith\(["']\/_next\/static\/["']\)/);
  });
});
