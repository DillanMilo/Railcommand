import type { MobileAppRelease } from '@railcommand/domain';

// Promote these numbers only after Apple reports the build approved and released
// to the intended TestFlight audience. Uploading alone is not availability.
export const availableMobileRelease: MobileAppRelease = {
  schemaVersion: 1,
  ios: { buildNumber: 300012, version: '1.0.0', channel: 'testflight' },
};

export const pilotMobileRelease: MobileAppRelease = {
  schemaVersion: 1,
  ios: { buildNumber: 610011, version: '1.0.0', channel: 'testflight' },
};

// Server-only targeting must match the confirmed existing TestFlight audience.
// This selects an update notice; it never grants app/project/Inventory access.
export function mobileReleaseForUser(
  userId: string,
  pilotUserIds = process.env.MOBILE_IOS_UPDATE_PILOT_USER_IDS,
  published = { general: availableMobileRelease, pilot: pilotMobileRelease },
): MobileAppRelease {
  const ids = pilotUserIds?.split(',').map(id => id.trim().toLowerCase()).filter(Boolean) ?? [];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  // A missing/malformed rollout falls back to the broadly available release.
  if (!ids.length || ids.some(id => !uuid.test(id))) return published.general;
  return ids.includes(userId.toLowerCase())
    && (published.pilot.ios?.buildNumber ?? 0) > (published.general.ios?.buildNumber ?? 0)
    ? published.pilot : published.general;
}
