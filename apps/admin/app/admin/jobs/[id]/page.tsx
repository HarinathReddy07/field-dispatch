'use client';

import { useParams } from 'next/navigation';
import { JobDrawer } from '@/components/job-drawer';

/** Shareable full-page version of the job drawer: timeline, evidence, settlement, audit and the admin actions. */
export default function AdminJobPage() {
  const { id } = useParams<{ id: string }>();
  return <JobDrawer id={id} mode="page" />;
}
