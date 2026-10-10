'use client';

import type { EventEnvelope, EvidenceItem, RequestView } from '@dispatch/contracts';
import { useLiveRefresh } from '@/components/live-provider';
import { useQuery, type QueryState } from './use-query';

/** One request (as the signed-in user may see it), refreshed whenever a live event for it arrives. */
export function useRequestView(id: string): QueryState<RequestView> {
  const q = useQuery<RequestView>(`requests/${id}`);
  const { refetch } = q;
  useLiveRefresh(refetch, (e) => e.requestId === id);
  return q;
}

/** The request's activity as the signed-in user may see it (for the timeline and the rework reason). */
export function useRequestEvents(id: string): QueryState<{ events: EventEnvelope[] }> {
  const q = useQuery<{ events: EventEnvelope[] }>(`requests/${id}/snapshot?since=0`);
  const { refetch } = q;
  useLiveRefresh(refetch, (e) => e.requestId === id);
  return q;
}

/** Finalized evidence with short-lived signed URLs. Pass `enabled=false` to hold the fetch until it is needed. */
export function useEvidence(id: string, enabled: boolean): QueryState<EvidenceItem[]> {
  const q = useQuery<EvidenceItem[]>(enabled ? `requests/${id}/evidence` : null);
  const { refetch } = q;
  useLiveRefresh(refetch, (e) => e.requestId === id && e.type === 'evidence.uploaded');
  return q;
}
