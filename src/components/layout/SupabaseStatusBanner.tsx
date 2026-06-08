'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  checkSupabaseConnectivity,
  SUPABASE_CONNECTION_ERROR,
} from '@/lib/supabase/connectivity';

const CHECK_INTERVAL_MS = 60_000;

type ConnectivityState = 'idle' | 'checking' | 'online' | 'offline';

export default function SupabaseStatusBanner() {
  const [status, setStatus] = useState<ConnectivityState>('idle');
  const [dismissed, setDismissed] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setStatus((current) => (current === 'offline' ? 'offline' : 'checking'));
    const result = await checkSupabaseConnectivity();

    setLastChecked(result.checkedAt);
    setStatus(result.ok ? 'online' : 'offline');
    if (result.ok) {
      setDismissed(false);
    }
  }, []);

  useEffect(() => {
    void runCheck();

    const interval = window.setInterval(() => {
      void runCheck();
    }, CHECK_INTERVAL_MS);

    window.addEventListener('online', runCheck);
    window.addEventListener('focus', runCheck);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('online', runCheck);
      window.removeEventListener('focus', runCheck);
    };
  }, [runCheck]);

  if (status !== 'offline' || dismissed) {
    return null;
  }

  const checkedTime = lastChecked
    ? new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(lastChecked))
    : null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] px-3 sm:px-4" aria-live="polite">
      <div className="pointer-events-auto mx-auto flex max-w-3xl items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-lg dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-50">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Supabase connection issue</p>
          <p className="mt-0.5 text-xs leading-5 text-amber-900 dark:text-amber-100">
            {SUPABASE_CONNECTION_ERROR}
            {checkedTime ? ` Last checked ${checkedTime}.` : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-amber-950 hover:bg-amber-100 dark:text-amber-50 dark:hover:bg-amber-900"
          onClick={() => void runCheck()}
          aria-label="Retry Supabase connection check"
        >
          <RefreshCw className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-amber-950 hover:bg-amber-100 dark:text-amber-50 dark:hover:bg-amber-900"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss Supabase connection alert"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
