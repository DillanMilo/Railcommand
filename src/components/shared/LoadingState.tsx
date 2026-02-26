import { Skeleton } from '@/components/ui/skeleton';

interface LoadingStateProps {
  variant?: 'cards' | 'table' | 'detail';
}

function CardsLoading() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-rc-border bg-rc-card p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableLoading() {
  return (
    <div className="rounded-lg border border-rc-border bg-rc-card overflow-hidden">
      {/* Table header */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-rc-border bg-muted/30">
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-24 hidden md:block" />
        <Skeleton className="h-4 w-20 hidden md:block" />
        <Skeleton className="h-4 w-16 ml-auto" />
      </div>
      {/* Table rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3.5 border-b border-rc-border last:border-b-0"
        >
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-24 hidden md:block" />
          <Skeleton className="h-4 w-20 hidden md:block" />
          <Skeleton className="h-5 w-16 rounded-full ml-auto" />
        </div>
      ))}
    </div>
  );
}

function DetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Content blocks */}
      <div className="rounded-lg border border-rc-border bg-rc-card p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="rounded-lg border border-rc-border bg-rc-card p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoadingState({ variant = 'cards' }: LoadingStateProps) {
  switch (variant) {
    case 'table':
      return <TableLoading />;
    case 'detail':
      return <DetailLoading />;
    case 'cards':
    default:
      return <CardsLoading />;
  }
}
