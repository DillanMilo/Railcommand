import LoadingState from '@/components/shared/LoadingState';
import { Skeleton } from '@/components/ui/skeleton';

export default function SubmittalsLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-64 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>

      {/* Table skeleton */}
      <LoadingState variant="table" />
    </div>
  );
}
