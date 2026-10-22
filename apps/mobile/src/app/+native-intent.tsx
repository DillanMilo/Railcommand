import { mobileConfig } from '@/lib/config';

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path, 'https://railcommand.io');
    if (url.protocol === 'railcommand:') {
      const segments = [url.hostname, ...url.pathname.split('/')].filter(Boolean);
      return `/${segments.join('/')}${url.search}${url.hash}`;
    }
    if (url.protocol === 'https:' && url.hostname === mobileConfig.linkHost) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
    return url.pathname.startsWith('/') ? url.pathname : '/';
  } catch {
    return '/';
  }
}
