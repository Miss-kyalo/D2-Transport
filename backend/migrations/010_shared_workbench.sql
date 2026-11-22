ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Storekeeper';

ALTER TABLE garage_work_orders
    ADD COLUMN IF NOT EXISTS bay_id INTEGER REFERENCES garage_bays(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30),
    ADD COLUMN IF NOT EXISTS driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE stock_movements
    ADD COLUMN IF NOT EXISTS work_order_id INTEGER REFERENCES garage_work_orders(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS garage_part_requests (
    id BIGSERIAL PRIMARY KEY,
    work_order_id INTEGER NOT NULL REFERENCES garage_work_orders(id) ON DELETE RESTRICT,
    item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    qty INTEGER NOT NULL CHECK (qty > 0),
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Reserved', 'Issued', 'Rejected')),
    requested_by INTEGER NOT NULL REFERENCES users(id),
    reviewed_by INTEGER REFERENCES users(id),
    issued_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    issued_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_garage_part_requests_work_order ON garage_part_requests(work_order_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_work_order ON stock_movements(work_order_id);
