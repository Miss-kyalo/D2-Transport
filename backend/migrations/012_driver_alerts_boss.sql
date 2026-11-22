ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Boss';

CREATE TABLE IF NOT EXISTS driver_pre_arrival_alerts (
    id SERIAL PRIMARY KEY,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE CASCADE,
    driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    current_odometer NUMERIC(12, 1) NOT NULL,
    fault_system VARCHAR(60) NOT NULL,
    driver_description TEXT NOT NULL,
    requested_spares TEXT,
    eta_at_yard TIMESTAMP,
    kit_prepared BOOLEAN DEFAULT FALSE,
    prepared_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(25) NOT NULL DEFAULT 'Incoming',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE driver_pre_arrival_alerts
    ADD COLUMN IF NOT EXISTS reported_for_name VARCHAR(120);
