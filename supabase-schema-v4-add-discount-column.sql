-- ==========================================================
-- SELLORA POS - ADD DISCOUNT COLUMN (v4)
-- ==========================================================
-- WHY THIS EXISTS:
-- SaleView.tsx, GeneralSaleView.tsx, ReceiptModal.tsx, printReceipt.ts,
-- and electronicsReceiptAdapter.ts all read/write a `discount` field on
-- a transaction. The Transaction type didn't declare it, and this
-- table never had a matching column, so any discount applied during a
-- sale displayed correctly on the receipt in that session but was
-- never actually persisted - it silently vanished on refresh, re-login,
-- or re-fetch from Supabase.
--
-- This migration adds the missing column. It is purely additive
-- (ADD COLUMN ... DEFAULT 0), so it is safe to run against a table
-- that already has production rows - existing rows simply get
-- discount = 0, which matches their actual (undiscounted) history.
--
-- Run this AFTER supabase-schema-v3-claim-shop-fix.sql. Safe to re-run.
-- ==========================================================

ALTER TABLE pos_transactions
  ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0;
