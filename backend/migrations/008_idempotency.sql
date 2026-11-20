ALTER TABLE inspection_pins_3d
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;

ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;