-- SELLORA POS - BUSINESS ISOLATION SECURITY TESTS
-- Run AFTER supabase-schema-v4-business-isolation.sql in a test project.
-- Replace TEST_SHOP_ID / TEST_USER_ID with test fixtures where needed.
-- The important checks are that unauthorized SELECT/INSERT/UPDATE/DELETE
-- operations return zero rows or a permission/RLS error.

-- 1) Shop-only customer: only the subscribed business should be visible.
-- Expected: one ACTIVE business_subscriptions row for the shop and SELECTs
-- on other business_type rows return no rows.
SELECT business_type, status, expiry_date
FROM business_subscriptions
WHERE shop_id = 'TEST_SHOP_ID'
ORDER BY business_type;

SELECT id, business_type
FROM pos_transactions
WHERE shop_id = 'TEST_SHOP_ID'
  AND business_type = 'gas';
-- Expected: 0 rows unless gas is actively subscribed.

-- 2) Cyber-only direct API/database attempt against Gas.
-- Expected: RLS blocks/filters the row even if the request supplies gas.
SELECT * FROM pos_stock
WHERE shop_id = 'TEST_SHOP_ID' AND business_type = 'gas';

-- 3) Shop + Cyber: both should be independently readable.
SELECT business_type, count(*)
FROM pos_transactions
WHERE shop_id = 'TEST_SHOP_ID'
GROUP BY business_type
ORDER BY business_type;

-- 4) All-business bundle: one `all` subscription grants every concrete type
-- through has_active_business_subscription(). No `all` operating mode is used.
SELECT public.has_active_business_subscription('TEST_SHOP_ID', 'cyber');
SELECT public.has_active_business_subscription('TEST_SHOP_ID', 'gas');
SELECT public.has_active_business_subscription('TEST_SHOP_ID', 'electronics');

-- 5) Expired subscription: force a test entitlement into the past.
-- Expected: helper returns false immediately, without deleting historical data.
UPDATE business_subscriptions
SET status = 'ACTIVE', expiry_date = CURRENT_DATE - 1
WHERE shop_id = 'TEST_SHOP_ID' AND business_type = 'gas';
SELECT public.has_active_business_subscription('TEST_SHOP_ID', 'gas');
SELECT count(*) AS historical_rows_preserved
FROM pos_transactions
WHERE shop_id = 'TEST_SHOP_ID' AND business_type = 'gas';

-- 6) Cancelled subscription.
UPDATE business_subscriptions
SET status = 'CANCELLED', cancelled_at = NOW()
WHERE shop_id = 'TEST_SHOP_ID' AND business_type = 'cyber';
SELECT public.has_active_business_subscription('TEST_SHOP_ID', 'cyber');

-- 7) Re-enable a business and verify it remains separate from another type.
UPDATE business_subscriptions
SET status = 'ACTIVE', expiry_date = CURRENT_DATE + 30, cancelled_at = NULL
WHERE shop_id = 'TEST_SHOP_ID' AND business_type = 'cyber';
SELECT public.has_active_business_subscription('TEST_SHOP_ID', 'cyber');
SELECT public.has_active_business_subscription('TEST_SHOP_ID', 'gas');

-- 8) Attempt to manufacture access from the customer client.
-- Expected: INSERT/UPDATE against business_subscriptions is rejected by RLS
-- for ordinary shop members. Only the trusted backend/payment process or
-- super_admin may create ACTIVE entitlement rows.
-- Do NOT run these as a super admin; run as the test customer:
-- INSERT INTO business_subscriptions (id, shop_id, business_type, status, plan, billing_cycle, expiry_date)
-- VALUES ('attack_test', 'TEST_SHOP_ID', 'gas', 'ACTIVE', 'STANDARD', 'monthly', CURRENT_DATE + 30);

-- 9) Customer may submit a request, but it is NOT an entitlement.
INSERT INTO business_subscription_requests (shop_id, business_type, plan, billing_cycle)
VALUES ('TEST_SHOP_ID', 'gas', 'STANDARD', 'monthly');

SELECT status
FROM business_subscription_requests
WHERE shop_id = 'TEST_SHOP_ID'
  AND business_type = 'gas'
ORDER BY created_at DESC
LIMIT 1;
-- Expected: PENDING. It must not make has_active_business_subscription() true.
