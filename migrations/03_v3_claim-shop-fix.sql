-- ==========================================================
-- MAMA JUSTO / SELLORA POS - SECURITY FIX MIGRATION (v3)
-- ==========================================================
-- WHY THIS EXISTS:
-- v2 (supabase-schema-v2-security-fix.sql) correctly moved data
-- access from the open `anon` role to shop-scoped `authenticated`
-- policies via a shop_members table. But the INSERT policy that
-- let a signed-in user "claim" a shop only checked
--   WITH CHECK (user_id = auth.uid())
-- with NO check on shop_id. Combined with the client choosing
-- shop_id from local, editable app state (default values like
-- 'shop_main'), ANY signed-up user could insert themselves as
-- 'owner' of ANY shop_id and gain full read/write access to that
-- shop's transactions, expenses, debts, stock, and customers.
--
-- This migration:
--   1. Removes the open self-service INSERT policy on shop_members.
--   2. Adds claim_shop(p_shop_id), a SECURITY DEFINER function that
--      only allows the FIRST signup for a given shop_id to become
--      its owner. Once a shop has any member, further claim
--      attempts are rejected - additional staff must be added by
--      an existing owner through a future invite feature (not yet
--      built; there is currently no in-app way to add staff).
--
-- Run this AFTER supabase-schema-v2-security-fix.sql. Safe to re-run.
-- The client (src/services/supabase.ts) must call the RPC:
--   client.rpc('claim_shop', { p_shop_id: shopId })
-- instead of upserting into shop_members directly - direct inserts
-- are now blocked by RLS.
-- ==========================================================

DROP POLICY IF EXISTS "Users can add themselves to a shop" ON shop_members;

CREATE OR REPLACE FUNCTION public.claim_shop(p_shop_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_shop_id IS NULL OR length(trim(p_shop_id)) = 0 THEN
    RAISE EXCEPTION 'shop_id is required';
  END IF;

  IF EXISTS (SELECT 1 FROM shop_members WHERE shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'This shop is already claimed. Ask the shop owner to add you as staff.';
  END IF;

  INSERT INTO shop_members (user_id, shop_id, role)
  VALUES (auth.uid(), p_shop_id, 'owner');
END;
$$;

REVOKE ALL ON FUNCTION public.claim_shop(text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_shop(text) TO authenticated;

-- Supabase's default privilege grants leave EXECUTE open to `anon` on newly
-- created functions regardless of the REVOKE FROM PUBLIC above. claim_shop()
-- already refuses unauthenticated callers internally (auth.uid() IS NULL
-- check), but revoke anon's grant explicitly too, as defense in depth.
REVOKE EXECUTE ON FUNCTION public.claim_shop(text) FROM anon;
