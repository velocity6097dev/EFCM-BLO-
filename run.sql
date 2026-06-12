-- 1. Users for Authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    password_hash TEXT,
    role VARCHAR(10) DEFAULT 'USER'
);

-- 2. App Settings
CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(50) PRIMARY KEY, 
    setting_value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('election_mode', 'false')
ON CONFLICT (setting_key) DO NOTHING;

-- 3. Blocked Entities
CREATE TABLE IF NOT EXISTS blocked_entities (
    id SERIAL PRIMARY KEY,
    block_type VARCHAR(20),
    block_value VARCHAR(50),
    reason TEXT,
    blocked_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (block_type, block_value)
);

-- 4. Fuel Bills Table
CREATE TABLE IF NOT EXISTS fuel_bills (
    id SERIAL PRIMARY KEY,
    bill_no VARCHAR(50),
    vehicle_no VARCHAR(50),
    amount NUMERIC(12, 2),
    bill_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Add Admin Override Columns Safely
ALTER TABLE fuel_bills
ADD COLUMN IF NOT EXISTS is_override BOOLEAN DEFAULT false;

ALTER TABLE fuel_bills
ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- 6. Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(50) UNIQUE,
    status VARCHAR(20) DEFAULT 'PENDING',
    total_amount NUMERIC(12, 2),
    paid_amount NUMERIC(12, 2) DEFAULT 0.00,
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);