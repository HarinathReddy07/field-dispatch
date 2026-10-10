import { Skeleton } from '@/components/ui';

export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading operations board">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="h-80 w-full rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-full rounded" />
        <Skeleton className="h-14 w-full rounded" />
        <Skeleton className="h-14 w-full rounded" />
        <Skeleton className="h-14 w-full rounded" />
      </div>
    </div>
  );
}
