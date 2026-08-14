import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';
import {
  getOfflineDatabaseName,
  getOfflineUserIdFromDatabaseName,
  getOfflineRecordKey,
  isRailCommandCacheName,
  isOfflineRecordDiscarded,
  isOfflineRecordStale,
  isOfflineStorageNearlyFull,
} from './storage';
import { getOfflineStorageErrorMessage, isOfflineStorageQuotaError } from './errors';
import {
  createOfflineRecord,
  limitRecentDailyLogs,
  OFFLINE_CACHE_POLICIES,
  RECENT_DAILY_LOG_LIMIT,
} from './project-cache';
import {
  createDailyLogDraftRecord,
  dailyLogDraftHasEnteredData,
  getDailyLogDraftId,
  type DailyLogDraftValues,
} from './daily-log-draft';
import {
  createDailyLogPhotoOperation,
  createDailyLogOutboxOperation,
  DAILY_LOG_PHOTO_UPLOAD_OPERATION,
  getRetryDelayMs,
  MAX_RETRY_DELAY_MS,
  MAX_SYNC_ATTEMPTS,
  scheduleOutboxRetry,
} from './outbox';
import type { DailyLog } from '@/lib/types';

describe('offline storage security boundaries', () => {
  it('creates a separate database name for every user', () => {
    assert.equal(getOfflineDatabaseName('user-a'), 'railcommand-offline:user-a');
    assert.equal(getOfflineDatabaseName('user-b'), 'railcommand-offline:user-b');
    assert.notEqual(getOfflineDatabaseName('user-a'), getOfflineDatabaseName('user-b'));
  });

  it('encodes user IDs before using them in a database name', () => {
    assert.equal(
      getOfflineDatabaseName('user/name@example.com'),
      'railcommand-offline:user%2Fname%40example.com'
    );
  });

  it('recovers only a RailCommand user scope from an encoded database name', () => {
    assert.equal(
      getOfflineUserIdFromDatabaseName('railcommand-offline:user%2Fname%40example.com'),
      'user/name@example.com'
    );
    assert.equal(getOfflineUserIdFromDatabaseName('another-app:user-a'), null);
    assert.equal(getOfflineUserIdFromDatabaseName('railcommand-offline:%E0%A4%A'), null);
    assert.equal(getOfflineUserIdFromDatabaseName('railcommand-offline:'), null);
  });

  it('rejects an empty offline user scope', () => {
    assert.throws(() => getOfflineDatabaseName('  '), /user ID is required/);
  });

  it('identifies only RailCommand-owned caches for cleanup', () => {
    assert.equal(isRailCommandCacheName('railcommand-v2'), true);
    assert.equal(isRailCommandCacheName('railcommand-static-v8'), true);
    assert.equal(isRailCommandCacheName('another-app-cache'), false);
  });

  it('creates project-scoped record keys and rejects an empty project scope', () => {
    assert.equal(getOfflineRecordKey('project', 'project-a'), 'project:project-a');
    assert.equal(
      getOfflineRecordKey('daily_logs', 'project-a'),
      'daily_logs:project-a'
    );
    assert.throws(() => getOfflineRecordKey('project_members', '  '), /project ID is required/);
  });
});

describe('Day 2 offline project cache policies', () => {
  it('uses explicit refresh and discard windows for every cached entity', () => {
    const cachedAt = new Date('2026-08-11T12:00:00.000Z');
    const record = createOfflineRecord('daily_logs', 'project-a', [], cachedAt);
    const policy = OFFLINE_CACHE_POLICIES.daily_logs;

    assert.equal(
      Date.parse(record.refreshAfter) - cachedAt.getTime(),
      policy.refreshAfterMs
    );
    assert.equal(
      Date.parse(record.discardAfter) - cachedAt.getTime(),
      policy.discardAfterMs
    );
    assert.equal(isOfflineRecordStale(record, Date.parse(record.refreshAfter) - 1), false);
    assert.equal(isOfflineRecordStale(record, Date.parse(record.refreshAfter)), true);
    assert.equal(isOfflineRecordDiscarded(record, Date.parse(record.discardAfter)), true);
  });

  it('keeps only the most recent daily logs in the device cache', () => {
    const logs = Array.from({ length: RECENT_DAILY_LOG_LIMIT + 10 }, (_, index) => ({
      id: `log-${index}`,
      log_date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}`,
    })) as DailyLog[];
    const cached = limitRecentDailyLogs(logs);

    assert.equal(cached.length, RECENT_DAILY_LOG_LIMIT);
    assert.ok(cached.every((log, index) => index === 0 || cached[index - 1].log_date >= log.log_date));
  });

  it('keeps project records out of global localStorage', () => {
    const projectCache = readFileSync(new URL('./project-cache.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(projectCache, /localStorage/);
  });
});

describe('Day 3 offline daily-log drafts', () => {
  const emptyDraft: DailyLogDraftValues = {
    date: '2026-08-12',
    temp: '',
    conditions: '',
    wind: '',
    personnel: [{ role: '', headcount: 0, company: '' }],
    equipment: [{ type: '', count: 0, notes: '' }],
    workItems: [{ description: '', quantity: 0, unit: '', location: '' }],
    workSummary: '',
    safetyNotes: '',
    geoTag: null,
  };

  it('uses a project-scoped create-draft key without treating the date as entered work', () => {
    assert.equal(getDailyLogDraftId('project-a'), 'daily_log_create:project-a');
    assert.equal(dailyLogDraftHasEnteredData(emptyDraft), false);
    assert.equal(
      dailyLogDraftHasEnteredData({ ...emptyDraft, safetyNotes: 'Toolbox talk completed' }),
      true
    );
  });

  it('preserves the client UUID and idempotency key across every autosave', () => {
    const first = createDailyLogDraftRecord(
      'project-a',
      { ...emptyDraft, workSummary: 'Initial field work' },
      null,
      new Date('2026-08-12T12:00:00.000Z')
    );
    const second = createDailyLogDraftRecord(
      'project-a',
      { ...emptyDraft, workSummary: 'Updated field work' },
      first,
      new Date('2026-08-12T12:01:00.000Z')
    );

    assert.equal(second.clientId, first.clientId);
    assert.equal(second.idempotencyKey, first.idempotencyKey);
    assert.equal(second.createdAt, first.createdAt);
    assert.notEqual(second.updatedAt, first.updatedAt);
    assert.equal('discardAfter' in second, false);
  });

  it('keeps private drafts in IndexedDB and labels both recovery surfaces', () => {
    const storage = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
    const createPage = readFileSync(
      new URL('../../app/(app)/projects/[id]/daily-logs/new/page.tsx', import.meta.url),
      'utf8'
    );
    const offlineReader = readFileSync(
      new URL('../../../public/offline-data.js', import.meta.url),
      'utf8'
    );

    assert.match(storage, /drafts: 'drafts'/);
    assert.match(storage, /createObjectStore\(OFFLINE_STORES\.drafts/);
    assert.match(createPage, /Saved on this device/);
    assert.match(offlineReader, /Saved on this device/);
    assert.match(offlineReader, /DRAFTS_STORE/);
    assert.doesNotMatch(createPage, /localStorage\.setItem/);
  });
});

describe('Day 4 durable daily-log synchronization', () => {
  const values: DailyLogDraftValues = {
    date: '2026-08-13',
    temp: 72,
    conditions: 'Clear',
    wind: 'NW 8 mph',
    personnel: [{ role: 'Foreman', headcount: 2, company: 'Rail QA' }],
    equipment: [{ type: 'Excavator', count: 1, notes: 'Inspected' }],
    workItems: [{ description: 'Set rail', quantity: 100, unit: 'LF', location: 'MP 12' }],
    workSummary: 'Exact-once synchronization test',
    safetyNotes: 'Toolbox talk completed',
    geoTag: { lat: 41.1, lng: -87.2, timestamp: '2026-08-13T12:00:00.000Z' },
  };

  it('keeps the draft UUID and idempotency key when it becomes an outbox operation', () => {
    const draft = createDailyLogDraftRecord('project-a', values);
    const operation = createDailyLogOutboxOperation(
      draft,
      new Date('2026-08-13T12:00:00.000Z')
    );

    assert.equal(operation.operationId, draft.clientId);
    assert.equal(operation.clientId, draft.clientId);
    assert.equal(operation.idempotencyKey, draft.idempotencyKey);
    assert.equal(operation.projectId, draft.projectId);
    assert.deepEqual(operation.payload.personnel, values.personnel);
    assert.deepEqual(operation.payload.equipment, [
      { equipment_type: 'Excavator', count: 1, notes: 'Inspected' },
    ]);
  });

  it('backs off intermittent failures and stops automatic retries at the limit', () => {
    const operation = createDailyLogOutboxOperation(
      createDailyLogDraftRecord('project-a', values),
      new Date('2026-08-13T12:00:00.000Z')
    );
    let retry = operation;
    for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt += 1) {
      retry = scheduleOutboxRetry(retry, 'Temporary network failure');
      assert.equal(retry.attemptCount, attempt);
    }
    assert.equal(retry.status, 'failed');
    assert.equal(getRetryDelayMs(99), MAX_RETRY_DELAY_MS);
  });

  it('moves a draft to the outbox in one IndexedDB transaction', () => {
    const outbox = readFileSync(new URL('./outbox.ts', import.meta.url), 'utf8');
    const offlineReader = readFileSync(
      new URL('../../../public/offline-data.js', import.meta.url),
      'utf8'
    );

    assert.match(outbox, /OFFLINE_STORES\.outbox, OFFLINE_STORES\.drafts/);
    assert.match(outbox, /outboxStore\.add\(operation\)/);
    assert.match(outbox, /objectStore\(OFFLINE_STORES\.drafts\)\.delete/);
    assert.match(offlineReader, /database\.transaction\(\[OUTBOX_STORE, DRAFTS_STORE\], 'readwrite'\)/);
    assert.doesNotMatch(outbox, /localStorage/);
  });

  it('revalidates identity and permission before the transactional RPC', () => {
    const action = readFileSync(new URL('../actions/offline-sync.ts', import.meta.url), 'utf8');
    const migration = readFileSync(
      new URL('../../../supabase/migrations/20260813134528_offline_daily_log_sync.sql', import.meta.url),
      'utf8'
    );
    const triggerFix = readFileSync(
      new URL('../../../supabase/migrations/20260813135342_offline_daily_log_sync_trigger_fix.sql', import.meta.url),
      'utf8'
    );

    assert.match(action, /getAuthenticatedUser\(supabase\)/);
    assert.match(action, /checkPermission\([\s\S]*ACTIONS\.DAILY_LOG_CREATE/);
    assert.match(action, /\.rpc\('sync_daily_log_create'/);
    assert.match(migration, /security invoker/);
    assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /daily_logs_created_by_idempotency_key_uidx/);
    assert.match(migration, /insert into public\.daily_log_personnel/);
    assert.match(migration, /insert into public\.daily_log_equipment/);
    assert.match(migration, /insert into public\.daily_log_work_items/);
    assert.match(migration, /grant execute[\s\S]*to authenticated/);
    assert.doesNotMatch(triggerFix, /insert into public\.activity_log/);
  });

  it('uses foreground verified-connectivity synchronization', () => {
    const provider = readFileSync(
      new URL('../../components/providers/OfflineSyncProvider.tsx', import.meta.url),
      'utf8'
    );
    assert.match(provider, /connectivityRef\.current !== 'online'/);
    assert.match(provider, /FOREGROUND_SYNC_INTERVAL_MS/);
    assert.match(provider, /scheduleOutboxRetry/);
    assert.doesNotMatch(provider, /SyncManager|registration\.sync/);
  });
});

describe('Day 5 offline daily-log photos', () => {
  const values: DailyLogDraftValues = {
    date: '2026-08-14',
    temp: 70,
    conditions: 'Clear',
    wind: 'Calm',
    personnel: [],
    equipment: [],
    workItems: [],
    workSummary: 'Photo synchronization test',
    safetyNotes: 'No incidents',
    geoTag: null,
  };

  it('queues every photo behind the stable client-generated daily-log ID', () => {
    const parent = createDailyLogOutboxOperation(
      createDailyLogDraftRecord('project-a', values),
      new Date('2026-08-14T12:00:00.000Z')
    );
    const file = new File(['compressed'], 'field.jpg', { type: 'image/jpeg' });
    const photo = createDailyLogPhotoOperation(parent, {
      id: '7d2834a5-79de-418a-94c6-711228f65e84',
      file,
      category: 'standard',
      geo_lat: 41.1,
      geo_lng: -87.2,
      originalSize: 10_000,
    });

    assert.equal(photo.kind, DAILY_LOG_PHOTO_UPLOAD_OPERATION);
    assert.equal(photo.parentOperationId, parent.operationId);
    assert.equal(photo.parentEntityId, parent.clientId);
    assert.equal(photo.blobId, photo.operationId);
    assert.match(photo.idempotencyKey, /daily-log-photo:/);
    assert.equal(photo.payload.fileSize, file.size);
    assert.equal(photo.payload.originalSize, 10_000);
  });

  it('stores the log, compressed blobs, and operations atomically in user-scoped IndexedDB', () => {
    const storage = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
    const outbox = readFileSync(new URL('./outbox.ts', import.meta.url), 'utf8');
    assert.match(storage, /syncHistory: 'sync_history'/);
    assert.match(outbox, /OFFLINE_STORES\.outbox, OFFLINE_STORES\.drafts, OFFLINE_STORES\.blobs/);
    assert.match(outbox, /blobStore\.add\(blobRecord\)/);
    assert.match(outbox, /completeOutboxOperation/);
    assert.match(outbox, /objectStore\(OFFLINE_STORES\.blobs\)\.delete/);
    assert.doesNotMatch(outbox, /localStorage/);
  });

  it('compresses selected standard photos before exposing them to the queue', () => {
    const photoUpload = readFileSync(
      new URL('../../components/shared/PhotoUpload.tsx', import.meta.url),
      'utf8'
    );
    assert.match(photoUpload, /await Promise\.all\([\s\S]*compressImage/);
    assert.match(photoUpload, /maxPx: 1600, quality: 0\.72/);
    assert.match(photoUpload, /originalSize: files\[index\]\.size/);
    assert.match(photoUpload, /id: crypto\.randomUUID\(\)/);
  });

  it('rechecks permission around signed upload and idempotent attachment finalization', () => {
    const action = readFileSync(new URL('../actions/offline-sync.ts', import.meta.url), 'utf8');
    const provider = readFileSync(
      new URL('../../components/providers/OfflineSyncProvider.tsx', import.meta.url),
      'utf8'
    );
    const migration = readFileSync(
      new URL('../../../supabase/migrations/20260814121049_offline_daily_log_photo_sync.sql', import.meta.url),
      'utf8'
    );
    assert.match(action, /prepareOfflineDailyLogPhotoUpload/);
    assert.match(action, /finalizeOfflineDailyLogPhotoUpload/);
    assert.match(action, /checkPermission\([\s\S]*ACTIONS\.DAILY_LOG_CREATE/);
    assert.match(action, /createSignedUploadUrl\(path, \{ upsert: true \}\)/);
    assert.match(provider, /uploadToSignedUrl/);
    assert.match(provider, /one photo upload[\s\S]*another photo/);
    assert.match(migration, /security invoker/);
    assert.match(migration, /attachments_uploaded_by_idempotency_key_uidx/);
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /dl\.created_by = v_user_id/);
    assert.match(migration, /grant execute[\s\S]*to authenticated/);
  });

  it('shows pending, failed, and synchronized operations in the Sync Center', () => {
    const syncCenter = readFileSync(
      new URL('../../components/offline/SyncCenter.tsx', import.meta.url),
      'utf8'
    );
    assert.match(syncCenter, /Pending and failed/);
    assert.match(syncCenter, /Recently synchronized/);
    assert.match(syncCenter, /Retry failed/);
    assert.match(syncCenter, /Synchronized/);
  });
});

describe('offline alpha hardening acceptance', () => {
  it('warns before browser storage reaches capacity and recognizes quota failures', () => {
    assert.equal(isOfflineStorageNearlyFull(89, 100), false);
    assert.equal(isOfflineStorageNearlyFull(90, 100), true);
    assert.equal(isOfflineStorageNearlyFull(1, 0), false);

    const quota = new DOMException('Quota exceeded', 'QuotaExceededError');
    assert.equal(isOfflineStorageQuotaError(quota), true);
    assert.equal(isOfflineStorageQuotaError(new Error('disk is full')), true);
    assert.match(getOfflineStorageErrorMessage(quota), /Keep this page open/);
  });

  it('fails sign-out closed when drafts or queued work cannot be safely inspected', () => {
    const provider = readFileSync(
      new URL('../../components/providers/OfflineSyncProvider.tsx', import.meta.url),
      'utf8'
    );
    const dialog = readFileSync(
      new URL('../../components/offline/PendingWorkSignOutDialog.tsx', import.meta.url),
      'utf8'
    );
    const topbar = readFileSync(
      new URL('../../components/layout/Topbar.tsx', import.meta.url),
      'utf8'
    );
    const profile = readFileSync(
      new URL('../../app/(app)/settings/profile/page.tsx', import.meta.url),
      'utf8'
    );

    assert.match(provider, /Promise\.all\(\[\s*listOutboxOperations\(activeUserId\),\s*listDailyLogDrafts\(activeUserId\)/);
    assert.match(provider, /Fail closed/);
    assert.match(provider, /signOut\(\{ scope: 'local' \}\)/);
    assert.match(dialog, /RailCommand will not[\s\S]*explicit confirmation/);
    assert.match(dialog, /Confirm discard and sign out/);
    assert.match(topbar, /requestSignOut/);
    assert.match(profile, /requestSignOut/);
    assert.doesNotMatch(topbar, /clearOfflineDataForUser/);
  });

  it('keeps retry identity stable across interrupted and repeatedly resumed synchronization', () => {
    const original = createDailyLogOutboxOperation(
      createDailyLogDraftRecord('project-a', {
        date: '2026-08-14',
        temp: '',
        conditions: '',
        wind: '',
        personnel: [],
        equipment: [],
        workItems: [],
        workSummary: 'Connection flapping test',
        safetyNotes: '',
        geoTag: null,
      })
    );
    let retry = original;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      retry = scheduleOutboxRetry(retry, 'Connection dropped');
      assert.equal(retry.operationId, original.operationId);
      assert.equal(retry.idempotencyKey, original.idempotencyKey);
      assert.deepEqual(retry.payload, original.payload);
    }
  });

  it('has development-only deterministic storage-pressure and post-upload interruption gates', () => {
    const storage = readFileSync(new URL('./storage.ts', import.meta.url), 'utf8');
    const provider = readFileSync(
      new URL('../../components/providers/OfflineSyncProvider.tsx', import.meta.url),
      'utf8'
    );
    assert.match(storage, /NODE_ENV === 'development'[\s\S]*simulate-storage/);
    assert.match(provider, /NODE_ENV !== 'development'[\s\S]*simulate-photo-finalize-interruption/);
    assert.match(provider, /connection dropped after upload and before finalization/);
  });

  it('keeps quota-sensitive queue writes atomic so an aborted photo write cannot delete the draft', () => {
    const outbox = readFileSync(new URL('./outbox.ts', import.meta.url), 'utf8');
    assert.match(
      outbox,
      /database\.transaction\(\s*\[OFFLINE_STORES\.outbox, OFFLINE_STORES\.drafts, OFFLINE_STORES\.blobs\],\s*'readwrite'/
    );
    assert.match(outbox, /transaction\.onabort/);
    assert.match(outbox, /Daily-log queue transaction was interrupted/);
  });

  it('keeps permission failures visible instead of discarding local operations', () => {
    const provider = readFileSync(
      new URL('../../components/providers/OfflineSyncProvider.tsx', import.meta.url),
      'utf8'
    );
    const action = readFileSync(new URL('../actions/offline-sync.ts', import.meta.url), 'utf8');
    assert.match(action, /checkPermission/);
    assert.match(provider, /failOutboxOperation/);
    assert.match(provider, /RailCommand has not signed you out or deleted the local copy/);
  });
});

describe('service worker cache policy', () => {
  const serviceWorker = readFileSync(
    new URL('../../../public/sw.js', import.meta.url),
    'utf8'
  );

  it('does not pre-cache an authenticated dashboard route', () => {
    assert.doesNotMatch(serviceWorker, /PUBLIC_APP_SHELL\s*=\s*\[[\s\S]*["']\/dashboard["']/);
  });

  it('uses a neutral fallback for failed navigations', () => {
    assert.match(serviceWorker, /request\.mode === ["']navigate["']/);
    assert.match(serviceWorker, /fetch\(request, \{ cache: ["']no-store["'] \}\)/);
    assert.match(serviceWorker, /caches\.match\(["']\/offline\.html["']\)/);
  });

  it('limits runtime caching to same-origin public static files', () => {
    assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
    assert.match(serviceWorker, /url\.pathname\.startsWith\(["']\/_next\/static\/["']\)/);
  });

  it('pre-caches the public offline data reader without caching private records', () => {
    assert.match(serviceWorker, /["']\/offline-data\.js["']/);
    assert.doesNotMatch(serviceWorker, /project_members|daily_logs|indexedDB/);
  });
});

describe('Day 2 offline read security', () => {
  const offlineReader = readFileSync(
    new URL('../../../public/offline-data.js', import.meta.url),
    'utf8'
  );
  const offlineAction = readFileSync(
    new URL('../actions/offline.ts', import.meta.url),
    'utf8'
  );

  it('fails closed without the current signed-in database scope', () => {
    assert.match(offlineReader, /localStorage\.getItem\(SCOPE_KEY\)/);
    assert.match(offlineReader, /return null/);
    assert.doesNotMatch(offlineReader, /indexedDB\.databases/);
  });

  it('renders cached field values with textContent rather than HTML injection', () => {
    assert.match(offlineReader, /node\.textContent = text/);
    assert.doesNotMatch(offlineReader, /innerHTML/);
  });

  it('revalidates membership before building an offline snapshot', () => {
    assert.match(offlineAction, /getAuthenticatedUser\(supabase\)/);
    assert.match(offlineAction, /checkProjectMembership\(supabase, user\.id, projectId\)/);
    assert.match(offlineAction, /\.from\('project_members'\)/);
    assert.match(offlineAction, /\.from\('daily_logs'\)/);
  });
});

describe('offline asset routing policy', () => {
  const middleware = readFileSync(
    new URL('../../middleware.ts', import.meta.url),
    'utf8'
  );

  it('keeps the service worker and neutral fallback public', () => {
    assert.match(middleware, /pathname === ['"]\/sw\.js['"]/);
    assert.match(middleware, /pathname === ['"]\/offline\.html['"]/);
    assert.match(middleware, /pathname === ['"]\/offline-data\.js['"]/);
  });

  it('bypasses authentication middleware for offline bootstrap assets', () => {
    assert.equal(
      middleware.includes('_next/image|sw\\\\.js|offline\\\\.html|offline-data\\\\.js|favicon.ico'),
      true
    );
  });

  it('prevents authenticated HTML from being restored from the browser HTTP cache', () => {
    assert.match(middleware, /Cache-Control['"], ['"]private, no-store, max-age=0['"]/);
  });
});

describe('offline acceptance diagnostics security', () => {
  const diagnosticsPage = readFileSync(
    new URL('../../app/(app)/offline-acceptance/page.tsx', import.meta.url),
    'utf8'
  );
  const diagnosticsClient = readFileSync(
    new URL(
      '../../app/(app)/offline-acceptance/OfflineAcceptanceDiagnostics.tsx',
      import.meta.url
    ),
    'utf8'
  );

  it('requires a server-validated QA app_metadata claim', () => {
    assert.match(diagnosticsPage, /supabase\.auth\.getUser\(\)/);
    assert.match(diagnosticsPage, /user\.app_metadata\?\.railcommand_qa !== true/);
    assert.doesNotMatch(diagnosticsPage, /user\.user_metadata/);
  });

  it('checks only public static cache paths', () => {
    assert.match(diagnosticsClient, /railcommand-static-v8/);
    assert.match(diagnosticsClient, /pathname\.startsWith\('\/_next\/static\/'\)/);
    assert.doesNotMatch(diagnosticsClient, /localStorage/);
  });
});
