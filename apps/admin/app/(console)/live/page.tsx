import { Suspense } from 'react';
import { LiveBoard } from '@/components/live-board';
import { Skeleton } from '@/components/ui';

export default function LivePage() {
  // useSearchParams (the ?job= deep link) needs a Suspense boundary
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <LiveBoard />
    </Suspense>
  );
}
