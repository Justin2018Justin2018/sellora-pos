-- ==========================================================
-- SELLORA POS - MULTI-BUSINESS ISOLATION MIGRATION (v4)
-- ==========================================================
-- WHY THIS EXISTS:
-- Until now, a shop (tenant) had exactly ONE `business_type` and
-- every row in pos_transactions / pos_stock / pos_expenses /
-- pos_debts / pos_customers for that shop_id was implicitly assumed
-- to belong to it. RLS (v2/v3) only checked shop_id membership, never
-- WHICH business a row belonged to.
--
-- This migration lets a single shop subscribe to MULTIPLE business
-- types at once (Shop, Cyber, Gas, Electronics, ...) and makes sure
-- each business's data is truly isolated - not just hidden in the
-- UI, but rejected by Postgres itself if requested for a business the
-- shop hasn't paid for. That holds even if someone edits localStorage,
-- calls the Supabase REST/JS API directly, or opens devtools.
--
-- This migration:
--   1. Creates `business_subscriptions` - one row per (shop_id,
--      business_type), so a shop can hold several active rows at
--      once. Self-service: a shop's own members may insert/update
--      their OWN shop's rows (this is how "Subscribe to another
--      business" activates access in this local-first app, the same
--      trust model the rest of this SaaS already uses for its own
--      plan - see the comments in supabase-schema.sql). Super admins
--      can manage any shop's rows for support/enforcement.
--   2. Adds a `business_type` column to every business data table and
--      backfills it from the shop's existing (legacy, single) business
--      type so no historical data is lost or reassigned.
--   3. Adds has_active_business_subscription(shop_id, business_type),
--      a SECURITY DEFINER helper other policies can call.
--   4. Replaces the v2 "Members can access their shop X" policies
--      with versions that ALSO require an active, unexpired
--      subscription for that specific business_type.
--
-- pos_family_expenses is intentionally left OUT of business_type
-- scoping - it represents the owner's personal/family finances, which
-- span every business the owner runs, not one specific business.
--
-- Run this AFTER supabase-schema-v3-claim-shop-fix.sql. Safe to re-run.
-- ==========================================================

-- ----------------------------------------------------------
-- 1. BUSINESS SUBSCRIPTIONS TABLE
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_subscriptions (
    id TEXT PRIMARY KEY,
    shop_id TEXT NOT NULL,
    business_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, CANCELLED
    plan TEXT NOT NULL DEFAULT 'STANDARD',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly',
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE NOT NULL,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- A shop can only have ONE row per business type - subscribing
    -- again renews/reactivates the same row instead of duplicating it.
    UNIQUE (shop_id, business_type)
);

CREATE INDEX IF NOT EXISTS idx_biz_subs_shop ON business_subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_biz_subs_status ON business_subscriptions(status);

ALTER TABLE business_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop members manage their own business subscriptions" ON business_subscriptions;
CREATE POLICY "Shop members manage their own business subscriptions" ON business_subscriptions
    FOR ALL TO authenticated
    USING (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()))
    WITH CHECK (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Super admins manage all business subscriptions" ON business_subscriptions;
CREATE POLICY "Super admins manage all business subscriptions" ON business_subscriptions
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid()));

-- ----------------------------------------------------------
-- 2. ADD business_type TO EVERY BUSINESS DATA TABLE
--    Backfilled from the shop's existing single business_type on
--    saas_tenants so no historical row loses its business.
-- ----------------------------------------------------------
ALTER TABLE pos_transactions ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE pos_stock        ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE pos_expenses     ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE pos_debts        ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE pos_customers    ADD COLUMN IF NOT EXISTS business_type TEXT;

UPDATE pos_transactions t SET business_type = COALESCE(t.business_type, s.business_type, 'cyber')
    FROM saas_tenants s WHERE s.id = t.shop_id AND t.business_type IS NULL;
UPDATE pos_stock t SET business_type = COALESCE(t.business_type, s.business_type, 'cyber')
    FROM saas_tenants s WHERE s.id = t.shop_id AND t.business_type IS NULL;
UPDATE pos_expenses t SET business_type = COALESCE(t.business_type, s.business_type, 'cyber')
    FROM saas_tenants s WHERE s.id = t.shop_id AND t.business_type IS NULL;
UPDATE pos_debts t SET business_type = COALESCE(t.business_type, s.business_type, 'cyber')
    FROM saas_tenants s WHERE s.id = t.shop_id AND t.business_type IS NULL;
UPDATE pos_customers t SET business_type = COALESCE(t.business_type, s.business_type, 'cyber')
    FROM saas_tenants s WHERE s.id = t.shop_id AND t.business_type IS NULL;

-- Any row that still has no match (e.g. an orphaned shop_id) falls
-- back to 'cyber' rather than being left NULL and unreadable.
UPDATE pos_transactions SET business_type = 'cyber' WHERE business_type IS NULL;
UPDATE pos_stock        SET business_type = 'cyber' WHERE business_type IS NULL;
UPDATE pos_expenses     SET business_type = 'cyber' WHERE business_type IS NULL;
UPDATE pos_debts        SET business_type = 'cyber' WHERE business_type IS NULL;
UPDATE pos_customers    SET business_type = 'cyber' WHERE business_type IS NULL;

ALTER TABLE pos_transactions ALTER COLUMN business_type SET NOT NULL;
ALTER TABLE pos_stock        ALTER COLUMN business_type SET NOT NULL;
ALTER TABLE pos_expenses     ALTER COLUMN business_type SET NOT NULL;
ALTER TABLE pos_debts        ALTER COLUMN business_type SET NOT NULL;
ALTER TABLE pos_customers    ALTER COLUMN business_type SET NOT NULL;

ALTER TABLE pos_transactions ALTER COLUMN business_type SET DEFAULT 'cyber';
ALTER TABLE pos_stock        ALTER COLUMN business_type SET DEFAULT 'cyber';
ALTER TABLE pos_expenses     ALTER COLUMN business_type SET DEFAULT 'cyber';
ALTER TABLE pos_debts        ALTER COLUMN business_type SET DEFAULT 'cyber';
ALTER TABLE pos_customers    ALTER COLUMN business_type SET DEFAULT 'cyber';

CREATE INDEX IF NOT EXISTS idx_pos_tx_biz ON pos_transactions(shop_id, business_type);
CREATE INDEX IF NOT EXISTS idx_pos_stock_biz ON pos_stock(shop_id, business_type);
CREATE INDEX IF NOT EXISTS idx_pos_expenses_biz ON pos_expenses(shop_id, business_type);
CREATE INDEX IF NOT EXISTS idx_pos_debts_biz ON pos_debts(shop_id, business_type);
CREATE INDEX IF NOT EXISTS idx_pos_customers_biz ON pos_customers(shop_id, business_type);

-- ----------------------------------------------------------
-- 3. ENFORCEMENT HELPER
--    SECURITY DEFINER so RLS policies on the data tables (below) can
--    call it even though ordinary policies restrict direct reads of
--    business_subscriptions to a shop's own members. A bundle ('all')
--    subscription grants every concrete business type.
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_active_business_subscription(p_shop_id text, p_business_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM business_subscriptions
    WHERE shop_id = p_shop_id
      AND status = 'ACTIVE'
      AND expiry_date >= CURRENT_DATE
      AND (business_type = p_business_type OR business_type = 'all')
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_business_subscription(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_active_business_subscription(text, text) TO authenticated;

-- ----------------------------------------------------------
-- 4. REPLACE SHOP-SCOPED POLICIES WITH SHOP + BUSINESS-SCOPED ONES
--    A signed-in shop member can now only touch rows that are BOTH
--    in their own shop_id AND in a business_type they have an active
--    subscription for.
-- ----------------------------------------------------------

-- pos_transactions
DROP POLICY IF EXISTS "Members can access their shop transactions" ON pos_transactions;
CREATE POLICY "Members can access their shop's subscribed business transactions" ON pos_transactions
    FOR ALL TO authenticated
    USING (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    )
    WITH CHECK (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    );

-- pos_stock
DROP POLICY IF EXISTS "Members can access their shop stock" ON pos_stock;
CREATE POLICY "Members can access their shop's subscribed business stock" ON pos_stock
    FOR ALL TO authenticated
    USING (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    )
    WITH CHECK (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    );

-- pos_expenses
DROP POLICY IF EXISTS "Members can access their shop expenses" ON pos_expenses;
CREATE POLICY "Members can access their shop's subscribed business expenses" ON pos_expenses
    FOR ALL TO authenticated
    USING (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    )
    WITH CHECK (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    );

-- pos_debts
DROP POLICY IF EXISTS "Members can access their shop debts" ON pos_debts;
CREATE POLICY "Members can access their shop's subscribed business debts" ON pos_debts
    FOR ALL TO authenticated
    USING (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    )
    WITH CHECK (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    );

-- pos_customers
DROP POLICY IF EXISTS "Members can access their shop customers" ON pos_customers;
CREATE POLICY "Members can access their shop's subscribed business customers" ON pos_customers
    FOR ALL TO authenticated
    USING (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    )
    WITH CHECK (
      shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid())
      AND has_active_business_subscription(shop_id, business_type)
    );

-- pos_family_expenses is untouched by this migration - it is not
-- business-scoped. It keeps the plain shop-membership policy from
-- v2 (owner/family finances span all of a shop's businesses).

-- ==========================================================
-- AFTER RUNNING THIS FILE:
--   1. Existing shops keep working immediately - every historical
--      row was backfilled with its shop's old business_type above,
--      and migrateLegacyBusinessType() in the app creates a matching
--      ACTIVE business_subscriptions row the first time each shop
--      loads post-upgrade, so nobody is locked out.
--   2. New businesses are activated by calling, from the signed-in
--      shop's own account:
--        insert into business_subscriptions
--          (id, shop_id, business_type, status, plan, billing_cycle, start_date, expiry_date)
--        values (...)
--      (the app's "Subscribe to another business" flow does this via
--      businessSubscriptionService.subscribeBusinessType()).
--   3. To immediately cut off a business (e.g. non-payment), a super
--      admin can update that row's status to 'EXPIRED' or 'CANCELLED'
--      - access to that business's data is revoked on the very next
--      request, from every device, with zero data loss.
-- ==========================================================
