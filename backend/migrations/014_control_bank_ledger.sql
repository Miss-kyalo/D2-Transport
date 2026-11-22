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

ALTER TABLE bank_ledger_entries
    ADD COLUMN IF NOT EXISTS recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
