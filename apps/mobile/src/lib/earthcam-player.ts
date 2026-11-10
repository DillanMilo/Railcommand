import type { MobileEarthCamEmbed } from '@railcommand/domain';

// WebView's originWhitelist is a dispatcher, not a denylist: rejected origins
// are opened by the operating system BEFORE onShouldStartLoadWithRequest runs.
// Route every request to our exact validator so rejected links stay blocked.
export const EARTHCAM_DISPATCH_ORIGINS = ['*'];

// Missing optional bootstrap capabilities are not evidence of a role denial.
// This only describes the state; the screen still requires explicit true access.
export function earthCamAccessNotice(
  projectId: string | null,
  project: { canViewEarthCam?: boolean } | undefined,
  online: boolean,
): { title: string; detail: string } | null {
  if (!projectId) return {
    title: 'Select a project',
    detail: 'Choose a project before viewing its camera feeds.',
  };
  if (!project) return {
    title: 'Project data unavailable',
    detail: online ? 'Project data has not loaded. Camera feeds stay hidden until access is verified.'
      : 'This project is not available on this device. Reconnect to load its data and verify camera access.',
  };
  if (project.canViewEarthCam === true) return null;
  if (project.canViewEarthCam === false) return {
    title: 'Camera access unavailable',
    detail: 'Your current project role does not have permission to view EarthCam feeds.',
  };
  return {
    title: 'Camera access not verified',
    detail: online ? 'Camera access information is unavailable for this project. Feeds stay hidden until access is verified.'
      : 'Camera access is not saved for this project. Reconnect to verify access; live video is online-only.',
  };
}

export function isEarthCamShareUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'share.earthcam.net'
      && !url.username && !url.password && !url.port;
  } catch {
    return false;
  }
}

export function isAllowedEarthCamNavigation(value: string): boolean {
  return value === 'about:blank' || isEarthCamShareUrl(value);
}

export type EarthCamPlayerState = 'offline' | 'blocked' | 'failed' | 'playable';

export function earthCamPlayerState(online: boolean, url: string, failed: boolean): EarthCamPlayerState {
  if (!online) return 'offline';
  if (!isEarthCamShareUrl(url)) return 'blocked';
  return failed ? 'failed' : 'playable';
}

export function earthCamFeedsForProject(feeds: MobileEarthCamEmbed[], projectId: string | null): MobileEarthCamEmbed[] {
  // Project selection can precede its network refresh. Never label or render the
  // previous project's cached feeds under the newly selected project heading.
  return projectId ? feeds.filter((feed) => feed.projectId === projectId) : [];
}
