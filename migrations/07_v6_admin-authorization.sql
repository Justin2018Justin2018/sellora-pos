-- ==========================================================
-- SELLORA v6 - SERVER-VERIFIED ADMIN AUTHORIZATION FOR SALES
-- Run after v1..v5. Idempotent. Non-destructive: no row is rewritten or dropped.
--
-- Status of this file: executed and tested on PostgreSQL 16 with a Supabase stand-in (tests/sql/supabase_shim.sql,
-- tests/sql/admin_delete_checks.sql). NOT yet applied to your real Supabase project - that is a manual step.
--
-- Why this exists (verified on a real database, see AUDIT_REPORT.md):
--   * v5 made DELETE "owner only" via RLS, but an RLS-blocked DELETE returns 0 rows and NO error. The client treated that
--     as success, removed the sale locally, and the sale re-appeared on the next sync ("delete does not work").
--   * Any shop member could UPDATE pos_transactions.total/qty/status through the API (a cashier could rewrite a sale).
--   * The admin password for deletes was only ever checked in the browser against a value kept in localStorage.
--
-- What it adds
--   1. shop_admin_credentials : bcrypt hash of the shop's admin password. Unreadable by API roles. Throttled
--      (5 wrong tries -> 15 minute lock).
--   2. pos_audit_log          : append-only (also blocked for the table owner by trigger). Holds a full JSON snapshot of
--      every sale deleted through the admin function, so a deletion is an audited archive, not a silent loss.
--   3. Functions (SECURITY DEFINER, pinned search_path, callable by `authenticated` only):
--        shop_admin_secret_status(shop)               -> {configured}
--        set_shop_admin_secret(shop, new, current?)   -> owner only; current secret required once one exists
--        admin_delete_transaction(shop, receipt, date?, reason?, secret)
--   4. Direct DELETE on pos_transactions is REVOKED from API roles (deletion only through admin_delete_transaction).
--   5. A trigger stops API roles from changing money/identity columns of an existing sale (idempotent re-upserts of
--      identical values from the offline queue still work). Notes/customer/staff stay editable.
--
-- Recovery if the admin password is forgotten (needs access to the Supabase SQL editor = the project owner):
--   DELETE FROM shop_admin_credentials WHERE shop_id = '<shop id>';   -- then the shop owner sets a new one in Settings.
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------- 1. credentials ----------
CREATE TABLE IF NOT EXISTS public.shop_admin_credentials (
  shop_id         text PRIMARY KEY,
  secret_hash     text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  updated_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_admin_credentials ENABLE ROW LEVEL SECURITY;   -- no policies: API roles can never read it
REVOKE ALL ON public.shop_admin_credentials FROM PUBLIC, anon, authenticated;

-- ---------- 2. append-only audit log ----------
CREATE TABLE IF NOT EXISTS public.pos_audit_log (
  id         bigserial PRIMARY KEY,
  shop_id    text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  actor      uuid,
  action     text NOT NULL,
  entity     text,
  entity_ref text,
  reason     text,
  snapshot   jsonb
);
CREATE INDEX IF NOT EXISTS idx_pos_audit_shop_at ON public.pos_audit_log (shop_id, at DESC);
ALTER TABLE public.pos_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sellora audit owner read" ON public.pos_audit_log;
CREATE POLICY "sellora audit owner read" ON public.pos_audit_log FOR SELECT TO authenticated
  USING (public.is_shop_member(shop_id, true));
REVOKE ALL ON public.pos_audit_log FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.pos_audit_log FROM authenticated;
GRANT SELECT ON public.pos_audit_log TO authenticated;
REVOKE ALL ON SEQUENCE public.pos_audit_log_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pos_audit_log_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  RAISE EXCEPTION 'pos_audit_log is append-only' USING ERRCODE = '42501';
END; $$;
DROP TRIGGER IF EXISTS trg_pos_audit_log_immutable ON public.pos_audit_log;
CREATE TRIGGER trg_pos_audit_log_immutable BEFORE UPDATE OR DELETE ON public.pos_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.pos_audit_log_immutable();

-- ---------- 3. functions ----------
-- Internal: verifies the caller is a member of the shop and that the secret matches. Never raises for a wrong secret
-- (a RAISE would roll back the failed-attempt counter). Returns: ok | invalid | locked | not_configured | forbidden.
CREATE OR REPLACE FUNCTION public._check_shop_admin_secret(p_shop_id text, p_secret text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE c public.shop_admin_credentials%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_member(p_shop_id) THEN RETURN 'forbidden'; END IF;
  SELECT * INTO c FROM public.shop_admin_credentials WHERE shop_id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_configured'; END IF;
  IF c.locked_until IS NOT NULL AND c.locked_until > now() THEN RETURN 'locked'; END IF;
  IF p_secret IS NOT NULL AND c.secret_hash = crypt(p_secret, c.secret_hash) THEN
    IF c.failed_attempts <> 0 OR c.locked_until IS NOT NULL THEN
      UPDATE public.shop_admin_credentials SET failed_attempts = 0, locked_until = NULL WHERE shop_id = p_shop_id;
    END IF;
    RETURN 'ok';
  END IF;
  UPDATE public.shop_admin_credentials
     SET failed_attempts = CASE WHEN failed_attempts + 1 >= 5 THEN 0 ELSE failed_attempts + 1 END,
         locked_until    = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
   WHERE shop_id = p_shop_id;
  RETURN 'invalid';
END; $$;
REVOKE ALL ON FUNCTION public._check_shop_admin_secret(text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.shop_admin_secret_status(p_shop_id text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_member(p_shop_id) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  RETURN jsonb_build_object('status', 'ok',
    'configured', EXISTS (SELECT 1 FROM public.shop_admin_credentials WHERE shop_id = p_shop_id));
END; $$;

CREATE OR REPLACE FUNCTION public.set_shop_admin_secret(p_shop_id text, p_new text, p_current text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE st text; had boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_member(p_shop_id, true) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF p_new IS NULL OR length(btrim(p_new)) < 6 THEN
    RETURN jsonb_build_object('status', 'weak', 'message', 'Use at least 6 characters.');
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.shop_admin_credentials WHERE shop_id = p_shop_id) INTO had;
  IF had THEN
    st := public._check_shop_admin_secret(p_shop_id, p_current);
    IF st <> 'ok' THEN RETURN jsonb_build_object('status', st); END IF;
  END IF;
  INSERT INTO public.shop_admin_credentials (shop_id, secret_hash, updated_by, updated_at)
  VALUES (p_shop_id, crypt(btrim(p_new), gen_salt('bf', 10)), auth.uid(), now())
  ON CONFLICT (shop_id) DO UPDATE
    SET secret_hash = EXCLUDED.secret_hash, failed_attempts = 0, locked_until = NULL,
        updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.pos_audit_log (shop_id, actor, action, entity, entity_ref)
  VALUES (p_shop_id, auth.uid(), CASE WHEN had THEN 'ADMIN_SECRET_CHANGED' ELSE 'ADMIN_SECRET_SET' END, 'shop', p_shop_id);
  RETURN jsonb_build_object('status', 'ok');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_delete_transaction(
  p_shop_id text, p_receipt text, p_date timestamptz DEFAULT NULL, p_reason text DEFAULT NULL, p_secret text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE st text; n int; ids text[];
BEGIN
  IF p_receipt IS NULL OR btrim(p_receipt) = '' THEN
    RETURN jsonb_build_object('status', 'bad_request', 'message', 'receipt is required');
  END IF;
  st := public._check_shop_admin_secret(p_shop_id, p_secret);
  IF st <> 'ok' THEN RETURN jsonb_build_object('status', st); END IF;
  IF NOT public.shop_is_writable(p_shop_id) THEN RETURN jsonb_build_object('status', 'subscription_inactive'); END IF;

  -- Exactly the row(s) for this receipt. If two devices ever minted the same receipt number, narrow by timestamp so
  -- the other sale is not deleted with it.
  SELECT array_agg(t.id) INTO ids FROM public.pos_transactions t
   WHERE t.shop_id = p_shop_id AND t.receipt = p_receipt;
  IF coalesce(array_length(ids, 1), 0) > 1 AND p_date IS NOT NULL THEN
    SELECT array_agg(t.id) INTO ids FROM public.pos_transactions t
     WHERE t.shop_id = p_shop_id AND t.receipt = p_receipt AND abs(extract(epoch FROM (t.date - p_date))) < 1;
  END IF;
  IF coalesce(array_length(ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('status', 'ok', 'deleted', 0);   -- nothing in the cloud (e.g. never synced): not an error
  END IF;

  WITH gone AS (
    DELETE FROM public.pos_transactions t WHERE t.shop_id = p_shop_id AND t.id = ANY (ids) RETURNING to_jsonb(t) AS snap, t.id
  ), logged AS (
    INSERT INTO public.pos_audit_log (shop_id, actor, action, entity, entity_ref, reason, snapshot)
    SELECT p_shop_id, auth.uid(), 'TRANSACTION_DELETED', 'pos_transactions', p_receipt, p_reason, snap FROM gone
    RETURNING 1
  )
  SELECT count(*) INTO n FROM gone;
  RETURN jsonb_build_object('status', 'ok', 'deleted', n);
END; $$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.shop_admin_secret_status(text)',
    'public.set_shop_admin_secret(text, text, text)',
    'public.admin_delete_transaction(text, text, timestamptz, text, text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- ---------- 4. no direct DELETE of sales through the API ----------
REVOKE DELETE, TRUNCATE ON public.pos_transactions FROM anon, authenticated;

-- ---------- 5. money / identity columns of an existing sale are immutable for API roles ----------
CREATE OR REPLACE FUNCTION public.guard_pos_transaction_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  -- Only API-facing roles are restricted. SECURITY DEFINER functions run as their owner and the SQL editor / service role
  -- are not restricted, so deliberate administrative corrections remain possible there.
  IF current_user IN ('anon', 'authenticated') AND (
       NEW.qty           IS DISTINCT FROM OLD.qty
    OR NEW.unit_price    IS DISTINCT FROM OLD.unit_price
    OR NEW.total         IS DISTINCT FROM OLD.total
    OR NEW.material_cost IS DISTINCT FROM OLD.material_cost
    OR NEW.receipt       IS DISTINCT FROM OLD.receipt
    OR NEW.date          IS DISTINCT FROM OLD.date
    OR NEW.status        IS DISTINCT FROM OLD.status
    OR NEW.payment       IS DISTINCT FROM OLD.payment
    OR NEW.service       IS DISTINCT FROM OLD.service) THEN
    RAISE EXCEPTION 'A recorded sale cannot be changed through the API (amounts, receipt, date, status, payment). Use the admin functions.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_pos_transactions_guard_update ON public.pos_transactions;
CREATE TRIGGER trg_pos_transactions_guard_update BEFORE UPDATE ON public.pos_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_pos_transaction_update();
