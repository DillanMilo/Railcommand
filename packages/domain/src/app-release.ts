export type MobileAppRelease = {
  schemaVersion: 1;
  ios: { buildNumber: number; version: string; channel: 'testflight' } | null;
};

export type InstalledMobileApp = {
  platform: string;
  profile: string;
  applicationId: string | null;
  buildNumber: string | null;
};

/** Only compare the real native build with a verified, published release.
 * An unknown response or a different app/platform must never trigger an update. */
export function supportsIOSAppUpdates(installed: InstalledMobileApp): boolean {
  if (installed.platform !== 'ios' || installed.profile !== 'production'
    || installed.applicationId !== 'io.railcommand.app'
    || !installed.buildNumber || !/^[1-9]\d*$/.test(installed.buildNumber)) return false;
  const current = Number(installed.buildNumber);
  return Number.isSafeInteger(current);
}

export function availableIOSUpdate(installed: InstalledMobileApp, value: unknown): NonNullable<MobileAppRelease['ios']> | null {
  if (!supportsIOSAppUpdates(installed)) return null;
  const current = Number(installed.buildNumber);
  if (!value || typeof value !== 'object') return null;
  const release = value as Partial<MobileAppRelease>;
  const ios = release.ios;
  if (release.schemaVersion !== 1 || !ios || ios.channel !== 'testflight'
    || !Number.isSafeInteger(ios.buildNumber) || ios.buildNumber <= current
    || typeof ios.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(ios.version)) return null;
  return { buildNumber: ios.buildNumber, version: ios.version, channel: 'testflight' };
}
