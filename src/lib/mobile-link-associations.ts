const STAGING_HOST = 'mobile-staging.railcommand.io';
const PRODUCTION_HOSTS = new Set(['railcommand.io', 'www.railcommand.io']);
const APPLE_TEAM_ID = 'PQAGLH9L66';
const ANDROID_DEVELOPMENT_SHA256 =
  'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';

function normalizeHost(host: string | null): string {
  return (host ?? '').split(':')[0].trim().toLowerCase();
}

function validSha256(value: string | undefined): value is string {
  return Boolean(value && /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(value));
}

export function appleAppSiteAssociation(hostHeader: string | null) {
  const host = normalizeHost(hostHeader);
  const appIDs = host === STAGING_HOST
    ? [`${APPLE_TEAM_ID}.io.railcommand.app.dev`, `${APPLE_TEAM_ID}.io.railcommand.app.staging`]
    : PRODUCTION_HOSTS.has(host)
      ? [`${APPLE_TEAM_ID}.io.railcommand.app`]
      : null;
  if (!appIDs) return null;
  return {
    applinks: {
      details: [{
        appIDs,
        components: [
          { '/': '/auth/callback*' },
          { '/': '/invite/*' },
          { '/': '/projects/*' },
        ],
      }],
    },
  };
}

export function androidAssetLinks(
  hostHeader: string | null,
  productionFingerprint = process.env.MOBILE_ANDROID_PRODUCTION_SHA256,
) {
  const host = normalizeHost(hostHeader);
  if (host === STAGING_HOST) {
    return [{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: 'io.railcommand.app.dev',
        sha256_cert_fingerprints: [ANDROID_DEVELOPMENT_SHA256],
      },
    }];
  }
  if (!PRODUCTION_HOSTS.has(host) || !validSha256(productionFingerprint)) return null;
  return [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'io.railcommand.app',
      sha256_cert_fingerprints: [productionFingerprint.toUpperCase()],
    },
  }];
}
