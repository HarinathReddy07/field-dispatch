import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateRequestDto,
  EvidenceIntentDto,
  EvidenceIntentResponse,
  NearbyTechnician,
  OtpResponse,
  RequestView,
  ReviewDto,
} from '@dispatch/contracts';
import type { EvidenceItem } from '@dispatch/contracts';
import { ApiError } from './client';
import { api, uuid } from './instance';
import { serverOffsetMs } from '../lib/timer';

/** A request plus the client-side receipt time, so timers can be driven by the SERVER clock offset. */
export type LiveRequest = RequestView & { offsetMs: number };

const withOffset = (v: RequestView, receivedAt: number): LiveRequest => ({
  ...v,
  offsetMs: serverOffsetMs(v.serverTime, receivedAt),
});

export const keys = {
  request: (id: string) => ['request', id] as const,
  active: ['active'] as const,
  history: ['history'] as const,
  nearby: (id: string) => ['nearby', id] as const,
  evidence: (id: string) => ['evidence', id] as const,
};

export function useRequest(id: string) {
  return useQuery({
    queryKey: keys.request(id),
    queryFn: async () => withOffset(await api.get<RequestView>(`requests/${id}`), Date.now()),
  });
}

export const useActive = () =>
  useQuery({ queryKey: keys.active, queryFn: () => api.get<RequestView[]>('requests/active') });

export const useHistory = () =>
  useQuery({ queryKey: keys.history, queryFn: () => api.get<RequestView[]>('requests/history') });

export const useEvidence = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.evidence(id),
    queryFn: () => api.get<EvidenceItem[]>(`requests/${id}/evidence`),
    enabled,
  });

export const useNearby = (id: string, enabled = true) =>
  useQuery({
    queryKey: keys.nearby(id),
    queryFn: () => api.get<NearbyTechnician[]>(`requests/${id}/nearby-technicians`),
    enabled,
  });

/**
 * Mutation that keeps ONE Idempotency-Key per user intent. If the call fails in a way where the outcome is unknown
 * (network error / 5xx) the same key is reused on the next tap, so the server replays instead of repeating the action.
 * The key is dropped after success or a definite 4xx rejection.
 */
export function useKeyedMutation<TVars, TData>(
  run: (vars: TVars, key: string) => Promise<TData>,
  invalidate: (qc: ReturnType<typeof useQueryClient>, data: TData, vars: TVars) => void = () => undefined,
) {
  const qc = useQueryClient();
  const keyRef = useRef<string | null>(null);
  return useMutation<TData, ApiError, TVars>({
    mutationFn: (vars) => run(vars, (keyRef.current ??= uuid())),
    onSuccess: (data, vars) => {
      keyRef.current = null;
      invalidate(qc, data, vars);
    },
    onError: (e) => {
      const unknownOutcome = e.isNetwork || e.status >= 500;
      if (!unknownOutcome) keyRef.current = null;
    },
  });
}

const refresh = (qc: ReturnType<typeof useQueryClient>, id?: string) => {
  if (id) void qc.invalidateQueries({ queryKey: keys.request(id) });
  void qc.invalidateQueries({ queryKey: keys.active });
  void qc.invalidateQueries({ queryKey: keys.history });
};

export const useCreateRequest = () => {
  const qc = useQueryClient();
  return useMutation<RequestView, ApiError, CreateRequestDto>({
    mutationFn: (dto) => api.post<RequestView>('requests', dto),
    onSuccess: (v) => refresh(qc, v.id),
  });
};

export const useConfirm = (id: string) =>
  useKeyedMutation(
    (technicianId: string, key) =>
      api.post<RequestView>(`requests/${id}/confirm`, { technicianId }, { idempotencyKey: key }),
    (qc) => refresh(qc, id),
  );

export const useIssueOtp = (id: string) =>
  useMutation<OtpResponse, ApiError, void>({ mutationFn: () => api.post<OtpResponse>(`requests/${id}/otp`) });

export const useArrive = (id: string) =>
  useKeyedMutation(
    (otp: string, key) => api.post<RequestView>(`requests/${id}/arrive`, { otp }, { idempotencyKey: key }),
    (qc) => refresh(qc, id),
  );

export const useStart = (id: string) =>
  useKeyedMutation(
    (_: void, key) => api.post<RequestView>(`requests/${id}/start`, {}, { idempotencyKey: key }),
    (qc) => refresh(qc, id),
  );

export const useStop = (id: string) =>
  useKeyedMutation(
    (_: void, key) => api.post<RequestView>(`requests/${id}/stop`, {}, { idempotencyKey: key }),
    (qc) => refresh(qc, id),
  );

export const useReview = (id: string) =>
  useKeyedMutation(
    (dto: ReviewDto, key) => api.post<RequestView>(`requests/${id}/review`, dto, { idempotencyKey: key }),
    (qc) => refresh(qc, id),
  );

export const useCancel = (id: string) =>
  useKeyedMutation(
    (_: void, key) => api.post<RequestView>(`requests/${id}/cancel`, {}, { idempotencyKey: key }),
    (qc) => refresh(qc, id),
  );

export const useReorder = () => {
  const qc = useQueryClient();
  return useMutation<RequestView, ApiError, string>({
    mutationFn: (id) => api.post<RequestView>(`requests/${id}/reorder`),
    onSuccess: (v) => refresh(qc, v.id),
  });
};

export const useAvailability = () => {
  const qc = useQueryClient();
  return useMutation<{ status: string }, ApiError, 'AVAILABLE' | 'OFFLINE'>({
    mutationFn: (status) => api.patch<{ status: string }>('technicians/me/availability', { status }),
    onSuccess: () => refresh(qc),
  });
};

export const evidenceIntent = (id: string, dto: EvidenceIntentDto) =>
  api.post<EvidenceIntentResponse>(`requests/${id}/evidence/intent`, dto);

export const finalizeEvidence = (id: string, mediaId: string, key: string) =>
  api.post<{ mediaId: string; status: string; finalizedCount: number }>(
    `requests/${id}/evidence`,
    { mediaId },
    { idempotencyKey: key },
  );

export const pingLocation = (lat: number, lon: number) => api.post('technicians/me/location', { lat, lon });

export type { CreateRequestDto };
