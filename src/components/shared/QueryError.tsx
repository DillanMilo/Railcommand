import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export default function QueryError({
  message = "Couldn't load data",
  onRetry,
}: QueryErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-rc-border bg-rc-card py-8 sm:py-16 px-4 text-center">
      <div className="flex items-center justify-center size-12 sm:size-16 rounded-full bg-red-50 dark:bg-red-950/30 mb-4 sm:mb-6">
        <AlertTriangle className="size-6 sm:size-8 text-red-500" />
      </div>

      <h3 className="font-heading text-lg font-semibold text-foreground mb-2">
        {message}
      </h3>

      <p className="text-sm text-rc-steel max-w-sm mb-4 sm:mb-6">
        Check your connection and try again.
      </p>

      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="size-4" /> Retry
        </Button>
      )}
    </div>
  );
}
