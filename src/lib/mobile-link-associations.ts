const PRODUCTION_HOSTS = new Set(['railcommand.io', 'www.railcommand.io']);
const APPLE_TEAM_ID = 'PQAGLH9L66';
const APPLE_BUNDLE_ID = 'io.railcommand.app';
const ANDROID_PACKAGE_NAME = 'io.railcommand.app';

// Google Play App Signing certificate fingerprint. This is public trust
// metadata, not a private upload key or signing credential.
const ANDROID_PLAY_SIGNING_SHA256 =
  '1E:40:D5:E3:33:68:F6:EB:9D:28:33:FF:C2:48:48:85:BD:2F:70:69:43:A6:26:9F:E4:1A:56:78:2F:7D:A4:B2';

function isProductionHost(hostHeader: string | null): boolean {
  const host = (hostHeader ?? '').split(':')[0].trim().toLowerCase();
  return PRODUCTION_HOSTS.has(host);
}

export function appleAppSiteAssociation(hostHeader: string | null) {
  if (!isProductionHost(hostHeader)) return null;

  return {
    applinks: {
      details: [{
        appIDs: [`${APPLE_TEAM_ID}.${APPLE_BUNDLE_ID}`],
        components: [
          { '/': '/auth/callback*' },
          { '/': '/invite/*' },
          { '/': '/projects/*' },
        ],
      }],
    },
  };
}

export function androidAssetLinks(hostHeader: string | null) {
  if (!isProductionHost(hostHeader)) return null;

  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE_NAME,
      sha256_cert_fingerprints: [ANDROID_PLAY_SIGNING_SHA256],
    },
  }];
}
