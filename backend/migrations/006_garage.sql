CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone_whatsapp TEXT NOT NULL,
  email TEXT,
  credit_limit NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (credit_limit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  plate_number TEXT UNIQUE NOT NULL,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('TRACTOR', 'TRAILER')),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  vin_chassis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_cards (
  id BIGSERIAL PRIMARY KEY,
  job_number TEXT UNIQUE NOT NULL,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  tractor_id BIGINT REFERENCES vehicles(id) ON DELETE RESTRICT,
  trailer_id BIGINT REFERENCES vehicles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'INTAKE' CHECK (status IN (
    'INTAKE',
    'DIAGNOSING',
    'AWAITING_APPROVAL',
    'IN_REPAIR',
    'READY',
    'INVOICED',
    'CLOSED'
  )),
  deposit_required NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deposit_required >= 0),
  deposit_paid NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (deposit_paid >= 0),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (tractor_id IS NOT NULL OR trailer_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS inspection_pins_3d (
  id BIGSERIAL PRIMARY KEY,
  job_card_id BIGINT NOT NULL REFERENCES job_cards(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('INTAKE', 'DIAGNOSIS', 'COMPLETION')),
  vehicle_role TEXT NOT NULL CHECK (vehicle_role IN ('TRACTOR', 'TRAILER')),
  mesh_zone TEXT NOT NULL,
  pos_x NUMERIC(10, 4) NOT NULL,
  pos_y NUMERIC(10, 4) NOT NULL,
  pos_z NUMERIC(10, 4) NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  notes TEXT,
  media_url TEXT,
  ai_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
  part_name TEXT NOT NULL,
  category TEXT NOT NULL,
  compatible_makes JSONB NOT NULL DEFAULT '[]'::jsonb,
  oem_number TEXT,
  aftermarket_equivalents JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_core_return BOOLEAN NOT NULL DEFAULT FALSE,
  qty_on_hand INTEGER NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
  qty_reserved INTEGER NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  unit_cost NUMERIC(12, 2) NOT NULL CHECK (unit_cost >= 0),
  selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
  CHECK (qty_reserved <= qty_on_hand)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  item_id BIGINT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  job_card_id BIGINT REFERENCES job_cards(id) ON DELETE RESTRICT,
  movement_type TEXT NOT NULL CHECK (movement_type IN (
    'PURCHASE',
    'RESERVED',
    'RELEASED',
    'ISSUED',
    'CORE_RETURNED',
    'ADJUSTMENT'
  )),
  qty INTEGER NOT NULL CHECK (qty > 0),
  batch_photo_url TEXT,
  actor_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_client_id ON vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_client_id ON job_cards(client_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_tractor_id ON job_cards(tractor_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_trailer_id ON job_cards(trailer_id);
CREATE INDEX IF NOT EXISTS idx_job_cards_status ON job_cards(status);
CREATE INDEX IF NOT EXISTS idx_inspection_pins_job_card ON inspection_pins_3d(job_card_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_job_card_id ON stock_movements(job_card_id);

CREATE TABLE IF NOT EXISTS garage_work_orders (
    id SERIAL PRIMARY KEY,
    wo_number VARCHAR(40) UNIQUE NOT NULL,
    department_source VARCHAR(30) NOT NULL DEFAULT 'GARAGE',
    asset_type VARCHAR(30) NOT NULL,
    asset_identifier VARCHAR(60) NOT NULL,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    customer_or_unit VARCHAR(120),
    fault_category VARCHAR(60) NOT NULL,
    dtc_codes VARCHAR(120),
    problem_description TEXT NOT NULL,
    parts_used TEXT,
    labor_hours NUMERIC(6, 2) DEFAULT 0.00,
    parts_cost NUMERIC(12, 2) DEFAULT 0.00,
    labor_cost NUMERIC(12, 2) DEFAULT 0.00,
    total_estimate NUMERIC(12, 2) DEFAULT 0.00,
    billing_currency VARCHAR(10) DEFAULT 'KES',
    priority VARCHAR(20) DEFAULT 'Normal',
    status VARCHAR(25) NOT NULL DEFAULT 'Open',
    assigned_mechanic_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS garage_bays (
    id SERIAL PRIMARY KEY,
    bay_code VARCHAR(20) UNIQUE NOT NULL,
    bay_name VARCHAR(80) NOT NULL,
    specialty VARCHAR(60) DEFAULT 'Heavy Diesel & Hydraulics',
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO garage_bays (bay_code, bay_name, specialty)
VALUES
    ('BAY-01', 'Heavy Prime Mover & Gearbox Pit', 'Engine & Drivetrain'),
    ('BAY-02', 'Trailer Axle, Air Brakes & Suspension Bay', 'Brakes & Chassis'),
    ('BAY-03', 'Reach Stacker, Forklift & Hydraulics Bay', 'Depot & Heavy Plant'),
    ('BAY-04', 'OBD-II Diagnostics & Auto-Electrical Bay', 'Diagnostics & Electrical')
ON CONFLICT (bay_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS garage_work_orders (
    id SERIAL PRIMARY KEY,
    wo_number VARCHAR(40) UNIQUE NOT NULL,
    department_source VARCHAR(30) NOT NULL DEFAULT 'GARAGE',
    asset_type VARCHAR(30) NOT NULL,
    asset_identifier VARCHAR(60) NOT NULL,
    truck_id INTEGER REFERENCES trucks(id) ON DELETE SET NULL,
    bay_id INTEGER REFERENCES garage_bays(id) ON DELETE SET NULL,
    customer_or_unit VARCHAR(120),
    customer_phone VARCHAR(30),
    fault_category VARCHAR(60) NOT NULL,
    dtc_codes VARCHAR(120),
    problem_description TEXT NOT NULL,
    parts_used TEXT,
    labor_hours NUMERIC(6, 2) DEFAULT 0.00,
    parts_cost NUMERIC(12, 2) DEFAULT 0.00,
    labor_cost NUMERIC(12, 2) DEFAULT 0.00,
    total_estimate NUMERIC(12, 2) DEFAULT 0.00,
    billing_currency VARCHAR(10) DEFAULT 'KES',
    priority VARCHAR(20) DEFAULT 'Normal',
    status VARCHAR(25) NOT NULL DEFAULT 'Open',
    assigned_mechanic_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);