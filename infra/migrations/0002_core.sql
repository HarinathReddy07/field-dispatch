-- Core business tables: users, technicians, service_requests, assignments.
-- Money is stored as integer minor units (paise). All timestamps are timestamptz.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  password_hash text NOT NULL,
  role          text NOT NULL,
  name          text NOT NULL,
  rating        numeric(2,1) NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'ACTIVE',
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_chk   CHECK (role IN ('REQUESTER', 'TECHNICIAN', 'ADMIN')),
  CONSTRAINT users_status_chk CHECK (status IN ('ACTIVE', 'DISABLED')),
  CONSTRAINT users_rating_chk CHECK (rating >= 0 AND rating <= 5)
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE INDEX users_role_idx ON users (role);

CREATE TABLE technicians (
  user_id             uuid PRIMARY KEY REFERENCES users (id),
  service_categories  text[] NOT NULL,
  availability_status text NOT NULL DEFAULT 'OFFLINE',
  location            geography(Point, 4326),
  last_seen_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT technicians_availability_chk CHECK (availability_status IN ('AVAILABLE', 'BUSY', 'OFFLINE')),
  CONSTRAINT technicians_categories_chk CHECK (cardinality(service_categories) > 0)
);
CREATE INDEX technicians_location_gist ON technicians USING gist (location);
CREATE INDEX technicians_categories_gin ON technicians USING gin (service_categories);
CREATE INDEX technicians_availability_idx ON technicians (availability_status, last_seen_at);

CREATE TABLE service_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id        uuid NOT NULL REFERENCES users (id),
  category            text NOT NULL,
  asset_id            text NOT NULL,
  location            geography(Point, 4326) NOT NULL,
  window_start        timestamptz NOT NULL,
  window_end          timestamptz NOT NULL,
  notes               text,
  state               text NOT NULL DEFAULT 'CREATED',
  quote_minor         integer,
  version             integer NOT NULL DEFAULT 0,
  work_cycle          integer NOT NULL DEFAULT 1,
  started_at          timestamptz,
  review_deadline_at  timestamptz,
  reorder_of          uuid REFERENCES service_requests (id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sr_state_chk CHECK (state IN (
    'CREATED', 'MATCHING', 'ASSIGNED', 'ARRIVED', 'IN_PROGRESS',
    'UNDER_REVIEW', 'REWORK_REQUESTED', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT sr_category_chk CHECK (category IN ('ELECTRICAL_INSPECTION', 'MECHANICAL_INSPECTION')),
  CONSTRAINT sr_window_chk CHECK (window_end > window_start),
  CONSTRAINT sr_quote_chk CHECK (quote_minor IS NULL OR quote_minor > 0),
  CONSTRAINT sr_version_chk CHECK (version >= 0),
  CONSTRAINT sr_work_cycle_chk CHECK (work_cycle >= 1),
  CONSTRAINT sr_review_deadline_chk CHECK (state <> 'UNDER_REVIEW' OR review_deadline_at IS NOT NULL),
  CONSTRAINT sr_started_chk CHECK (state NOT IN ('IN_PROGRESS', 'UNDER_REVIEW') OR started_at IS NOT NULL),
  CONSTRAINT sr_quote_required_chk CHECK (
    state NOT IN ('ASSIGNED', 'ARRIVED', 'IN_PROGRESS', 'UNDER_REVIEW', 'REWORK_REQUESTED', 'COMPLETED')
    OR quote_minor IS NOT NULL)
);
CREATE INDEX sr_requester_idx ON service_requests (requester_id, created_at DESC);
CREATE INDEX sr_state_idx ON service_requests (state, updated_at DESC);
CREATE INDEX sr_location_gist ON service_requests USING gist (location);
CREATE INDEX sr_reorder_of_idx ON service_requests (reorder_of);
-- Sweeper index: only rows waiting for review.
CREATE INDEX sr_review_deadline_idx ON service_requests (review_deadline_at) WHERE state = 'UNDER_REVIEW';

CREATE TABLE assignments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    uuid NOT NULL REFERENCES service_requests (id),
  technician_id uuid NOT NULL REFERENCES technicians (user_id),
  status        text NOT NULL DEFAULT 'ACTIVE',
  time_window   tstzrange NOT NULL,
  quote_minor   integer NOT NULL,
  confirmed_at  timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  end_reason    text,
  CONSTRAINT assignments_status_chk CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'REASSIGNED')),
  CONSTRAINT assignments_quote_chk CHECK (quote_minor > 0),
  CONSTRAINT assignments_window_chk CHECK (NOT isempty(time_window)),
  -- A technician can hold at most one active assignment at a time.
  -- (Partial unique indexes can't be declared as table constraints.)
  CONSTRAINT assignments_no_overlap EXCLUDE USING gist (
    technician_id WITH =, time_window WITH &&
  ) WHERE (status = 'ACTIVE')
);
CREATE UNIQUE INDEX assignments_active_technician_uq ON assignments (technician_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX assignments_active_request_uq ON assignments (request_id) WHERE status = 'ACTIVE';
CREATE INDEX assignments_request_idx ON assignments (request_id);
CREATE INDEX assignments_technician_idx ON assignments (technician_id, status);
