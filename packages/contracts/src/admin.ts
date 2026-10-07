import type { RequestState, SettlementStatus } from './enums';
import type { RequestView } from './dto';

/** Server-defined exception flags (computed by the API, never by clients). */
export type ExceptionFlag =
  'NO_TECHNICIAN' | 'TECHNICIAN_STALE' | 'REVIEW_OVERDUE' | 'REWORK_OPEN' | 'MULTIPLE_REWORKS';

export interface AdminJobItem extends RequestView {
  exceptionFlags: ExceptionFlag[];
  technicianLocation: { lat: number; lon: number; lastSeenAt: string | null } | null;
  elapsedSeconds: number | null;
}

export interface AdminJobsResponse {
  items: AdminJobItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminSummary {
  countsByState: Partial<Record<RequestState, number>>;
  activeRequests: number;
  activeTechnicians: number;
  exceptionCount: number;
}

export interface AdminTechnician {
  id: string;
  name: string;
  rating: number;
  availability_status: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
  service_categories: string[];
  last_seen_at: string | null;
  lat: number | null;
  lon: number | null;
  current_request_id: string | null;
  fresh: boolean;
}

export interface JobEventRow {
  seq: number;
  state_from: RequestState | null;
  state_to: RequestState;
  action: string;
  actor_id: string | null;
  actor_role: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

export interface AuditRow {
  seq: number;
  id?: string;
  actor_id: string | null;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  request_id?: string | null;
  correlation_id?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AssignmentRow {
  id: string;
  technician_id: string;
  technician_name: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'REASSIGNED';
  quote_minor: number;
  confirmed_at: string;
  ended_at: string | null;
  end_reason: string | null;
}

export interface EvidenceItem {
  id: string;
  workCycle: number;
  contentType: string;
  sizeBytes: number;
  finalizedAt: string;
  url: string;
  expiresAt: string;
}

export interface AdminJobDetail {
  job: AdminJobItem;
  events: JobEventRow[];
  audit: AuditRow[];
  assignments: AssignmentRow[];
  evidence: EvidenceItem[];
}

export interface AuditResponse {
  items: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
}

export type { SettlementStatus };
