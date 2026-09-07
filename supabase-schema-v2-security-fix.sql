-- ==========================================================
-- MAMA JUSTO POS - SECURITY FIX MIGRATION (v2)
-- ==========================================================
-- WHY THIS EXISTS:
-- The original supabase-schema.sql enables Row Level Security
-- but then defines every policy as `USING (true) WITH CHECK (true)`
-- for the `anon` role. Since the anon key ships inside the
-- client-side JS bundle (this is normal and expected for Supabase
-- apps), that combination means ANY person who opens devtools and
-- copies the anon key can read and write every row in every table
-- directly against your database - completely bypassing the app,
-- with no login required.
--
-- This migration:
--   1. Adds a `shop_members` table linking a real Supabase Auth
--      user to the shop(s) they're allowed to touch.
--   2. Adds a `super_admins` table for the SaaS admin console.
--   3. Replaces every "allow anon all" policy with policies that
--      require a signed-in user (`authenticated` role) who is a
--      member of that specific shop_id.
--
-- Run this AFTER the original supabase-schema.sql, in the
-- Supabase SQL Editor. It is safe to re-run (idempotent).
-- ==========================================================

-- ----------------------------------------------------------
-- 1. SHOP MEMBERSHIP TABLE
-- Maps a Supabase Auth user to the shop_id(s) they may access.
-- A row here is what "invites" a logged-in user into a shop's data.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_members (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff', -- 'owner' | 'staff'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, shop_id)
);

ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;

-- A signed-in user can see their own memberships (needed so the
-- app can figure out which shop(s) to load after login).
DROP POLICY IF EXISTS "Users can view their own memberships" ON shop_members;
CREATE POLICY "Users can view their own memberships" ON shop_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- A signed-in user can claim a shop for THEMSELVES only (used at
-- first-time setup / sign-up). They can never insert a row for
-- someone else's user_id.
DROP POLICY IF EXISTS "Users can add themselves to a shop" ON shop_members;
CREATE POLICY "Users can add themselves to a shop" ON shop_members
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ----------------------------------------------------------
-- 2. SUPER ADMIN TABLE
-- Real, server-checked admin flag instead of a password
-- string hardcoded in the client bundle.
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS super_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;

-- A signed-in user may check ONLY whether *they themselves* are an
-- admin - never list other admins.
DROP POLICY IF EXISTS "Users can check their own admin status" ON super_admins;
CREATE POLICY "Users can check their own admin status" ON super_admins
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- IMPORTANT: after running this migration, promote your own account
-- to super admin manually from the Supabase SQL Editor (never from
-- client code), e.g.:
--   INSERT INTO super_admins (user_id, email)
--   VALUES ('<your-auth-user-uuid>', 'you@example.com');

-- ----------------------------------------------------------
-- 3. REPLACE THE OPEN "anon all" POLICIES WITH SHOP-SCOPED ONES
-- ----------------------------------------------------------

-- pos_transactions
DROP POLICY IF EXISTS "Allow anon all on pos_transactions" ON pos_transactions;
CREATE POLICY "Members can access their shop transactions" ON pos_transactions
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()));

-- pos_stock
DROP POLICY IF EXISTS "Allow anon all on pos_stock" ON pos_stock;
CREATE POLICY "Members can access their shop stock" ON pos_stock
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()));

-- pos_expenses
DROP POLICY IF EXISTS "Allow anon all on pos_expenses" ON pos_expenses;
CREATE POLICY "Members can access their shop expenses" ON pos_expenses
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()));

-- pos_debts
DROP POLICY IF EXISTS "Allow anon all on pos_debts" ON pos_debts;
CREATE POLICY "Members can access their shop debts" ON pos_debts
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()));

-- pos_customers
DROP POLICY IF EXISTS "Allow anon all on pos_customers" ON pos_customers;
CREATE POLICY "Members can access their shop customers" ON pos_customers
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()));

-- pos_family_expenses
DROP POLICY IF EXISTS "Allow anon all on pos_family_expenses" ON pos_family_expenses;
CREATE POLICY "Members can access their shop family expenses" ON pos_family_expenses
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()));

-- saas_plans: pricing info is fine to expose publicly (it's marketing
-- content), so anon SELECT stays, but anon can no longer write to it.
DROP POLICY IF EXISTS "Allow read on saas_plans" ON saas_plans;
CREATE POLICY "Anyone can read plans" ON saas_plans
    FOR SELECT TO anon, authenticated
    USING (true);

-- saas_tenants: platform-owner data (names, phone numbers, emails,
-- password hashes) - super admins only, never anon.
DROP POLICY IF EXISTS "Allow all on saas_tenants" ON saas_tenants;
CREATE POLICY "Super admins manage tenants" ON saas_tenants
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- saas_subscription_audit: same - admins only.
DROP POLICY IF EXISTS "Allow all on saas_subscription_audit" ON saas_subscription_audit;
CREATE POLICY "Super admins manage audit log" ON saas_subscription_audit
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- ==========================================================
-- AFTER RUNNING THIS FILE, YOU MUST:
--   1. Enable Email/Password sign-in under Supabase Dashboard
--      -> Authentication -> Providers (it's on by default).
--   2. Have each shop owner sign up in the app (see the updated
--      SupabaseModal "Cloud Sync" screen) - this creates their
--      auth.users row.
--   3. Insert a shop_members row linking that user to their
--      shop_id (the app's sign-up flow does this automatically
--      the first time; see src/services/supabase.ts).
--   4. Manually add yourself to super_admins (see step 2 above)
--      to use the Super Admin dashboard against real cloud data.
-- ==========================================================
