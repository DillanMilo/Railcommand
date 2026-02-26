import LoadingState from '@/components/shared/LoadingState';
import { Skeleton } from '@/components/ui/skeleton';

export default function AppLoading() {
  return (
    <div className="space-y-6">
      {/* Page title skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Card grid skeleton */}
      <LoadingState variant="cards" />
    </div>
  );
}
