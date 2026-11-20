CREATE TABLE IF NOT EXISTS depot_licenses (
    id SERIAL PRIMARY KEY,
    authority VARCHAR(50) NOT NULL, -- NEMA, KEPHIS, KRA, COUNTY, KEBS
    license_name VARCHAR(150) NOT NULL,
    license_number VARCHAR(100) NOT NULL,
    issued_date DATE,
    expiry_date DATE NOT NULL,
    document_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS containers (
    id SERIAL PRIMARY KEY,
    container_number VARCHAR(20) UNIQUE NOT NULL,
    iso_check_valid BOOLEAN DEFAULT TRUE,
    container_type VARCHAR(20) NOT NULL DEFAULT '40FT', -- 20FT, 40FT, 40FT_HC, REEFER
    principal_name VARCHAR(120), -- e.g. Italian / global shipping line
    principal_currency VARCHAR(10) DEFAULT 'USD', -- USD, EUR, KES
    free_days INTEGER DEFAULT 7,
    daily_storage_rate NUMERIC(12, 2) DEFAULT 0.00,
    yard_bay VARCHAR(40),
    status VARCHAR(30) NOT NULL DEFAULT 'Gated-In', -- Gated-In, Available, Allocated, Gated-Out, Hold
    condition_status VARCHAR(30) NOT NULL DEFAULT 'Sound', -- Sound, Damaged
    csc_valid_until DATE,
    cleaning_status VARCHAR(30) NOT NULL DEFAULT 'Pending', -- Pending, Swept_Clean, Washed_Sanitized, Fumigated
    cleaning_cert_ref VARCHAR(100),
    cleaned_at TIMESTAMP,
    kephis_cleared BOOLEAN DEFAULT FALSE,
    kebs_hold BOOLEAN DEFAULT FALSE,
    customs_hold BOOLEAN DEFAULT FALSE,
    hold_reason TEXT,
    current_trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
    gated_in_at TIMESTAMP,
    gated_out_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS container_inspections (
    id SERIAL PRIMARY KEY,
    container_id INTEGER NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
    inspection_stage VARCHAR(20) NOT NULL, -- GATE_IN, PRE_CLEAN, POST_CLEAN, GATE_OUT
    wash_bay_used BOOLEAN DEFAULT FALSE,
    effluent_treated BOOLEAN DEFAULT TRUE,
    waste_manifest_ref VARCHAR(100),
    iicl_damage_codes VARCHAR(200),
    photo_urls JSONB DEFAULT '[]'::jsonb,
    inspector_id INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS container_movements (
    id SERIAL PRIMARY KEY,
    container_id INTEGER NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
    movement_type VARCHAR(20) NOT NULL, -- GATE_IN, CLEANING_UPDATE, CLEARANCE_UPDATE, GATE_OUT
    truck_plate VARCHAR(25),
    seal_number VARCHAR(60),
    eir_reference VARCHAR(80),
    notes TEXT,
    recorded_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);