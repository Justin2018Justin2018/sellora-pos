-- ==========================================================
-- SELLORA - READ-ONLY AUDIT QUERIES for a LIVE database
-- Paste into the Supabase SQL editor. Nothing here modifies data.
-- Run BEFORE applying v3b/v5 and send the results back: the repo SQL and the deployed database have drifted,
-- and these queries show what is actually deployed.
-- ==========================================================

-- 1. Which tables have RLS enabled?  (every pos_/saas_/shop_/super_/print_ table should be true)
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1;

-- 2. EVERY policy. Look for qual = 'true' or roles containing 'anon' on private tables (critical).
SELECT tablename, policyname, cmd, roles, qual AS using_expr, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, cmd, policyname;

-- 3. Functions: SECURITY DEFINER ones, their search_path setting and who may execute them.
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef AS security_definer,
       p.proconfig AS settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' ORDER BY p.proname, args;

-- 4. Drift check: columns the application code expects. Each row should say present = true.
SELECT x.tbl, x.col, EXISTS (SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public' AND c.table_name = x.tbl AND c.column_name = x.col) AS present
FROM (VALUES ('saas_tenants','business_type'), ('super_admins','pin_hash'),
             ('pos_transactions','payload'), ('pos_transactions','device_id'), ('pos_transactions','synced_at'),
             ('saas_subscription_audit','actor_user_id')) AS x(tbl, col);
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pos_transactions' AND column_name = 'id';   -- text expected
-- foreign key needed for the PostgREST embed shop_members -> saas_tenants:
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
WHERE conrelid = 'public.shop_members'::regclass AND contype = 'f';

-- 5. Data that would block the new constraints / unique indexes (all should return 0 rows).
SELECT shop_id, receipt, count(*) FROM pos_transactions WHERE receipt IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1;
SELECT shop_id, count(*) AS owners FROM shop_members WHERE role = 'owner' GROUP BY 1 HAVING count(*) > 1;
SELECT 'pos_transactions' AS tbl, id, shop_id, receipt, qty, unit_price, total FROM pos_transactions
  WHERE qty < 0 OR unit_price < 0 OR total < 0 OR coalesce(material_cost, 0) < 0 LIMIT 50;
SELECT 'pos_debts' AS tbl, id, shop_id, original, paid FROM pos_debts WHERE original < 0 OR paid < 0 OR paid > original LIMIT 50;
SELECT 'pos_expenses' AS tbl, id, shop_id, amount FROM pos_expenses WHERE amount < 0 LIMIT 50;

-- 6. Sensitive columns that should be empty.
SELECT count(*) AS tenants_with_password_hash FROM saas_tenants WHERE password_hash IS NOT NULL;

-- 7. Anyone holding table privileges they should not (anon should have none on private tables).
SELECT grantee, table_name, string_agg(privilege_type, ', ') AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
  AND table_name IN ('pos_transactions','pos_stock','pos_expenses','pos_debts','pos_customers','pos_family_expenses',
                     'saas_tenants','saas_subscription_audit','shop_members','super_admins')
GROUP BY grantee, table_name ORDER BY table_name, grantee;

-- 8. Members that point at shops with no tenant row, and tenants with no members.
SELECT m.shop_id FROM shop_members m LEFT JOIN saas_tenants t ON t.id = m.shop_id WHERE t.id IS NULL GROUP BY 1;
SELECT t.id FROM saas_tenants t LEFT JOIN shop_members m ON m.shop_id = t.id WHERE m.shop_id IS NULL;
