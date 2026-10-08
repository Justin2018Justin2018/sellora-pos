-- ==========================================================
-- SELLORA v8 - FIXES FOR DEFECTS FOUND IN v1..v7
-- Run AFTER v7 (v1, v2, v3, v3b, v4, v5, v6, v7, then this file).
-- Idempotent: safe to run twice. Drops no table and no column. The ONLY data it moves is
-- saas_tenants.password_hash (copied to a private table first, see section 3).
--
-- !! BACK UP FIRST. Run it on a Supabase branch / staging copy before production.
-- !! Tested on PostgreSQL 16 with a Supabase stand-in (roles + auth.uid()). NOT applied to your real project.
--
-- Every item below was reproduced on a database built from v1..v7 before being fixed:
--   1. v6  admin password check compared an UNTRIMMED value while setting stored a TRIMMED one
--          (a trailing space = "invalid" + counts toward lockout).
--   2. v6  one shared lockout counter per shop: any member's 5 wrong guesses locked everyone, owner included.
--          Now counted per signed-in user.   (If every cashier uses the owner's cloud login, they still share
--          one counter - that is inherent; see docs note at the bottom.)
--   3. v6/v7 deleting/voiding by receipt with no date acted on EVERY sale sharing that receipt number.
--          Now returns status 'ambiguous' and changes nothing.
--   4. v6  the guard on recorded sales ignored `payload`, but the app displays sales FROM payload when present:
--          a member could change payload.total / payload.status and every other device would show it.
--   5. v7  void changed only the row's status; the app reads payload.status, so other devices kept counting a
--          voided sale as revenue. Void now updates payload too, and existing mismatches are repaired.
--   6. v3b saas_tenants.password_hash readable by every shop member (own-tenant read policy returns all columns).
--   7. v3/v3b claim_shop(text) - the normal signup path - creates NO tenant row, and shop_is_writable() treats a
--          missing row as writable, so every new signup is free and never expires. It now creates the 14-day trial row.
--   8. v3/v3b shop ids were not validated (spaces, quotes, any length) and one account could claim unlimited shops.
--   9. v4  print tables / print agent ignored expiry_date (status is never flipped by the database), so an
--          expired Cyber shop kept writing and its agents kept working.
--  10. v4  any member could UPDATE a billed print job back to 'unbilled' or rewrite its amount (double billing /
--          hidden revenue). Billing is now forward-only for API roles.
-- ==========================================================

-- ---------- 1+2. admin-secret check: trim, per-user lockout ----------
CREATE TABLE IF NOT EXISTS public.shop_admin_attempts (
  shop_id         text NOT NULL,
  user_id         uuid NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  PRIMARY KEY (shop_id, user_id)
);
ALTER TABLE public.shop_admin_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shop_admin_attempts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._check_shop_admin_secret(p_shop_id text, p_secret text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
DECLARE c public.shop_admin_credentials%ROWTYPE; a public.shop_admin_attempts%ROWTYPE; v_secret text := btrim(p_secret);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_member(p_shop_id) THEN RETURN 'forbidden'; END IF;
  SELECT * INTO c FROM public.shop_admin_credentials WHERE shop_id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_configured'; END IF;
  -- shop_admin_credentials.locked_until keeps its v6 meaning as a SHOP-WIDE manual lock/unlock switch:
  --   future time => everyone locked; a time in the past (or an expired lock) => every per-user lockout is cleared.
  -- To unlock a shop from the SQL editor: UPDATE shop_admin_credentials SET locked_until = now() - interval '1 minute' WHERE shop_id = '...';
  IF c.locked_until IS NOT NULL THEN
    IF c.locked_until > now() THEN RETURN 'locked'; END IF;
    UPDATE public.shop_admin_attempts SET failed_attempts = 0, locked_until = NULL WHERE shop_id = p_shop_id;
    UPDATE public.shop_admin_credentials SET failed_attempts = 0, locked_until = NULL WHERE shop_id = p_shop_id;
  END IF;
  INSERT INTO public.shop_admin_attempts (shop_id, user_id) VALUES (p_shop_id, auth.uid()) ON CONFLICT DO NOTHING;
  SELECT * INTO a FROM public.shop_admin_attempts WHERE shop_id = p_shop_id AND user_id = auth.uid() FOR UPDATE;
  IF a.locked_until IS NOT NULL AND a.locked_until > now() THEN RETURN 'locked'; END IF;
  -- set_shop_admin_secret stores btrim(new), so the comparison must trim as well.
  IF v_secret IS NOT NULL AND c.secret_hash = crypt(v_secret, c.secret_hash) THEN
    IF a.failed_attempts <> 0 OR a.locked_until IS NOT NULL THEN
      UPDATE public.shop_admin_attempts SET failed_attempts = 0, locked_until = NULL
       WHERE shop_id = p_shop_id AND user_id = auth.uid();
    END IF;
    RETURN 'ok';
  END IF;
  UPDATE public.shop_admin_attempts
     SET failed_attempts = CASE WHEN failed_attempts + 1 >= 5 THEN 0 ELSE failed_attempts + 1 END,
         locked_until    = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
   WHERE shop_id = p_shop_id AND user_id = auth.uid();
  RETURN 'invalid';
END; $$;
REVOKE ALL ON FUNCTION public._check_shop_admin_secret(text, text) FROM PUBLIC, anon, authenticated;

-- ---------- 3-prep. (see section 6) ----------

-- ---------- 3. delete / void must never act on several sales by accident ----------
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

  SELECT array_agg(t.id) INTO ids FROM public.pos_transactions t WHERE t.shop_id = p_shop_id AND t.receipt = p_receipt;
  IF coalesce(array_length(ids, 1), 0) > 1 AND p_date IS NOT NULL THEN
    SELECT array_agg(t.id) INTO ids FROM public.pos_transactions t
     WHERE t.shop_id = p_shop_id AND t.receipt = p_receipt AND abs(extract(epoch FROM (t.date - p_date))) < 1;
  END IF;
  IF coalesce(array_length(ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('status', 'ok', 'deleted', 0);   -- nothing in the cloud (never synced): not an error
  END IF;
  IF array_length(ids, 1) > 1 THEN
    RETURN jsonb_build_object('status', 'ambiguous', 'matches', array_length(ids, 1),
      'message', 'More than one sale shares this receipt number, so nothing was deleted. Ask your administrator to remove the duplicate from the database.');
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

-- ---------- 5+3. void also updates `payload` (what the app displays) and refuses ambiguity ----------
CREATE OR REPLACE FUNCTION public.admin_void_transaction(
  p_shop_id text, p_receipt text, p_date timestamptz DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE ids text[]; n int; r text := btrim(p_reason);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_shop_member(p_shop_id, true) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF p_receipt IS NULL OR btrim(p_receipt) = '' THEN
    RETURN jsonb_build_object('status', 'bad_request', 'message', 'receipt is required');
  END IF;
  IF p_reason IS NULL OR length(r) < 3 THEN
    RETURN jsonb_build_object('status', 'bad_request', 'message', 'a reason of at least 3 characters is required');
  END IF;
  IF NOT public.shop_is_writable(p_shop_id) THEN RETURN jsonb_build_object('status', 'subscription_inactive'); END IF;

  SELECT array_agg(t.id) INTO ids FROM public.pos_transactions t WHERE t.shop_id = p_shop_id AND t.receipt = p_receipt;
  IF coalesce(array_length(ids, 1), 0) > 1 AND p_date IS NOT NULL THEN
    SELECT array_agg(t.id) INTO ids FROM public.pos_transactions t
     WHERE t.shop_id = p_shop_id AND t.receipt = p_receipt AND abs(extract(epoch FROM (t.date - p_date))) < 1;
  END IF;
  IF coalesce(array_length(ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('status', 'ok', 'voided', 0);   -- never synced: not an error
  END IF;
  IF array_length(ids, 1) > 1 THEN
    RETURN jsonb_build_object('status', 'ambiguous', 'matches', array_length(ids, 1),
      'message', 'More than one sale shares this receipt number, so nothing was voided. Ask your administrator to resolve the duplicate.');
  END IF;

  WITH old AS (
    SELECT to_jsonb(t) AS snap, t.id FROM public.pos_transactions t
     WHERE t.shop_id = p_shop_id AND t.id = ANY (ids) AND t.status IS DISTINCT FROM 'cancelled' FOR UPDATE
  ), upd AS (
    UPDATE public.pos_transactions t
       SET status = 'cancelled',
           notes  = CASE WHEN t.notes IS NULL OR t.notes = '' THEN 'Cancelled: ' || r ELSE t.notes || ' | Cancelled: ' || r END,
           payload = CASE WHEN t.payload IS NULL OR jsonb_typeof(t.payload) <> 'object' THEN t.payload
                          ELSE jsonb_set(jsonb_set(t.payload, '{status}', '"cancelled"'), '{notes}',
                                 to_jsonb(CASE WHEN coalesce(t.payload->>'notes', '') = '' THEN 'Cancelled: ' || r
                                               ELSE (t.payload->>'notes') || ' | Cancelled: ' || r END)) END
      FROM old WHERE t.id = old.id RETURNING old.snap
  ), logged AS (
    INSERT INTO public.pos_audit_log (shop_id, actor, action, entity, entity_ref, reason, snapshot)
    SELECT p_shop_id, auth.uid(), 'TRANSACTION_VOIDED', 'pos_transactions', p_receipt, r, snap FROM upd
    RETURNING 1
  )
  SELECT count(*) INTO n FROM upd;
  RETURN jsonb_build_object('status', 'ok', 'voided', n);
END; $$;

-- One-time repair: sales already voided in v7 whose payload still says "completed" (other devices count them).
DO $$
DECLARE n int;
BEGIN
  UPDATE public.pos_transactions
     SET payload = jsonb_set(payload, '{status}', '"cancelled"')
   WHERE status = 'cancelled' AND payload IS NOT NULL AND jsonb_typeof(payload) = 'object'
     AND coalesce(payload->>'status', '') <> 'cancelled';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN RAISE NOTICE 'v8: repaired payload.status on % previously voided sale(s).', n; END IF;
END $$;

-- ---------- 4. guard recorded sales: also the financial keys inside `payload` ----------
CREATE OR REPLACE FUNCTION public.guard_pos_transaction_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  k text;
  v_keys text[] := ARRAY['total','qty','price','subtotal','discount','tax','taxAmount','material','materialTotal',
                         'paid','change','profit','payment','status','receipt','date','service','services'];
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF NEW.qty           IS DISTINCT FROM OLD.qty
    OR NEW.unit_price    IS DISTINCT FROM OLD.unit_price
    OR NEW.total         IS DISTINCT FROM OLD.total
    OR NEW.material_cost IS DISTINCT FROM OLD.material_cost
    OR NEW.receipt       IS DISTINCT FROM OLD.receipt
    OR NEW.date          IS DISTINCT FROM OLD.date
    OR NEW.status        IS DISTINCT FROM OLD.status
    OR NEW.payment       IS DISTINCT FROM OLD.payment
    OR NEW.service       IS DISTINCT FROM OLD.service THEN
      RAISE EXCEPTION 'A recorded sale cannot be changed through the API (amounts, receipt, date, status, payment). Use the admin functions.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.payload IS DISTINCT FROM OLD.payload THEN
      IF OLD.payload IS NOT NULL THEN
        FOREACH k IN ARRAY v_keys LOOP
          IF (NEW.payload -> k) IS DISTINCT FROM (OLD.payload -> k) THEN
            RAISE EXCEPTION 'A recorded sale cannot be changed through the API (payload.%). Use the admin functions.', k
              USING ERRCODE = '42501';
          END IF;
        END LOOP;
      ELSE
        -- first payload on a legacy row (no payload yet): it must agree with the row's own columns.
        IF (NEW.payload ? 'total'   AND (NEW.payload->>'total')::numeric IS DISTINCT FROM NEW.total)
        OR (NEW.payload ? 'status'  AND (NEW.payload->>'status')          IS DISTINCT FROM NEW.status)
        OR (NEW.payload ? 'receipt' AND (NEW.payload->>'receipt')         IS DISTINCT FROM NEW.receipt) THEN
          RAISE EXCEPTION 'payload disagrees with the recorded sale' USING ERRCODE = '42501';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_pos_transactions_guard_update ON public.pos_transactions;
CREATE TRIGGER trg_pos_transactions_guard_update BEFORE UPDATE ON public.pos_transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_pos_transaction_update();

-- ---------- 6. password_hash must not be readable by shop members ----------
-- The app does `select('*')` on saas_tenants and never reads password_hash, so column grants would break the app.
-- Instead the values are COPIED to a table no API role can touch, then blanked in saas_tenants. Nothing is lost.
CREATE TABLE IF NOT EXISTS public.saas_tenant_secrets (
  tenant_id     text PRIMARY KEY,
  password_hash text NOT NULL,
  moved_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.saas_tenant_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saas_tenant_secrets FROM PUBLIC, anon, authenticated;

DO $$
DECLARE n int;
BEGIN
  INSERT INTO public.saas_tenant_secrets (tenant_id, password_hash)
  SELECT id, password_hash FROM public.saas_tenants WHERE password_hash IS NOT NULL AND password_hash <> ''
  ON CONFLICT (tenant_id) DO NOTHING;
  UPDATE public.saas_tenants t SET password_hash = NULL
   WHERE t.password_hash IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.saas_tenant_secrets s WHERE s.tenant_id = t.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n > 0 THEN RAISE NOTICE 'v8: moved % tenant password hash(es) to saas_tenant_secrets.', n; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.saas_tenants_no_api_hash()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN NEW.password_hash := NULL; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_saas_tenants_no_api_hash ON public.saas_tenants;
CREATE TRIGGER trg_saas_tenants_no_api_hash BEFORE INSERT OR UPDATE ON public.saas_tenants
  FOR EACH ROW EXECUTE FUNCTION public.saas_tenants_no_api_hash();

-- ---------- 8. shop id format + ownership cap, for EVERY way a membership row is created ----------
CREATE OR REPLACE FUNCTION public.shop_members_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.shop_id IS NULL OR NEW.shop_id !~ '^[A-Za-z0-9_.-]{3,64}$' THEN
    RAISE EXCEPTION 'Invalid shop id: use 3-64 letters, digits, dot, dash or underscore' USING ERRCODE = '22023';
  END IF;
  IF NEW.role = 'owner' AND (SELECT count(*) FROM public.shop_members WHERE user_id = NEW.user_id AND role = 'owner') >= 25 THEN
    RAISE EXCEPTION 'Business limit reached for this account' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_shop_members_validate ON public.shop_members;
CREATE TRIGGER trg_shop_members_validate BEFORE INSERT ON public.shop_members
  FOR EACH ROW EXECUTE FUNCTION public.shop_members_validate();

-- ---------- 7. claim_shop(text) (the signup path) now creates the tenant row (14-day trial) ----------
CREATE OR REPLACE FUNCTION public.claim_shop(p_shop_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_shop_id IS NULL OR length(trim(p_shop_id)) = 0 THEN RAISE EXCEPTION 'shop_id is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_shop_id, 0));
  IF EXISTS (SELECT 1 FROM public.shop_members WHERE shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'This shop is already claimed. Ask the shop owner to add you as staff.';
  END IF;
  INSERT INTO public.shop_members (user_id, shop_id, role) VALUES (auth.uid(), p_shop_id, 'owner');  -- validated by trigger

  -- Without a tenant row shop_is_writable() returns true forever (written for legacy shops). A new signup gets the
  -- same 14-day trial the app already shows locally; a super admin sets plan/expiry afterwards. business_type stays
  -- NULL (as before) so no Cyber features switch on by themselves.
  IF NOT EXISTS (SELECT 1 FROM public.saas_tenants WHERE id = p_shop_id) THEN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    INSERT INTO public.saas_tenants (id, shop_name, owner_name, phone, email, username, status, plan, start_date, expiry_date, notes)
    VALUES (p_shop_id, p_shop_id, '', '', coalesce(v_email, ''), p_shop_id, 'ACTIVE', 'BASIC', current_date, current_date + 14,
            'Created by claim_shop (14-day trial). Super admin to set plan/expiry.')
    ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.saas_tenants WHERE id = p_shop_id) THEN   -- username clash: retry with a suffix
      INSERT INTO public.saas_tenants (id, shop_name, owner_name, phone, email, username, status, plan, start_date, expiry_date, notes)
      VALUES (p_shop_id, p_shop_id, '', '', coalesce(v_email, ''), p_shop_id || '-' || substr(md5(random()::text), 1, 6),
              'ACTIVE', 'BASIC', current_date, current_date + 14, 'Created by claim_shop (14-day trial). Super admin to set plan/expiry.');
    END IF;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.claim_shop(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_shop(text) TO authenticated;

-- ---------- 9. print module honours the subscription ----------
-- Reads stay available (like the POS tables); writes need shop_is_writable() (status + expiry + 7-day grace).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['print_printers','print_price_rules','print_settings','print_jobs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "cyber members insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "cyber members update" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "cyber owners delete" ON %I', t);
    EXECUTE format('CREATE POLICY "cyber members insert" ON %I FOR INSERT TO authenticated WITH CHECK (is_cyber_member(shop_id) AND public.shop_is_writable(shop_id) AND business_type = ''cyber'')', t);
    EXECUTE format('CREATE POLICY "cyber members update" ON %I FOR UPDATE TO authenticated USING (is_cyber_member(shop_id) AND public.shop_is_writable(shop_id)) WITH CHECK (is_cyber_member(shop_id) AND public.shop_is_writable(shop_id) AND business_type = ''cyber'')', t);
    EXECUTE format('CREATE POLICY "cyber owners delete" ON %I FOR DELETE TO authenticated USING (is_cyber_member(shop_id, true) AND public.shop_is_writable(shop_id))', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "cyber members update" ON public.print_computers;
DROP POLICY IF EXISTS "cyber owners delete"  ON public.print_computers;
CREATE POLICY "cyber members update" ON public.print_computers FOR UPDATE TO authenticated
  USING (is_cyber_member(shop_id) AND public.shop_is_writable(shop_id)) WITH CHECK (is_cyber_member(shop_id) AND public.shop_is_writable(shop_id));
CREATE POLICY "cyber owners delete"  ON public.print_computers FOR DELETE TO authenticated
  USING (is_cyber_member(shop_id, true) AND public.shop_is_writable(shop_id));

CREATE OR REPLACE FUNCTION public.print_agent_auth(p_computer_id uuid, p_key text)
RETURNS print_computers
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c print_computers; v_ok boolean;
BEGIN
  SELECT * INTO c FROM print_computers WHERE id = p_computer_id;
  IF c.id IS NULL OR c.key_hash IS NULL OR c.key_hash <> print_hash_key(p_key) THEN
    RAISE EXCEPTION 'invalid agent credentials' USING ERRCODE = '28000';
  END IF;
  SELECT EXISTS (SELECT 1 FROM saas_tenants t WHERE t.id = c.shop_id AND t.business_type = 'cyber'
                  AND t.status IN ('ACTIVE','EXPIRING_SOON')) AND public.shop_is_writable(c.shop_id) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'shop is not an active Cyber subscription' USING ERRCODE = '28000'; END IF;
  RETURN c;
END; $$;
REVOKE ALL ON FUNCTION public.print_agent_auth(uuid, text) FROM public, anon, authenticated;

-- ---------- 10. print billing is forward-only for API roles ----------
-- print_claim_billing / print_mark_billed / print_release_billing are SECURITY DEFINER and are not restricted.
-- Direct UPDATEs (including the offline sync's upsert) may still move unbilled -> billing -> billed, but can no longer
-- un-bill a job or rewrite a billed job's receipt/amount/rate/service.
CREATE OR REPLACE FUNCTION public.guard_print_job_billing()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF OLD.billing_state = 'billed' AND (
         NEW.billing_state IS DISTINCT FROM 'billed'
      OR NEW.tx_receipt    IS DISTINCT FROM OLD.tx_receipt
      OR NEW.amount        IS DISTINCT FROM OLD.amount
      OR NEW.rate          IS DISTINCT FROM OLD.rate
      OR NEW.service_name  IS DISTINCT FROM OLD.service_name
      OR NEW.billed_at     IS DISTINCT FROM OLD.billed_at) THEN
      RAISE EXCEPTION 'A billed print job cannot be changed or un-billed through the API.' USING ERRCODE = '42501';
    END IF;
    IF OLD.billing_state = 'billing' AND NEW.billing_state = 'unbilled' THEN
      RAISE EXCEPTION 'Billing can only be released through print_release_billing().' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_print_jobs_guard_billing ON public.print_jobs;
CREATE TRIGGER trg_print_jobs_guard_billing BEFORE UPDATE ON public.print_jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_print_job_billing();

-- ---------- grants for the replaced functions (CREATE OR REPLACE keeps them; asserted anyway) ----------
REVOKE ALL ON FUNCTION public.admin_delete_transaction(text, text, timestamptz, text, text),
              public.admin_void_transaction(text, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_transaction(text, text, timestamptz, text, text),
              public.admin_void_transaction(text, text, timestamptz, text) TO authenticated;

-- ---------- information for you (no changes made) ----------
DO $$
DECLARE n_no_tenant int; n_dup int;
BEGIN
  SELECT count(DISTINCT m.shop_id) INTO n_no_tenant FROM public.shop_members m
   WHERE NOT EXISTS (SELECT 1 FROM public.saas_tenants t WHERE t.id = m.shop_id);
  IF n_no_tenant > 0 THEN
    RAISE NOTICE 'v8: % existing shop(s) have members but NO saas_tenants row. They remain writable forever (legacy rule in shop_is_writable). To put them on a trial, insert a tenant row for each (see docs).', n_no_tenant;
  END IF;
  SELECT count(*) INTO n_dup FROM (SELECT 1 FROM public.pos_transactions WHERE receipt IS NOT NULL GROUP BY shop_id, receipt HAVING count(*) > 1) d;
  IF n_dup > 0 THEN
    RAISE NOTICE 'v8: % receipt number(s) are used by more than one sale. Deleting/voiding those now returns status ''ambiguous'' until you resolve them.', n_dup;
  END IF;
END $$;

-- ==========================================================
-- OPTIONAL (decision for you, NOT run by this file): existing shops with members but no saas_tenants row stay writable
-- forever. To put them on the same trial new signups now get, remove the leading "-- " from the statement below, change
-- the number of days if you like, and run it once. Review the rows afterwards in the Super Admin dashboard.
--
-- INSERT INTO public.saas_tenants (id, shop_name, owner_name, phone, email, username, status, plan, start_date, expiry_date, notes)
-- SELECT DISTINCT ON (m.shop_id) m.shop_id, m.shop_id, '', '', coalesce(u.email, ''),
--        m.shop_id || '-' || substr(md5(m.shop_id), 1, 6), 'ACTIVE', 'BASIC', current_date, current_date + 14,
--        'AUTO-CREATED by v8 optional backfill - REVIEW plan/expiry.'
--   FROM public.shop_members m LEFT JOIN auth.users u ON u.id = m.user_id
--  WHERE NOT EXISTS (SELECT 1 FROM public.saas_tenants t WHERE t.id = m.shop_id)
--  ORDER BY m.shop_id, (m.role = 'owner') DESC, m.created_at
-- ON CONFLICT DO NOTHING;
-- ==========================================================

-- ==========================================================
-- NOT CHANGED (by design, decide separately):
--  * All local cashiers who share the owner's cloud login share ONE database identity, so the database cannot tell them
--    apart: owner/staff rules and per-user lockout only help once staff have their own Supabase accounts.
--  * pos_debts / pos_expenses / pos_stock rows can still be edited by any member (no financial guard like the one on sales).
--  * pos_transactions.id is a global primary key; two shops issuing the same legacy numeric id would collide.
--  * uq_pos_tx_shop_receipt stays opt-in (v5): enabling it needs every device to issue unique receipt numbers first.
-- ==========================================================
