CREATE TABLE IF NOT EXISTS mpesa_payments (
  id BIGSERIAL PRIMARY KEY,
  job_card_id BIGINT NOT NULL REFERENCES job_cards(id) ON DELETE RESTRICT,
  checkout_request_id TEXT UNIQUE NOT NULL,
  mpesa_receipt_number TEXT UNIQUE,
  phone_number TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED')),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mpesa_payments_job_card_id ON mpesa_payments(job_card_id);