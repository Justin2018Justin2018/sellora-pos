-- ==========================================================
-- SELLORA v7 - AUDITED VOID (CANCEL) OF A SALE
-- Run after v6. Idempotent. Non-destructive: the sale row is KEPT with status = 'cancelled'; only the status and a
-- note change, and the previous row is snapshotted into the append-only pos_audit_log.
--
-- Why: v6 (correctly) stops API roles from changing a sale's status, so the app's "Void/Cancel" button could only ever
-- cancel on the device that clicked it - other devices kept counting the sale as revenue. This function is the single,
-- server-checked way to cancel a synced sale. Owner only; a reason is mandatory; repeating it is harmless.
--
-- Status of this file: executed and tested on PostgreSQL 16 with a Supabase stand-in (tests/sql/admin_void_checks.sql).
-- NOT applied to your real Supabase project - that is a manual step.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.admin_void_transaction(
  p_shop_id text, p_receipt text, p_date timestamptz DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ids text[]; n int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_member(p_shop_id, true) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF p_receipt IS NULL OR btrim(p_receipt) = '' THEN
    RETURN jsonb_build_object('status', 'bad_request', 'message', 'receipt is required');
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 3 THEN
    RETURN jsonb_build_object('status', 'bad_request', 'message', 'a reason of at least 3 characters is required');
  END IF;
  IF NOT public.shop_is_writable(p_shop_id) THEN RETURN jsonb_build_object('status', 'subscription_inactive'); END IF;

  SELECT array_agg(t.id) INTO ids FROM public.pos_transactions t
   WHERE t.shop_id = p_shop_id AND t.receipt = p_receipt;
  IF coalesce(array_length(ids, 1), 0) > 1 AND p_date IS NOT NULL THEN
    SELECT array_agg(t.id) INTO ids FROM public.pos_transactions t
     WHERE t.shop_id = p_shop_id AND t.receipt = p_receipt AND abs(extract(epoch FROM (t.date - p_date))) < 1;
  END IF;
  IF coalesce(array_length(ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('status', 'ok', 'voided', 0);   -- nothing in the cloud (never synced): not an error
  END IF;

  WITH old AS (
    SELECT to_jsonb(t) AS snap, t.id FROM public.pos_transactions t
     WHERE t.shop_id = p_shop_id AND t.id = ANY (ids) AND t.status IS DISTINCT FROM 'cancelled' FOR UPDATE
  ), upd AS (
    UPDATE public.pos_transactions t
       SET status = 'cancelled',
           notes  = CASE WHEN t.notes IS NULL OR t.notes = '' THEN 'Cancelled: ' || btrim(p_reason)
                         ELSE t.notes || ' | Cancelled: ' || btrim(p_reason) END
      FROM old WHERE t.id = old.id RETURNING old.snap
  ), logged AS (
    INSERT INTO public.pos_audit_log (shop_id, actor, action, entity, entity_ref, reason, snapshot)
    SELECT p_shop_id, auth.uid(), 'TRANSACTION_VOIDED', 'pos_transactions', p_receipt, btrim(p_reason), snap FROM upd
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN jsonb_build_object('status', 'ok', 'voided', n);
END; $$;

REVOKE ALL ON FUNCTION public.admin_void_transaction(text, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_void_transaction(text, text, timestamptz, text) TO authenticated;
