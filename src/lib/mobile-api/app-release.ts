import type { MobileAppRelease } from '@railcommand/domain';

// Promote this number only after Apple reports the build VALID and available to
// the intended TestFlight groups. A queued/uploaded build is not a release.
export const availableMobileRelease: MobileAppRelease = {
  schemaVersion: 1,
  ios: { buildNumber: 300012, version: '1.0.0', channel: 'testflight' },
};
