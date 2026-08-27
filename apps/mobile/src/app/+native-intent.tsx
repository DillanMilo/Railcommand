import { mobileConfig } from '@/lib/config';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'https://railcommand.io');
    const route = (segments: string[], suffix: string) => {
      if (segments[0] === 'invite' && segments[1]) return `/invitation/${segments[1]}${suffix}`;
      return `/${segments.join('/')}${suffix}`;
    };
    if (url.protocol === 'railcommand:') {
      const segments = [url.hostname, ...url.pathname.split('/')].filter(Boolean);
      return route(segments, `${url.search}${url.hash}`);
    }
    if (url.protocol === 'https:' && url.hostname === mobileConfig.linkHost) {
      // Supabase falls back to the configured Site URL when a requested
      // redirect is unavailable. Preserve that one-time PKCE code and route
      // the legacy root callback into the password-reset flow, matching the
      // staging web middleware behavior.
      if (url.pathname === '/' && url.searchParams.has('code')) {
        url.pathname = '/auth/callback';
        url.searchParams.set('type', 'recovery');
        url.searchParams.set('next', '/reset-password');
      }
      return route(url.pathname.split('/').filter(Boolean), `${url.search}${url.hash}`);
    }
    return url.pathname.startsWith('/') ? url.pathname : '/';
  } catch {
    return '/';
  }
}
