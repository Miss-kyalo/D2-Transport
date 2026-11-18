DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'Admin', 'HR', 'Accounts_Payable', 'Accounts_Receivable',
        'Dispatcher', 'FleetManager', 'Mechanic', 'Driver',
        'Manufacturer', 'Client', 'SpotClient'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Client';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'HR';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Accounts_Payable';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Accounts_Receivable';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Dispatcher';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'FleetManager';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Mechanic';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Manufacturer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'SpotClient';

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(150) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    company_name VARCHAR(150),
    phone_number VARCHAR(30) UNIQUE,
    onboarding_status VARCHAR(50) DEFAULT 'Pending_HR',
    allowed_accounts_modules JSONB DEFAULT '[]',
    basic_pay DECIMAL(12, 2) DEFAULT 0.00,
    housing_allowance DECIMAL(12, 2) DEFAULT 0.00,
    off_pay DECIMAL(12, 2) DEFAULT 0.00,
    bank_account_number VARCHAR(100),
    bank_branch_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL,
    doc_number VARCHAR(100) NOT NULL,
    file_url TEXT NOT NULL,
    expiry_date DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, doc_type)
);

CREATE TABLE IF NOT EXISTS trucks (
    id SERIAL PRIMARY KEY,
    plate_number VARCHAR(50) UNIQUE NOT NULL,
    model VARCHAR(100) NOT NULL,
    capacity_tons DECIMAL(6, 2) NOT NULL DEFAULT 30.00,
    status VARCHAR(50) DEFAULT 'Available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    tracking_code VARCHAR(50) UNIQUE NOT NULL,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    manufacturer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    consignee_name VARCHAR(150),
    consignee_phone VARCHAR(50),
    origin VARCHAR(150) NOT NULL,
    destination VARCHAR(150) NOT NULL,
    cargo_description TEXT NOT NULL,
    cargo_type VARCHAR(100),
    initial_weight DECIMAL(8, 2) NOT NULL,
    final_weight DECIMAL(8, 2),
    variance_tons DECIMAL(8, 2) DEFAULT 0,
    distance_km DECIMAL(10, 2) DEFAULT 0,
    estimated_fuel_liters DECIMAL(10, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Scheduled',
    is_spot_market BOOLEAN DEFAULT FALSE,
    spot_security_checkpoints JSONB DEFAULT '[]',
    deposit_50_paid BOOLEAN DEFAULT FALSE,
    accounts_go_ahead_issued BOOLEAN DEFAULT FALSE,
    fuel_variance_cleared BOOLEAN DEFAULT FALSE,
    mileage_disbursed BOOLEAN DEFAULT FALSE,
    mileage_amount_kes DECIMAL(10, 2) DEFAULT 0,
    client_received_stamp BOOLEAN DEFAULT FALSE,
    client_stamp_notes TEXT,
    handover_notes TEXT,
    delivery_note_url TEXT,
    ocr_extracted_client VARCHAR(150),
    ocr_extracted_destination VARCHAR(255),
    ocr_security_stamp_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trip_legs (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    leg_number INTEGER NOT NULL DEFAULT 1,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    driver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    transfer_weight_tons DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'Active',
    current_lat DECIMAL(10, 6),
    current_lng DECIMAL(10, 6),
    last_location_update TIMESTAMP,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    UNIQUE(trip_id, leg_number)
);

CREATE TABLE IF NOT EXISTS trip_incidents (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    leg_id INTEGER REFERENCES trip_legs(id) ON DELETE SET NULL,
    incident_type VARCHAR(100) NOT NULL,
    location_name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    reported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fuel_lpos (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    partner_name VARCHAR(150) NOT NULL,
    lpo_number VARCHAR(100) NOT NULL,
    expected_liters DECIMAL(10, 2) NOT NULL,
    cost_per_liter DECIMAL(10, 2) NOT NULL,
    total_lpo_cost DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trip_id)
);

CREATE TABLE IF NOT EXISTS truck_compliance_docs (
    id SERIAL PRIMARY KEY,
    truck_id INTEGER NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
    doc_type VARCHAR(100) NOT NULL,
    certificate_number VARCHAR(100) NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    cloud_file_url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL UNIQUE REFERENCES trips(id) ON DELETE CASCADE,
    client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    amount_kes DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending',
    issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP NOT NULL,
    paid_at TIMESTAMP
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        ALTER TABLE users RENAME COLUMN password TO password_hash;
    END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_accounts_modules JSONB DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS basic_pay DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS housing_allowance DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS off_pay DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS bank_branch_code VARCHAR(50);
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;

ALTER TABLE trips ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(50) UNIQUE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS manufacturer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS consignee_name VARCHAR(150);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS consignee_phone VARCHAR(50);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS cargo_type VARCHAR(100);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS initial_weight DECIMAL(8, 2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS final_weight DECIMAL(8, 2);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS variance_tons DECIMAL(8, 2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS estimated_fuel_liters DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS is_spot_market BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS spot_security_checkpoints JSONB DEFAULT '[]';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS deposit_50_paid BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS accounts_go_ahead_issued BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS fuel_variance_cleared BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS mileage_disbursed BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS mileage_amount_kes DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_received_stamp BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_stamp_notes TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS handover_notes TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS delivery_note_url TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ocr_extracted_client VARCHAR(150);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ocr_extracted_destination VARCHAR(255);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ocr_security_stamp_detected BOOLEAN DEFAULT FALSE;