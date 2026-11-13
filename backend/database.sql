-- 1. Add 'Manufacturer' to your user_role enum safely
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Manufacturer';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Client';

-- 2. Add company name support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS company_name VARCHAR(150);

-- 3. Add 3PL and QR tracking columns to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS manufacturer_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(50) UNIQUE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS consignee_name VARCHAR(150);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS consignee_phone VARCHAR(50);
-- Add stamp tracking columns to trips table
ALTER TABLE trips ADD COLUMN IF NOT EXISTS security_stamp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS security_stamp_code VARCHAR(100);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_received_stamp BOOLEAN DEFAULT FALSE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS client_stamp_notes TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS delivery_note_url TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ocr_extracted_client VARCHAR(150);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ocr_extracted_destination VARCHAR(255);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ocr_security_stamp_detected BOOLEAN DEFAULT FALSE;

-- 4. Create trip_legs for Chain-of-Custody & Rescue Truck Transshipments
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
    ended_at TIMESTAMP
);

-- 5. Create trip_incidents for Breakdowns, Delays & Dispatch Reports
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