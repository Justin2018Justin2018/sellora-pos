-- ==========================================================
-- SELLORA v5 - SECURITY & DATA-INTEGRITY HARDENING
-- Run after v1, v2, v3, v3b and v4. Idempotent. Non-destructive: no table or row is dropped or rewritten.
--
-- !! NOT YET EXECUTED against any database (the authoring environment had no Postgres/Supabase access).
-- !! Run supabase-audit-queries.sql first, then apply to a Supabase branch / staging copy, and run
-- !! tests/sql/rls_isolation_checks.sql before touching production.
--
-- What it changes
--   1. pos_* tables: split FOR ALL membership policy into per-command policies.
--        SELECT: any member of the shop (an expired shop can still read/export its own data).
--        INSERT/UPDATE: any member AND subscription writable (ACTIVE/EXPIRING_SOON, 7-day grace after expiry).
--        DELETE: shop OWNER only (and subscription writable).
--        pos_family_expenses: owner only for every command (family-finance isolation).
--   2. shop_id can never be changed on an existing row (blocks moving data between shops).
--   3. Money sanity CHECKs added NOT VALID: they apply to new/changed rows only, so existing data is never
--      rejected. Validate later with the ALTER TABLE ... VALIDATE CONSTRAINT lines at the bottom.
--   4. Index on (shop_id, receipt); per-shop unique receipts are an opt-in block (see section 4).
--   5. saas_subscription_audit becomes append-only (super admins can insert/read, nobody can edit/delete).
--   6. anon loses all table privileges on private tables; authenticated cannot write shop_members directly.
--   7. search_path pinned on the v4 helper functions.
--
-- Offline policy: a shop whose subscription lapsed keeps full local use and read access. Writes sync during a
-- 7-day grace after expiry_date (constant in shop_is_writable()); after that the server refuses writes and the
-- sync queue keeps the jobs as 'blocked' until the subscription is renewed.
-- ==========================================================

-- ---------- 0. helpers ----------
CREATE OR REPLACE FUNCTION public.shop_is_writable(p_shop_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- A shop with no tenant row yet (legacy claim_shop v3) is treated as writable so nobody is locked out.
  SELECT coalesce(
    (SELECT t.status IN ('ACTIVE', 'EXPIRING_SOON') AND t.expiry_date + 7 >= current_date
       FROM saas_tenants t WHERE t.id = p_shop_id),
    true);
$$;
REVOKE ALL ON FUNCTION public.shop_is_writable(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.shop_is_writable(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_shop_id_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
    RAISE EXCEPTION 'shop_id cannot be changed (table %)', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;

-- ---------- 1+2. per-command RLS and shop_id immutability ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pos_transactions','pos_stock','pos_expenses','pos_debts','pos_customers'] LOOP
    -- drop the v2 catch-all policies (names from v2) and any earlier run of this file
    EXECUTE format('DROP POLICY IF EXISTS "Members can access their shop transactions" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members can access their shop stock" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members can access their shop expenses" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members can access their shop debts" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Members can access their shop customers" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "sellora select" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "sellora insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "sellora update" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "sellora delete" ON %I', t);
    EXECUTE format('CREATE POLICY "sellora select" ON %I FOR SELECT TO authenticated USING (public.is_shop_member(shop_id))', t);
    EXECUTE format('CREATE POLICY "sellora insert" ON %I FOR INSERT TO authenticated WITH CHECK (public.is_shop_member(shop_id) AND public.shop_is_writable(shop_id))', t);
    EXECUTE format('CREATE POLICY "sellora update" ON %I FOR UPDATE TO authenticated USING (public.is_shop_member(shop_id) AND public.shop_is_writable(shop_id)) WITH CHECK (public.is_shop_member(shop_id) AND public.shop_is_writable(shop_id))', t);
    EXECUTE format('CREATE POLICY "sellora delete" ON %I FOR DELETE TO authenticated USING (public.is_shop_member(shop_id, true) AND public.shop_is_writable(shop_id))', t);
  END LOOP;

  -- family finance: owner only, every command
  DROP POLICY IF EXISTS "Members can access their shop family expenses" ON pos_family_expenses;
  DROP POLICY IF EXISTS "sellora owner all" ON pos_family_expenses;
  CREATE POLICY "sellora owner all" ON pos_family_expenses FOR ALL TO authenticated
    USING (public.is_shop_member(shop_id, true))
    WITH CHECK (public.is_shop_member(shop_id, true) AND public.shop_is_writable(shop_id));

  FOREACH t IN ARRAY ARRAY['pos_transactions','pos_stock','pos_expenses','pos_debts','pos_customers','pos_family_expenses'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_no_shop_change ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_no_shop_change BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.prevent_shop_id_change()', t, t);
  END LOOP;
END $$;

-- ---------- 3. money / integrity CHECK constraints (NOT VALID: existing rows untouched) ----------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('pos_transactions',    'chk_pos_tx_amounts',       'qty >= 0 AND unit_price >= 0 AND total >= 0 AND coalesce(material_cost, 0) >= 0'),
    ('pos_expenses',        'chk_pos_exp_amount',       'amount >= 0'),
    ('pos_family_expenses', 'chk_pos_fam_amount',       'amount >= 0'),
    ('pos_debts',           'chk_pos_debt_amounts',     'original >= 0 AND paid >= 0 AND paid <= original'),
    ('pos_stock',           'chk_pos_stock_nonneg',     'unit_cost >= 0 AND retail_price >= 0 AND opening_stock >= 0 AND stock_added >= 0 AND damaged_stock >= 0 AND reorder_level >= 0')
  ) AS v(tbl, cname, expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.cname) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID', r.tbl, r.cname, r.expr);
    END IF;
  END LOOP;
END $$;

-- ---------- 4. receipt lookup index (+ OPTIONAL per-shop uniqueness) ----------
CREATE INDEX IF NOT EXISTS idx_pos_tx_shop_receipt ON pos_transactions (shop_id, receipt);
-- OPTIONAL - enable ONLY after every device issues device-tagged receipts (src/utils/receipt.ts deviceTag).
-- Until then two offline devices can legitimately mint the same untagged number, and a hard unique index would
-- make the second sale fail to sync permanently. Check for existing duplicates first (audit queries, section 5):
--   CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_tx_shop_receipt ON pos_transactions (shop_id, receipt) WHERE receipt IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pos_debts_shop ON pos_debts (shop_id);
CREATE INDEX IF NOT EXISTS idx_pos_customers_shop ON pos_customers (shop_id);
CREATE INDEX IF NOT EXISTS idx_pos_stock_shop ON pos_stock (shop_id);
CREATE INDEX IF NOT EXISTS idx_pos_expenses_shop ON pos_expenses (shop_id);
CREATE INDEX IF NOT EXISTS idx_pos_family_shop ON pos_family_expenses (shop_id);
CREATE INDEX IF NOT EXISTS idx_pos_tx_shop_date ON pos_transactions (shop_id, date DESC);

-- ---------- 5. subscription audit log: append-only ----------
DROP POLICY IF EXISTS "Super admins manage audit log" ON saas_subscription_audit;
DROP POLICY IF EXISTS "sellora audit read" ON saas_subscription_audit;
DROP POLICY IF EXISTS "sellora audit insert" ON saas_subscription_audit;
CREATE POLICY "sellora audit read"   ON saas_subscription_audit FOR SELECT TO authenticated USING (public.is_super_admin());
CREATE POLICY "sellora audit insert" ON saas_subscription_audit FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
REVOKE UPDATE, DELETE, TRUNCATE ON saas_subscription_audit FROM anon, authenticated;

-- ---------- 6. privileges ----------
REVOKE ALL ON pos_transactions, pos_stock, pos_expenses, pos_debts, pos_customers, pos_family_expenses,
              saas_tenants, saas_subscription_audit, shop_members, super_admins FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON shop_members FROM authenticated;   -- membership changes go through claim_shop()
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON super_admins FROM authenticated;   -- promote admins from the SQL editor only
REVOKE TRUNCATE ON pos_transactions, pos_stock, pos_expenses, pos_debts, pos_customers, pos_family_expenses, saas_tenants FROM authenticated;

-- ---------- 7. search_path on v4 helpers ----------
ALTER FUNCTION public.print_hash_key(text) SET search_path = public;
ALTER FUNCTION public.print_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.print_jobs_same_shop() SET search_path = public;

-- ==========================================================
-- AFTER you have reviewed the existing data (supabase-audit-queries.sql section 5), you may enforce the
-- CHECK constraints on historical rows too. Each statement fails harmlessly if bad rows exist.
--   ALTER TABLE pos_transactions    VALIDATE CONSTRAINT chk_pos_tx_amounts;
--   ALTER TABLE pos_expenses        VALIDATE CONSTRAINT chk_pos_exp_amount;
--   ALTER TABLE pos_family_expenses VALIDATE CONSTRAINT chk_pos_fam_amount;
--   ALTER TABLE pos_debts           VALIDATE CONSTRAINT chk_pos_debt_amounts;
--   ALTER TABLE pos_stock           VALIDATE CONSTRAINT chk_pos_stock_nonneg;
-- ==========================================================
