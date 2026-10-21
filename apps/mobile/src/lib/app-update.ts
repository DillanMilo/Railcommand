import { availableIOSUpdate, supportsIOSAppUpdates, type InstalledMobileApp, type MobileAppRelease } from '@railcommand/domain';

export const TESTFLIGHT_APP_URL = 'itms-beta://beta.itunes.apple.com/v1/app/6803576049';
export const TESTFLIGHT_STORE_URL = 'https://apps.apple.com/app/testflight/id899247664';

type Update = NonNullable<MobileAppRelease['ios']>;
type Check = {
  installed: InstalledMobileApp;
  isCurrent: () => boolean;
  fetchRelease: (signal: AbortSignal) => Promise<unknown>;
  show: (release: Update) => void;
};

// Only public build numbers live in memory. No draft/outbox/database changes.
export function createAppUpdateChecker(now: () => number = Date.now, timeoutMs = 5000) {
  let checking = false;
  let nextCheck = 0;
  const shown = new Set<number>();
  return async ({ installed, isCurrent, fetchRelease, show }: Check): Promise<void> => {
    if (!supportsIOSAppUpdates(installed) || !isCurrent() || checking || now() < nextCheck) return;
    checking = true;
    nextCheck = now() + 15 * 60_000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchRelease(controller.signal);
      const update = availableIOSUpdate(installed, response);
      if (!isCurrent() || controller.signal.aborted) { nextCheck = 0; return; }
      if (update && !shown.has(update.buildNumber)) {
        shown.add(update.buildNumber);
        show(update);
      }
    } catch {
      // No network/auth/release service must ever block opening saved field work.
      nextCheck = now() + 60_000;
    } finally {
      clearTimeout(timeout);
      checking = false;
    }
  };
}

export async function openTestFlight(openURL: (url: string) => Promise<unknown>): Promise<void> {
  try { await openURL(TESTFLIGHT_APP_URL); }
  catch { await openURL(TESTFLIGHT_STORE_URL); }
}
