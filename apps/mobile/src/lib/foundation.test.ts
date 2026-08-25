import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
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
});
