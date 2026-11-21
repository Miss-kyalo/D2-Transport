-- 1. Extend Users with Kenyan Statutory & Driver Profile Fields
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS national_id VARCHAR(30),
    ADD COLUMN IF NOT EXISTS kra_pin VARCHAR(20),
    ADD COLUMN IF NOT EXISTS nssf_number VARCHAR(30),
    ADD COLUMN IF NOT EXISTS shif_number VARCHAR(30),
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30),
    ADD COLUMN IF NOT EXISTS license_number VARCHAR(40),
    ADD COLUMN IF NOT EXISTS license_class VARCHAR(20) DEFAULT 'CE',
    ADD COLUMN IF NOT EXISTS license_expiry DATE,
    ADD COLUMN IF NOT EXISTS employment_date DATE DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS basic_pay NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS housing_allowance NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS off_day_rate NUMERIC(12, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS annual_leave_balance NUMERIC(6, 2) DEFAULT 21.00,
    ADD COLUMN IF NOT EXISTS accrued_off_days NUMERIC(6, 2) DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(80),
    ADD COLUMN IF NOT EXISTS bank_account VARCHAR(50);

-- 2. Leave & Off-Day Request & Counter Ledger
CREATE TABLE IF NOT EXISTS leave_off_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_type VARCHAR(30) NOT NULL, -- ANNUAL_LEAVE, OFF_DAY_ENCASH, OFF_DAY_TAKE, SICK_LEAVE
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    days_count NUMERIC(5, 2) NOT NULL,
    reason TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. KRA & Labour-Proof Monthly Payroll Runs
CREATE TABLE IF NOT EXISTS payroll_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payroll_month VARCHAR(7) NOT NULL, -- YYYY-MM
    basic_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    housing_allowance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    off_days_paid NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    off_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    nssf_tier1 NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    nssf_tier2 NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    nssf_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    shif_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    housing_levy NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    paye_tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    salary_advance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_deductions NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_pay NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    employer_nssf NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    employer_ahl NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    driver_signed BOOLEAN DEFAULT FALSE,
    driver_signature_text VARCHAR(120),
    signed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, payroll_month)
);

-- 4. Public QR Verification Token on Trips
ALTER TABLE trips
    ADD COLUMN IF NOT EXISTS qr_token VARCHAR(64) UNIQUE;