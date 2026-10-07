-- OTP, evidence, settlement, auth tokens, idempotency and outbox.

CREATE TABLE otp_challenges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES service_requests (id),
  assignment_id uuid NOT NULL REFERENCES assignments (id),
  otp_hmac      text NOT NULL,            -- HMAC-SHA256 only; the plain OTP is never persisted
  expires_at    timestamptz NOT NULL,
  consumed_at   timestamptz,
  superseded_at timestamptz,
  attempts      integer NOT NULL DEFAULT 0,
  locked_until  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT otp_attempts_chk CHECK (attempts >= 0)
);
-- Only one live challenge per request.
CREATE UNIQUE INDEX otp_live_request_uq ON otp_challenges (request_id)
  WHERE consumed_at IS NULL AND superseded_at IS NULL;
CREATE INDEX otp_assignment_idx ON otp_challenges (assignment_id);

CREATE TABLE evidence_media (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      uuid NOT NULL REFERENCES service_requests (id),
  work_cycle      integer NOT NULL,
  uploader_id     uuid NOT NULL REFERENCES users (id),
  object_key      text NOT NULL,
  content_type    text NOT NULL,
  size_bytes      integer NOT NULL,
  checksum_sha256 text NOT NULL,
  status          text NOT NULL DEFAULT 'PENDING',
  created_at      timestamptz NOT NULL DEFAULT now(),
  finalized_at    timestamptz,
  CONSTRAINT evidence_status_chk CHECK (status IN ('PENDING', 'FINALIZED')),
  CONSTRAINT evidence_size_chk CHECK (size_bytes > 0),
  CONSTRAINT evidence_finalized_chk CHECK (status <> 'FINALIZED' OR finalized_at IS NOT NULL)
);
CREATE UNIQUE INDEX evidence_object_key_uq ON evidence_media (object_key);
CREATE INDEX evidence_request_cycle_idx ON evidence_media (request_id, work_cycle, status);
CREATE INDEX evidence_uploader_idx ON evidence_media (uploader_id);

CREATE TABLE settlements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       uuid NOT NULL REFERENCES service_requests (id),
  amount_minor     integer NOT NULL,
  currency         text NOT NULL DEFAULT 'INR',
  idempotency_key  text NOT NULL,
  status           text NOT NULL DEFAULT 'SETTLED',
  provider_ref     text NOT NULL,         -- reference from the MOCK payment provider
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settlements_request_uq UNIQUE (request_id),
  CONSTRAINT settlements_idem_uq UNIQUE (idempotency_key),
  CONSTRAINT settlements_amount_chk CHECK (amount_minor > 0),
  CONSTRAINT settlements_status_chk CHECK (status IN ('PENDING', 'SETTLED', 'FAILED'))
);

CREATE TABLE refresh_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users (id),
  family_id   uuid NOT NULL,
  token_hash  text NOT NULL,
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  replaced_by uuid REFERENCES refresh_tokens (id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refresh_token_hash_uq UNIQUE (token_hash)
);
CREATE INDEX refresh_user_idx ON refresh_tokens (user_id);
CREATE INDEX refresh_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_replaced_idx ON refresh_tokens (replaced_by);

CREATE TABLE idempotency_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           text NOT NULL,          -- "<userId>:<METHOD> <route template>:<resourceId>"
  key             text NOT NULL,
  request_hash    text NOT NULL,
  response_status integer NOT NULL,
  response_body   jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT idempotency_scope_key_uq UNIQUE (scope, key)
);
CREATE INDEX idempotency_created_idx ON idempotency_keys (created_at);

CREATE TABLE outbox_events (
  seq          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id     uuid NOT NULL DEFAULT gen_random_uuid(),
  type         text NOT NULL,
  request_id   uuid REFERENCES service_requests (id),
  rooms        text[] NOT NULL,
  payload      jsonb NOT NULL,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT outbox_event_id_uq UNIQUE (event_id)
);
CREATE INDEX outbox_unpublished_idx ON outbox_events (seq) WHERE published_at IS NULL;
CREATE INDEX outbox_request_idx ON outbox_events (request_id, seq);
