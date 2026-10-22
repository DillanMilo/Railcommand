import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { androidAssetLinks, appleAppSiteAssociation } from './mobile-link-associations';

describe('mobile link associations', () => {
  it('isolates development associations to the staging host', () => {
    const apple = appleAppSiteAssociation('railcommand-mobile-staging.vercel.app');
    const android = androidAssetLinks('railcommand-mobile-staging.vercel.app');
    assert.deepEqual(apple?.applinks.details[0].appIDs, [
      'PQAGLH9L66.io.railcommand.app.dev',
      'PQAGLH9L66.io.railcommand.app.staging',
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
    assert.deepEqual(appleAppSiteAssociation('railcommand.io')?.applinks.details[0].appIDs, [
      'PQAGLH9L66.io.railcommand.app',
    ]);
  });
});
