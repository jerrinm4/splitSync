-- Enable pgcrypto (idempotent; Supabase installs it in the extensions schema)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL CHECK (char_length(name) > 0),
  note TEXT,
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
  share_token TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  share_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_dates CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

CREATE INDEX idx_trips_owner ON trips(owner_id);
CREATE INDEX idx_trips_share_token ON trips(share_token) WHERE share_enabled = TRUE;

CREATE TABLE trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(name) > 0),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_members_trip ON trip_members(trip_id);

CREATE TABLE fund_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('ADD', 'REMOVE')),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'VOIDED')),
  idempotency_key UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_fund_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX idx_fund_tx_trip ON fund_transactions(trip_id);
CREATE INDEX idx_fund_tx_member ON fund_transactions(member_id);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(title) > 0),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  expense_date DATE NOT NULL,
  payment_source TEXT NOT NULL CHECK (payment_source IN ('TRIP_WALLET', 'MEMBER')),
  paid_by_member_id UUID REFERENCES trip_members(id) ON DELETE RESTRICT,
  split_method TEXT NOT NULL CHECK (split_method IN ('EQUAL', 'CUSTOM')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'VOIDED')),
  version INTEGER NOT NULL DEFAULT 1,
  idempotency_key UUID NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_payment_source CHECK (
    (payment_source = 'MEMBER' AND paid_by_member_id IS NOT NULL) OR
    (payment_source = 'TRIP_WALLET' AND paid_by_member_id IS NULL)
  ),
  CONSTRAINT uq_expense_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX idx_expenses_trip ON expenses(trip_id);
CREATE INDEX idx_expenses_payer ON expenses(paid_by_member_id);

CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE RESTRICT,
  member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE RESTRICT,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_expense_member UNIQUE (expense_id, member_id)
);

CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX idx_expense_splits_member ON expense_splits(member_id);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_trip ON audit_logs(trip_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(trip_id, created_at DESC);
