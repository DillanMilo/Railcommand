import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';
import { androidAssetLinks, appleAppSiteAssociation } from './mobile-link-associations';

const middleware = readFileSync('src/middleware.ts', 'utf8');

describe('production mobile link associations', () => {
  it('publishes only the approved production Apple application identifier', () => {
    assert.deepEqual(
      appleAppSiteAssociation('railcommand.io')?.applinks.details[0].appIDs,
      ['PQAGLH9L66.io.railcommand.app'],
    );
    assert.equal(appleAppSiteAssociation('mobile-staging.railcommand.io'), null);
    assert.equal(appleAppSiteAssociation('evil.example'), null);
  });

  it('publishes the approved Play App Signing fingerprint for production only', () => {
    const android = androidAssetLinks('www.railcommand.io');
    assert.equal(android?.[0].target.package_name, 'io.railcommand.app');
    assert.deepEqual(android?.[0].target.sha256_cert_fingerprints, [
      '1E:40:D5:E3:33:68:F6:EB:9D:28:33:FF:C2:48:48:85:BD:2F:70:69:43:A6:26:9F:E4:1A:56:78:2F:7D:A4:B2',
    ]);
    assert.equal(androidAssetLinks('mobile-staging.railcommand.io'), null);
    assert.equal(androidAssetLinks('evil.example'), null);
  });

  it('bypasses login middleware for operating-system discovery', () => {
    assert.match(middleware, /'\/\.well-known\/apple-app-site-association'/);
    assert.match(middleware, /'\/\.well-known\/assetlinks\.json'/);
    assert.match(middleware, /MOBILE_ASSOCIATION_PATHS\.has\(pathname\).*NextResponse\.next/);
  });
});
