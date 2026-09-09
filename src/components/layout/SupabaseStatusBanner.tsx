'use client';

import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWA } from '@/components/providers/ServiceWorkerProvider';

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function SupabaseStatusBanner() {
  const {
    connectivityStatus,
    lastConnectedAt,
    lastSyncedAt,
    retryConnectivity,
  } = usePWA();

  if (connectivityStatus !== 'offline') return null;

  const lastSync = formatTimestamp(lastSyncedAt);
  const lastConnection = formatTimestamp(lastConnectedAt);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] px-3 sm:px-4" aria-live="polite">
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-50">
        <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">RailCommand is offline</p>
          <p className="mt-0.5 text-xs leading-5 text-amber-900 dark:text-amber-100">
            The service could not be reached. Reconnect before submitting new work.
          </p>
          <div className="mt-2 text-xs leading-5 text-amber-900 dark:text-amber-100">
            {lastSync ? <p>Last project refresh: {lastSync}</p> : <p>No project refresh has been recorded on this device.</p>}
            {lastConnection && <p>Last connected: {lastConnection}</p>}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 border-amber-400 bg-white/70 text-amber-950 hover:bg-amber-100 dark:border-amber-400/50 dark:bg-amber-950 dark:text-amber-50 dark:hover:bg-amber-900"
            onClick={() => void retryConnectivity()}
          >
            <RefreshCw />
            Retry connection
          </Button>
        </div>
      </div>
    </div>
  );
}
