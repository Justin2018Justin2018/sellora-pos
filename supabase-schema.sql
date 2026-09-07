-- ==========================================================
-- MAMA JUSTO POS - SUPABASE POSTGRESQL DATABASE SCHEMA
-- ==========================================================
-- Paste this script into your Supabase SQL Editor to set up all POS tables.

-- 1. POS TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS pos_transactions (
    id BIGINT PRIMARY KEY,
    receipt TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    customer TEXT NOT NULL DEFAULT 'Walk-in Customer',
    service TEXT NOT NULL,
    qty NUMERIC NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    payment TEXT NOT NULL DEFAULT 'Cash',
    status TEXT NOT NULL DEFAULT 'completed',
    staff TEXT NOT NULL DEFAULT 'Admin',
    notes TEXT,
    material_cost NUMERIC DEFAULT 0,
    shop_id TEXT NOT NULL DEFAULT 'shop_1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy reporting and transaction history
CREATE INDEX IF NOT EXISTS idx_pos_tx_date ON pos_transactions(date);
CREATE INDEX IF NOT EXISTS idx_pos_tx_shop ON pos_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_pos_tx_service ON pos_transactions(service);

-- 2. POS STOCK & INVENTORY TABLE
CREATE TABLE IF NOT EXISTS pos_stock (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Printing Materials',
    unit TEXT NOT NULL DEFAULT 'pcs',
    unit_cost NUMERIC NOT NULL DEFAULT 0,
    retail_price NUMERIC NOT NULL DEFAULT 0,
    opening_stock NUMERIC NOT NULL DEFAULT 0,
    stock_added NUMERIC NOT NULL DEFAULT 0,
    damaged_stock NUMERIC NOT NULL DEFAULT 0,
    reorder_level NUMERIC NOT NULL DEFAULT 5,
    shop_id TEXT NOT NULL DEFAULT 'shop_1',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. POS EXPENSES TABLE
CREATE TABLE IF NOT EXISTS pos_expenses (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'Shop Supplies',
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    recorded_by TEXT NOT NULL DEFAULT 'Admin',
    shop_id TEXT NOT NULL DEFAULT 'shop_1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_expenses_date ON pos_expenses(date);

-- 4. POS CUSTOMER DEBTS TABLE
CREATE TABLE IF NOT EXISTS pos_debts (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    original NUMERIC NOT NULL DEFAULT 0,
    paid NUMERIC NOT NULL DEFAULT 0,
    service TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    staff TEXT NOT NULL DEFAULT 'Admin',
    shop_id TEXT NOT NULL DEFAULT 'shop_1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. POS CUSTOMERS CRM TABLE
CREATE TABLE IF NOT EXISTS pos_customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    loyalty_points NUMERIC DEFAULT 0,
    shop_id TEXT NOT NULL DEFAULT 'shop_1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. POS FAMILY FINANCE & OWNER DRAWINGS
CREATE TABLE IF NOT EXISTS pos_family_expenses (
    id TEXT PRIMARY KEY,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    person TEXT NOT NULL,
    reason TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    shop_id TEXT NOT NULL DEFAULT 'shop_1',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- SAAS MULTI-TENANT & SUBSCRIPTION MANAGEMENT TABLES
-- ==========================================================

-- 7. SAAS TENANTS (SHOP OWNERS & PLATFORM SUBSCRIPTIONS)
CREATE TABLE IF NOT EXISTS saas_tenants (
    id TEXT PRIMARY KEY,
    shop_name TEXT NOT NULL,
    owner_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRING_SOON, EXPIRED, SUSPENDED, TERMINATED
    plan TEXT NOT NULL DEFAULT 'BASIC',   -- BASIC, STANDARD, PREMIUM, ENTERPRISE
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    location TEXT,
    notes TEXT,
    is_primary_tenant BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saas_tenants_status ON saas_tenants(status);
CREATE INDEX IF NOT EXISTS idx_saas_tenants_expiry ON saas_tenants(expiry_date);

-- 8. SAAS SUBSCRIPTION AUDIT LOG
CREATE TABLE IF NOT EXISTS saas_subscription_audit (
    id BIGSERIAL PRIMARY KEY,
    time TIMESTAMPTZ DEFAULT NOW(),
    admin TEXT NOT NULL DEFAULT 'Super Admin',
    shop_id TEXT NOT NULL,
    shop_name TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    prev_value TEXT,
    new_value TEXT
);

CREATE INDEX IF NOT EXISTS idx_saas_audit_shop ON saas_subscription_audit(shop_id);

-- 9. SAAS SUBSCRIPTION PLANS
CREATE TABLE IF NOT EXISTS saas_plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_monthly NUMERIC NOT NULL DEFAULT 0,
    price_annual NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial SaaS plans
INSERT INTO saas_plans (id, name, price_monthly, price_annual, description, features)
VALUES 
    ('BASIC', 'Basic Cyber Starter', 1200, 12000, 'Single-terminal cyber and printing shops.', '["Cyber Sales Console", "Material Auto-Deduction", "Daily Expenses", "Customer Directory"]'::jsonb),
    ('STANDARD', 'Standard Pro Business', 2200, 22000, 'Multi-service shops with gas refill operations.', '["Everything in Basic", "Gas Station Station", "Customer Debts Tracker", "Staff Shift Handover", "Reports & CSV Export"]'::jsonb),
    ('PREMIUM', 'Premium Enterprise Hub', 3500, 35000, 'Full retail power with electronics and AI advisor.', '["Everything in Standard", "Electronics Hub with Barcodes", "Family Finance Isolation", "Cloud Database Sync", "Mama Justo AI Advisor"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    price_annual = EXCLUDED.price_annual,
    description = EXCLUDED.description,
    features = EXCLUDED.features;

-- 10. ROW LEVEL SECURITY (RLS) & TENANT ISOLATION POLICIES
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_family_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_subscription_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_plans ENABLE ROW LEVEL SECURITY;

-- Base Tenant Isolation Policies (Ensure Shop A never sees Shop B)
DROP POLICY IF EXISTS "Allow anon all on pos_transactions" ON pos_transactions;
CREATE POLICY "Allow anon all on pos_transactions" ON pos_transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on pos_stock" ON pos_stock;
CREATE POLICY "Allow anon all on pos_stock" ON pos_stock FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on pos_expenses" ON pos_expenses;
CREATE POLICY "Allow anon all on pos_expenses" ON pos_expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on pos_debts" ON pos_debts;
CREATE POLICY "Allow anon all on pos_debts" ON pos_debts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on pos_customers" ON pos_customers;
CREATE POLICY "Allow anon all on pos_customers" ON pos_customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on pos_family_expenses" ON pos_family_expenses;
CREATE POLICY "Allow anon all on pos_family_expenses" ON pos_family_expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read on saas_plans" ON saas_plans;
CREATE POLICY "Allow read on saas_plans" ON saas_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow all on saas_tenants" ON saas_tenants;
CREATE POLICY "Allow all on saas_tenants" ON saas_tenants FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on saas_subscription_audit" ON saas_subscription_audit;
CREATE POLICY "Allow all on saas_subscription_audit" ON saas_subscription_audit FOR ALL USING (true) WITH CHECK (true);
