'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '../ui';

export type { MapTechItem, MapRequestItem } from './site-map';

/** Leaflet touches `window`, so the map is loaded on the client only. */
export const SiteMap = dynamic(() => import('./site-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-[260px] w-full rounded-xl" />,
});
