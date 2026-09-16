-- ==========================================================
-- SELLORA POS - M-PESA (DARAJA) INTEGRATION MIGRATION (v6)
-- ==========================================================
-- WHY THIS EXISTS:
-- Real M-Pesa STK Push requires a server component: Safaricom needs a
-- public callback URL to report the payment result, and your Consumer
-- Secret / Passkey must never be shipped to the browser. This table is
-- the hand-off point between the mpesa-stkpush and mpesa-callback edge
-- functions (which hold the secrets and talk to Safaricom) and the app
-- (which only ever reads its own shop's rows to learn the outcome).
--
-- Run this AFTER supabase-schema-v3-claim-shop-fix.sql (and v4/v5 if
-- you've applied them). Safe to re-run.
-- ==========================================================

CREATE TABLE IF NOT EXISTS mpesa_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id TEXT NOT NULL,
    checkout_request_id TEXT UNIQUE NOT NULL,
    merchant_request_id TEXT,
    phone TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    account_reference TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | success | failed | cancelled
    result_code INTEGER,
    result_desc TEXT,
    mpesa_receipt TEXT,
    transaction_date TEXT,
    initiated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_tx_shop ON mpesa_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_status ON mpesa_transactions(status);

ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Shop members may only READ their own shop's M-Pesa transactions, so the
-- app can poll for the result of a payment it just triggered. There is
-- deliberately NO insert/update/delete policy for regular users - only
-- the edge functions (using the service_role key, which bypasses RLS
-- entirely) are allowed to write rows. This stops anyone from faking a
-- "success" status by calling the REST API directly.
DROP POLICY IF EXISTS "Members can view their shop mpesa transactions" ON mpesa_transactions;
CREATE POLICY "Members can view their shop mpesa transactions" ON mpesa_transactions
    FOR SELECT TO authenticated
    USING (shop_id IN (SELECT shop_id FROM shop_members WHERE user_id = auth.uid()));

-- Keep updated_at current on every server-side write.
CREATE OR REPLACE FUNCTION public.set_mpesa_tx_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_mpesa_tx_updated_at ON mpesa_transactions;
CREATE TRIGGER trg_mpesa_tx_updated_at
  BEFORE UPDATE ON mpesa_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_mpesa_tx_updated_at();
