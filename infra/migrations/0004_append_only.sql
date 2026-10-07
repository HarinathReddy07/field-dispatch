-- Append-only evidence tables: job_events and audit_logs.
-- UPDATE/DELETE/TRUNCATE are blocked by triggers (rule 11).

CREATE TABLE job_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq            bigint GENERATED ALWAYS AS IDENTITY,
  request_id     uuid NOT NULL REFERENCES service_requests (id),
  state_from     text,
  state_to       text NOT NULL,
  action         text NOT NULL,
  actor_id       uuid REFERENCES users (id),
  actor_role     text NOT NULL,
  reason         text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_events_state_to_chk CHECK (state_to IN (
    'CREATED', 'MATCHING', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS',
    'UNDER_REVIEW', 'REWORK_REQUESTED', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT job_events_actor_role_chk CHECK (actor_role IN ('REQUESTER', 'TECHNICIAN', 'ADMIN', 'SYSTEM'))
);
CREATE UNIQUE INDEX job_events_seq_uq ON job_events (seq);
CREATE INDEX job_events_request_idx ON job_events (request_id, seq);
CREATE INDEX job_events_actor_idx ON job_events (actor_id);

CREATE TABLE audit_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq            bigint GENERATED ALWAYS AS IDENTITY,
  actor_id       uuid REFERENCES users (id),
  actor_role     text NOT NULL,
  action         text NOT NULL,
  entity_type    text NOT NULL,
  entity_id      text NOT NULL,
  request_id     uuid REFERENCES service_requests (id),
  correlation_id text,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_actor_role_chk CHECK (actor_role IN ('REQUESTER', 'TECHNICIAN', 'ADMIN', 'SYSTEM', 'ANONYMOUS'))
);
CREATE UNIQUE INDEX audit_logs_seq_uq ON audit_logs (seq);
CREATE INDEX audit_logs_actor_idx ON audit_logs (actor_id, seq DESC);
CREATE INDEX audit_logs_request_idx ON audit_logs (request_id, seq DESC);
CREATE INDEX audit_logs_action_idx ON audit_logs (action, seq DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs (entity_type, entity_id);

CREATE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (% blocked)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER job_events_append_only
  BEFORE UPDATE OR DELETE ON job_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER job_events_no_truncate
  BEFORE TRUNCATE ON job_events
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
