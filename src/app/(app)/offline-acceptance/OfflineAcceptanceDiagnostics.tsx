'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getOfflineDatabaseName } from '@/lib/offline/storage';

const PUBLIC_CACHE_NAME = 'railcommand-static-v10';
const PUBLIC_CACHE_PATHS = new Set([
  '/offline.html',
  '/offline-data.js',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.json',
]);

type CheckStatus = 'checking' | 'pass' | 'fail' | 'unsupported';

type Diagnostics = {
  activeProjectId: string | null;
  cacheEntries: string[];
  cacheNames: string[];
  cacheStatus: CheckStatus;
  controllerStatus: CheckStatus;
  databaseCount: number;
  databaseStatus: CheckStatus;
  expectedDatabasePresent: boolean;
  registrationStatus: CheckStatus;
  dayTwoRecordTypes: string[];
  dayTwoStatus: CheckStatus;
  unsafeCacheEntries: string[];
};

const initialDiagnostics: Diagnostics = {
  activeProjectId: null,
  cacheEntries: [],
  cacheNames: [],
  cacheStatus: 'checking',
  controllerStatus: 'checking',
  databaseCount: 0,
  databaseStatus: 'checking',
  expectedDatabasePresent: false,
  registrationStatus: 'checking',
  dayTwoRecordTypes: [],
  dayTwoStatus: 'checking',
  unsafeCacheEntries: [],
};

function isAllowedCachePath(pathname: string): boolean {
  return PUBLIC_CACHE_PATHS.has(pathname) || pathname.startsWith('/_next/static/');
}

function Status({ value }: { value: CheckStatus }) {
  const colors: Record<CheckStatus, string> = {
    checking: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    fail: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    pass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    unsupported: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${colors[value]}`}>
      {value}
    </span>
  );
}

function inspectOfflineDatabase(databaseName: string): Promise<{
  activeProjectId: string | null;
  recordTypes: string[];
}> {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(databaseName);
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onsuccess = () => {
      const database = openRequest.result;
      if (
        !database.objectStoreNames.contains('metadata') ||
        !database.objectStoreNames.contains('records')
      ) {
        database.close();
        resolve({ activeProjectId: null, recordTypes: [] });
        return;
      }

      const transaction = database.transaction(['metadata', 'records'], 'readonly');
      const activeProjectRequest = transaction.objectStore('metadata').get('active_project_id');
      const recordsRequest = transaction.objectStore('records').getAll();
      transaction.oncomplete = () => {
        const activeProjectId = activeProjectRequest.result?.value ?? null;
        const recordTypes = (recordsRequest.result as { entityType?: string; projectId?: string }[])
          .filter((record) => !activeProjectId || record.projectId === activeProjectId)
          .map((record) => record.entityType)
          .filter((value): value is string => Boolean(value));
        database.close();
        resolve({ activeProjectId, recordTypes: [...new Set(recordTypes)].sort() });
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    };
  });
}

export default function OfflineAcceptanceDiagnostics({ userId }: { userId: string }) {
  const [diagnostics, setDiagnostics] = useState(initialDiagnostics);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const expectedDatabaseName = getOfflineDatabaseName(userId);
    const registration = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration()
      : undefined;
    const controller = 'serviceWorker' in navigator
      ? navigator.serviceWorker.controller
      : null;

    const railCommandCacheNames = typeof caches === 'undefined'
      ? []
      : (await caches.keys()).filter((name) => name.startsWith('railcommand-'));
    const cacheEntries: string[] = [];

    for (const cacheName of railCommandCacheNames) {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();
      cacheEntries.push(...requests.map((request) => new URL(request.url).pathname));
    }

    const unsafeCacheEntries = cacheEntries.filter((pathname) => !isAllowedCachePath(pathname));

    let databaseStatus: CheckStatus = 'unsupported';
    let databaseCount = 0;
    let expectedDatabasePresent = false;
    let activeProjectId: string | null = null;
    let dayTwoRecordTypes: string[] = [];

    if (typeof indexedDB.databases === 'function') {
      const databases = await indexedDB.databases();
      const railCommandDatabases = databases.filter(
        (database) => database.name?.startsWith('railcommand-offline:')
      );
      databaseCount = railCommandDatabases.length;
      expectedDatabasePresent = railCommandDatabases.some(
        (database) => database.name === expectedDatabaseName
      );
      databaseStatus = databaseCount === 1 && expectedDatabasePresent ? 'pass' : 'fail';
      if (expectedDatabasePresent) {
        const inspection = await inspectOfflineDatabase(expectedDatabaseName);
        activeProjectId = inspection.activeProjectId;
        dayTwoRecordTypes = inspection.recordTypes;
      }
    }

    const onlyPublicCache =
      railCommandCacheNames.length === 1 && railCommandCacheNames[0] === PUBLIC_CACHE_NAME;

    setDiagnostics({
      activeProjectId,
      cacheEntries: [...new Set(cacheEntries)].sort(),
      cacheNames: railCommandCacheNames,
      cacheStatus: onlyPublicCache && unsafeCacheEntries.length === 0 ? 'pass' : 'fail',
      controllerStatus:
        controller?.state === 'activated' && controller.scriptURL.endsWith('/sw.js') ? 'pass' : 'fail',
      databaseCount,
      databaseStatus,
      expectedDatabasePresent,
      registrationStatus:
        registration?.active?.state === 'activated' &&
        registration.active.scriptURL.endsWith('/sw.js')
          ? 'pass'
          : 'fail',
      dayTwoRecordTypes,
      dayTwoStatus:
        databaseStatus === 'unsupported'
          ? 'unsupported'
          : activeProjectId &&
              ['daily_logs', 'project', 'project_members'].every((type) =>
                dayTwoRecordTypes.includes(type)
              )
            ? 'pass'
            : 'fail',
      unsafeCacheEntries,
    });
    setCheckedAt(new Date().toISOString());
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 sm:p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-rc-orange">QA only</p>
        <h1 className="mt-1 text-2xl font-bold">Offline acceptance diagnostics</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Online-only inspection of this QA user&apos;s service worker, public cache, and
          user-scoped IndexedDB. No project records are changed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Service-worker controller</h2>
            <Status value={diagnostics.controllerStatus} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            The current page must be controlled by the activated public worker.
          </p>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Active registration</h2>
            <Status value={diagnostics.registrationStatus} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            The active registration must resolve to <code>/sw.js</code>.
          </p>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Public cache boundary</h2>
            <Status value={diagnostics.cacheStatus} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Expected cache: <code>{PUBLIC_CACHE_NAME}</code>. Authenticated routes and API
            responses are forbidden.
          </p>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Current-user database</h2>
            <Status value={diagnostics.databaseStatus} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            RailCommand databases: {diagnostics.databaseCount}. Current QA scope present:{' '}
            {diagnostics.expectedDatabasePresent ? 'yes' : 'no'}.
          </p>
        </section>

        <section className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Day 2 project snapshot</h2>
            <Status value={diagnostics.dayTwoStatus} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Active project: {diagnostics.activeProjectId ?? 'none'}. Records:{' '}
            {diagnostics.dayTwoRecordTypes.join(', ') || 'none'}.
          </p>
        </section>
      </div>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="font-semibold">Observed Cache Storage</h2>
        <p className="mt-2 text-sm">Caches: {diagnostics.cacheNames.join(', ') || 'none'}</p>
        <ul className="mt-3 max-h-64 space-y-1 overflow-auto font-mono text-xs text-muted-foreground">
          {diagnostics.cacheEntries.map((entry) => <li key={entry}>{entry}</li>)}
        </ul>
        {diagnostics.unsafeCacheEntries.length > 0 && (
          <p className="mt-3 text-sm font-semibold text-red-600">
            Unsafe entries: {diagnostics.unsafeCacheEntries.join(', ')}
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void refresh()}>Refresh diagnostics</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.dispatchEvent(new Event('offline'))}
        >
          Simulate offline signal
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => window.dispatchEvent(new Event('online'))}
        >
          Restore online signal
        </Button>
        {checkedAt && <p className="text-xs text-muted-foreground">Checked {checkedAt}</p>}
      </div>
    </main>
  );
}
