import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';
import { androidAssetLinks, appleAppSiteAssociation } from './mobile-link-associations';

const middleware = readFileSync('src/middleware.ts', 'utf8');

describe('mobile link associations', () => {
  it('supports the staging TestFlight beta without widening development trust', () => {
    const apple = appleAppSiteAssociation('mobile-staging.railcommand.io');
    const android = androidAssetLinks('mobile-staging.railcommand.io');
    assert.deepEqual(apple?.applinks.details[0].appIDs, [
      'PQAGLH9L66.io.railcommand.app.dev',
      'PQAGLH9L66.io.railcommand.app.staging',
      'PQAGLH9L66.io.railcommand.app',
    ]);
    assert.deepEqual(apple?.applinks.details[0].components, [
      { '/': '/auth/callback*' },
      { '/': '/invite/*' },
      { '/': '/projects/*' },
    ]);
    assert.equal(android?.[0].target.package_name, 'io.railcommand.app.dev');
    assert.equal(appleAppSiteAssociation('evil.example'), null);
    assert.equal(androidAssetLinks('evil.example'), null);
  });

  it('never publishes Android production trust without an approved fingerprint', () => {
    assert.equal(androidAssetLinks('railcommand.io', undefined), null);
    assert.equal(androidAssetLinks('railcommand.io', 'not-a-fingerprint'), null);
    assert.equal(
      androidAssetLinks('railcommand.io', `${'AA:'.repeat(31)}AA`)?.[0].target.package_name,
      'io.railcommand.app',
    );
    for (const host of ['railcommand.io', 'www.railcommand.io']) {
      assert.deepEqual(appleAppSiteAssociation(host)?.applinks.details[0].appIDs, [
        'PQAGLH9L66.io.railcommand.app',
      ]);
    }
  });

  it('does not trust a lookalike or unique Preview host for beta links', () => {
    for (const host of [
      null,
      'mobile-staging.railcommand.io.evil.example',
      'railcommand.io.evil.example',
      'railcommand-mobile-staging-example.vercel.app',
    ]) {
      assert.equal(appleAppSiteAssociation(host), null);
    }
  });

  it('keeps both association documents public for operating-system discovery', () => {
    assert.match(middleware, /pathname === '\/\.well-known\/apple-app-site-association'/);
    assert.match(middleware, /pathname === '\/\.well-known\/assetlinks\.json'/);
  });
});
