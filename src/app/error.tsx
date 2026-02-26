'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-rc-bg px-4">
      <div className="text-center max-w-md">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 mb-6">
          <AlertTriangle className="h-8 w-8 text-rc-red" />
        </div>

        <h1 className="font-heading text-2xl font-bold text-rc-navy mb-2">
          Something went wrong
        </h1>

        <p className="text-sm text-rc-steel mb-8">
          An unexpected error occurred. Our team has been notified. You can try
          again or head back to the dashboard.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={reset}
            className="bg-rc-orange hover:bg-rc-orange-dark text-white"
          >
            Try again
          </Button>
          <Button variant="outline" asChild>
            <a href="/dashboard">Go to Dashboard</a>
          </Button>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-rc-steel/60 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
