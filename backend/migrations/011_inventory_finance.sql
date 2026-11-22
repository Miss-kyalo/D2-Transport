ALTER TABLE garage_work_orders
    ADD COLUMN IF NOT EXISTS work_started_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS idle_minutes INTEGER DEFAULT 0;

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

CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    sku VARCHAR(40) UNIQUE NOT NULL,
    item_name VARCHAR(120) NOT NULL,
    category VARCHAR(50) NOT NULL,
    unit_of_measure VARCHAR(20) DEFAULT 'PCS',
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    quantity_on_hand NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reorder_level NUMERIC(12, 2) NOT NULL DEFAULT 2.00,
    bin_location VARCHAR(40),
    requires_old_core BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
    movement_type VARCHAR(25) NOT NULL,
    quantity NUMERIC(12, 2) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    department_source VARCHAR(30) NOT NULL DEFAULT 'GARAGE',
    work_order_id INTEGER REFERENCES garage_work_orders(id) ON DELETE SET NULL,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    supplier_name VARCHAR(120),
    etims_invoice_no VARCHAR(60),
    old_core_returned BOOLEAN DEFAULT FALSE,
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_fleet_mileage (
    id SERIAL PRIMARY KEY,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
    opening_km NUMERIC(12, 1) NOT NULL,
    closing_km NUMERIC(12, 1) NOT NULL,
    distance_km NUMERIC(12, 1) GENERATED ALWAYS AS (GREATEST(0, closing_km - opening_km)) STORED,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    yard_status VARCHAR(30) DEFAULT 'On Corridor',
    recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (log_date, truck_id)
);

CREATE TABLE IF NOT EXISTS fuel_reconciliations (
    id SERIAL PRIMARY KEY,
    fuel_date DATE NOT NULL,
    truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
    trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    station_name VARCHAR(100) NOT NULL,
    card_reference VARCHAR(60),
    etims_invoice_no VARCHAR(60),
    litres NUMERIC(10, 2) NOT NULL,
    price_per_litre NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL,
    odometer_reading NUMERIC(12, 1),
    km_since_last_fill NUMERIC(12, 1) DEFAULT 0,
    km_per_litre NUMERIC(8, 2) DEFAULT 0,
    audit_status VARCHAR(30) NOT NULL DEFAULT 'Unverified',
    flag_reason TEXT,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS petty_cash_vouchers (
    id SERIAL PRIMARY KEY,
    voucher_no VARCHAR(40) UNIQUE NOT NULL,
    requested_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    department_source VARCHAR(30) NOT NULL DEFAULT 'FLEET_TRANSPORT',
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    work_order_id INTEGER REFERENCES garage_work_orders(id) ON DELETE SET NULL,
    purpose TEXT NOT NULL,
    items_requested TEXT NOT NULL,
    amount_requested NUMERIC(12, 2) NOT NULL,
    amount_disbursed NUMERIC(12, 2) DEFAULT 0.00,
    payment_channel VARCHAR(30) DEFAULT 'Openfloat',
    bank_or_float_ref VARCHAR(80),
    items_bought TEXT,
    actual_spent NUMERIC(12, 2) DEFAULT 0.00,
    change_returned NUMERIC(12, 2) DEFAULT 0.00,
    etims_cu_invoice_no VARCHAR(60),
    receipt_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'Requested',
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_ledger_entries (
    id SERIAL PRIMARY KEY,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    account_name VARCHAR(80) NOT NULL,
    bank_reference VARCHAR(80) UNIQUE NOT NULL,
    entry_type VARCHAR(15) NOT NULL,
    department_source VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    description TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'KES',
    etims_ref VARCHAR(60),
    reconciled BOOLEAN DEFAULT FALSE,
    reconciled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);