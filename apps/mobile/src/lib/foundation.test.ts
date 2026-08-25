import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'mocha';

function source(path: string) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
}

describe('Expo Phase 3 security and offline boundaries', () => {
  it('uses SQLite drafts/outbox and never private Cache Storage or a service worker', () => {
    const offline = source('./offline-store.ts');
    assert.match(offline, /expo-sqlite/);
    assert.match(offline, /withExclusiveTransactionAsync/);
    assert.match(offline, /operation\.operationId/);
    assert.doesNotMatch(offline, /caches\.open|serviceWorker|localStorage/);
  });

  it('stores sessions in platform secure storage and refreshes them with app lifecycle', () => {
    const auth = source('./supabase.ts');
    assert.match(auth, /expo-secure-store/);
    assert.match(auth, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
    assert.match(auth, /startAutoRefresh/);
    assert.match(auth, /stopAutoRefresh/);
  });

  it('removes both the user database and app-owned photo files during safe sign-out', () => {
    const offline = source('./offline-store.ts');
    const deleteDatabase = offline.indexOf('deleteDatabaseAsync(name)');
    const userFiles = offline.indexOf("new Directory(Paths.document, 'railcommand', userId)");
    const deleteFiles = offline.indexOf('userFiles.delete()', userFiles);
    assert.ok(deleteDatabase >= 0 && deleteDatabase < userFiles && userFiles < deleteFiles);
  });

  it('synchronizes the parent before photos and deletes local files only after completion', () => {
    const sync = source('./sync.ts');
    const parent = sync.indexOf('syncDailyLog(operation)');
    const photo = sync.indexOf('prepareDailyLogPhoto');
    const complete = sync.indexOf('await completeExpoSync');
    const remove = sync.indexOf('file.delete()', complete);
    assert.ok(parent >= 0 && parent < photo && photo < complete && complete < remove);
  });

  it('manifests queued photos and refuses to send a parent when a manifested photo is missing', () => {
    const offline = source('./offline-store.ts');
    const sync = source('./sync.ts');
    assert.match(offline, /photoManifestVersion: 1/);
    assert.match(offline, /photoIds: persistedPhotoIds/);
    assert.match(offline, /A displayed photo is no longer available/);
    assert.ok(sync.indexOf('photoManifestVersion !== 1') < sync.indexOf('syncDailyLog(operation)'));
    assert.ok(sync.indexOf('missingPhotoCount') < sync.indexOf('syncDailyLog(operation)'));
    assert.match(sync, /The daily log was not sent/);
  });

  it('uses Expo native crypto for photo IDs in Release builds', () => {
    const device = source('./device.ts');
    assert.match(device, /import \* as Crypto from 'expo-crypto'/);
    assert.match(device, /Crypto\.randomUUID\(\)/);
    assert.doesNotMatch(device, /const photoId = crypto\.randomUUID/);
  });

  it('refreshes the Sync Center on focus and exposes queued daily-log and photo counts', () => {
    const screen = source('../app/(tabs)/sync.tsx');
    assert.match(screen, /useFocusEffect/);
    assert.match(screen, /reloadSyncRows/);
    assert.match(screen, /Device queue:/);
    assert.match(screen, /row\.kind === 'photo'/);
  });

  it('provides concrete project routes, native link rewrites, and an auth-callback escape', () => {
    const layout = source('../app/_layout.tsx');
    const project = source('../app/projects/[id].tsx');
    const nativeIntent = source('../app/+native-intent.tsx');
    const callback = source('../app/auth/callback.tsx');
    assert.match(layout, /name="projects\/\[id\]"/);
    assert.match(project, /selectProject\(id\)/);
    assert.match(nativeIntent, /url\.protocol === 'railcommand:'/);
    assert.match(nativeIntent, /segments\.join/);
    assert.match(callback, /Return to RailCommand/);
    assert.match(callback, /setTimeout/);
  });
});
