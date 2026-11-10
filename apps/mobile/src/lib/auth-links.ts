import { parseMobileDeepLink, type MobileDeepLink } from '@railcommand/domain';

type LinkConfig = { localPhase1?: boolean; linkHost: string };

export function createAuthCallbackUrl(config: LinkConfig): URL {
  return config.localPhase1
    ? new URL('railcommandphase1://auth/callback')
    : new URL('/auth/callback', `https://${config.linkHost}`);
}

export function parseConfiguredDeepLink(rawUrl: string, config: LinkConfig): MobileDeepLink {
  if (!config.localPhase1) return parseMobileDeepLink(rawUrl, [config.linkHost]);
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'railcommandphase1:' || url.username || url.password || url.port
      || (url.hostname === 'auth' && url.pathname !== '/callback')) {
      return { kind: 'unsupported' };
    }
    // Reuse the existing domain parser after verifying the isolated app's scheme.
    url.protocol = 'railcommand:';
    return parseMobileDeepLink(url.toString(), []);
  } catch { return { kind: 'unsupported' }; }
}
