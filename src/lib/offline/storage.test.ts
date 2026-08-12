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
} from './storage';
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
    assert.equal(isRailCommandCacheName('railcommand-static-v6'), true);
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
    assert.match(diagnosticsClient, /railcommand-static-v6/);
    assert.match(diagnosticsClient, /pathname\.startsWith\('\/_next\/static\/'\)/);
    assert.doesNotMatch(diagnosticsClient, /localStorage/);
  });
});
