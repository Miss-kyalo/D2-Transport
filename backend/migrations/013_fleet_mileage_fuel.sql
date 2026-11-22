CREATE TABLE IF NOT EXISTS daily_fleet_mileage (
    id SERIAL PRIMARY KEY,
    log_date DATE NOT NULL,
    truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
    opening_km NUMERIC(12, 1) NOT NULL CHECK (opening_km >= 0),
    closing_km NUMERIC(12, 1) NOT NULL CHECK (closing_km >= opening_km),
    distance_km NUMERIC(12, 1) GENERATED ALWAYS AS (closing_km - opening_km) STORED,
    yard_status VARCHAR(30) NOT NULL,
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (log_date, truck_id)
);

CREATE TABLE IF NOT EXISTS fuel_reconciliations (
    id SERIAL PRIMARY KEY,
    fuel_date DATE NOT NULL,
    truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE RESTRICT,
    trip_id INTEGER REFERENCES trips(id) ON DELETE RESTRICT,
    station_name VARCHAR(100) NOT NULL,
    card_reference VARCHAR(60),
    etims_invoice_no VARCHAR(60),
    litres NUMERIC(10, 2) NOT NULL CHECK (litres > 0),
    price_per_litre NUMERIC(10, 2) NOT NULL CHECK (price_per_litre > 0),
    total_amount NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
    odometer_reading NUMERIC(12, 1),
    km_since_last_fill NUMERIC(12, 1),
    km_per_litre NUMERIC(8, 2),
    audit_status VARCHAR(30) NOT NULL DEFAULT 'Unverified',
    flag_reason TEXT,
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE fuel_reconciliations
    ADD COLUMN IF NOT EXISTS recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
