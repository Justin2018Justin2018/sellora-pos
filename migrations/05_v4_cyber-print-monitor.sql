-- ==========================================================
-- SELLORA v4 - CYBER PRINT MONITOR
-- Run once in the Supabase SQL editor AFTER v1, v2 and v3.
--
-- Everything here is Cyber-only and enforced IN THE DATABASE:
--   * every row carries business_type = 'cyber' (CHECK constraint)
--   * every RLS policy calls is_cyber_member(shop_id), which requires
--     (a) the caller is a member of that shop (shop_members), AND
--     (b) that shop's saas_tenants.business_type = 'cyber', AND
--     (c) the subscription is ACTIVE / EXPIRING_SOON.
--   A Shop / Gas / Electronics subscriber therefore gets zero rows and
--   cannot insert, no matter what the frontend shows.
--
-- The Windows Print Agent NEVER gets table access. It only calls the
-- SECURITY DEFINER functions at the bottom, authenticated by a
-- per-computer secret whose SHA-256 hash is stored (never the secret).
--
-- No extensions are required (uses built-in sha256 / gen_random_uuid,
-- PostgreSQL 13+, which Supabase provides).
-- ==========================================================

-- ----------------------------------------------------------
-- 0. HELPERS
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_cyber_member(p_shop_id text, p_owner_only boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM shop_members m
    JOIN saas_tenants t ON t.id = m.shop_id
    WHERE m.user_id = auth.uid()
      AND m.shop_id = p_shop_id
      AND t.business_type = 'cyber'
      AND t.status IN ('ACTIVE', 'EXPIRING_SOON')
      AND (NOT p_owner_only OR m.role = 'owner')
  );
$$;
REVOKE ALL ON FUNCTION public.is_cyber_member(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.is_cyber_member(text, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.print_hash_key(p_key text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$ SELECT encode(sha256(convert_to(coalesce(p_key, ''), 'utf8')), 'hex'); $$;

-- ----------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS print_printers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       text NOT NULL,
  business_type text NOT NULL DEFAULT 'cyber' CHECK (business_type = 'cyber'),
  user_id       uuid DEFAULT auth.uid(),
  name          text NOT NULL,                      -- Windows printer name (exact)
  friendly_name text,
  connection    text NOT NULL DEFAULT 'unknown',    -- usb | network | unknown
  status        text NOT NULL DEFAULT 'unknown'
                CHECK (status IN ('ready','printing','offline','error','paper_out','unknown')),
  status_detail text,                               -- raw flags reported by the agent
  queue_length  integer,
  last_seen     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

CREATE TABLE IF NOT EXISTS print_computers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id            text NOT NULL,
  business_type      text NOT NULL DEFAULT 'cyber' CHECK (business_type = 'cyber'),
  user_id            uuid DEFAULT auth.uid(),
  name               text NOT NULL,                 -- e.g. PC-01
  ip                 text,
  key_hash           text,                          -- sha256 of the agent secret
  key_hint           text,                          -- first 4 chars, display only
  monitoring_enabled boolean NOT NULL DEFAULT true,
  current_user_name  text,                          -- Windows user reported by agent
  last_seen          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, name)
);

CREATE TABLE IF NOT EXISTS print_price_rules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        text NOT NULL,
  business_type  text NOT NULL DEFAULT 'cyber' CHECK (business_type = 'cyber'),
  user_id        uuid DEFAULT auth.uid(),
  label          text NOT NULL,
  color_mode     text NOT NULL CHECK (color_mode IN ('bw','color')),
  paper_size     text NOT NULL DEFAULT 'A4',
  service_name   text,                              -- link to an existing Cyber service (price comes from it)
  price_per_page numeric(12,2),                     -- used only when service_name is NULL
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (service_name IS NOT NULL OR price_per_page IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS print_settings (
  shop_id        text PRIMARY KEY,
  business_type  text NOT NULL DEFAULT 'cyber' CHECK (business_type = 'cyber'),
  enabled        boolean NOT NULL DEFAULT true,
  auto_billing   boolean NOT NULL DEFAULT false,
  retention_days integer NOT NULL DEFAULT 90,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS print_jobs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             text NOT NULL,
  business_type       text NOT NULL DEFAULT 'cyber' CHECK (business_type = 'cyber'),
  user_id             uuid DEFAULT auth.uid(),
  job_hash            text NOT NULL,                -- idempotency key (agent: computer+printer+spool id+submit time)
  source              text NOT NULL CHECK (source IN ('agent','manual')),
  computer_id         uuid REFERENCES print_computers(id) ON DELETE SET NULL,
  printer_id          uuid REFERENCES print_printers(id)  ON DELETE SET NULL,
  windows_user        text,
  customer_name       text,
  customer_phone      text,
  document_name       text,
  file_type           text,
  pages               integer,                      -- NULL = unknown (never guessed)
  copies              integer,                      -- NULL = unknown
  color_mode          text NOT NULL DEFAULT 'unknown' CHECK (color_mode IN ('bw','color','unknown')),
  paper_size          text,
  status              text NOT NULL DEFAULT 'queued'
                      CHECK (status IN ('queued','printing','completed','failed','cancelled')),
  completion_evidence text,                         -- pages_printed | queue_exit | operator | manual
  error_message       text,
  cancel_requested    boolean NOT NULL DEFAULT false,
  detected_at         timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  service_name        text,
  rate                numeric(12,2),
  amount              numeric(12,2),
  billing_state       text NOT NULL DEFAULT 'unbilled' CHECK (billing_state IN ('unbilled','billing','billed')),
  tx_receipt          text,                         -- receipt number of the existing Cyber sale
  billed_at           timestamptz,
  operator            text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, job_hash)
);

CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_time ON print_jobs (shop_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_status ON print_jobs (shop_id, status);

-- Keep updated_at honest.
CREATE OR REPLACE FUNCTION public.print_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_print_jobs_touch ON print_jobs;
CREATE TRIGGER trg_print_jobs_touch BEFORE UPDATE ON print_jobs
  FOR EACH ROW EXECUTE FUNCTION public.print_touch_updated_at();

-- A job's printer/computer must belong to the same shop (blocks cross-shop references).
CREATE OR REPLACE FUNCTION public.print_jobs_same_shop() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.computer_id IS NOT NULL AND NOT EXISTS
     (SELECT 1 FROM print_computers c WHERE c.id = NEW.computer_id AND c.shop_id = NEW.shop_id) THEN
    RAISE EXCEPTION 'computer does not belong to this shop';
  END IF;
  IF NEW.printer_id IS NOT NULL AND NOT EXISTS
     (SELECT 1 FROM print_printers p WHERE p.id = NEW.printer_id AND p.shop_id = NEW.shop_id) THEN
    RAISE EXCEPTION 'printer does not belong to this shop';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_print_jobs_same_shop ON print_jobs;
CREATE TRIGGER trg_print_jobs_same_shop BEFORE INSERT OR UPDATE ON print_jobs
  FOR EACH ROW EXECUTE FUNCTION public.print_jobs_same_shop();

-- ----------------------------------------------------------
-- 2. ROW LEVEL SECURITY (Cyber members only; deletes owner-only)
-- ----------------------------------------------------------
ALTER TABLE print_printers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_computers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_price_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs        ENABLE ROW LEVEL SECURITY;

-- print_computers: key_hash must never reach the browser -> expose a view-like column grant.
REVOKE ALL ON print_computers FROM anon, authenticated;
GRANT SELECT (id, shop_id, business_type, name, ip, key_hint, monitoring_enabled, current_user_name, last_seen, created_at)
  ON print_computers TO authenticated;
GRANT UPDATE (name, monitoring_enabled) ON print_computers TO authenticated;
GRANT DELETE ON print_computers TO authenticated;
-- (rows are created ONLY through print_register_computer(), which also issues the key)

REVOKE ALL ON print_printers, print_price_rules, print_settings, print_jobs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON print_printers, print_price_rules, print_settings, print_jobs TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['print_printers','print_price_rules','print_settings','print_jobs'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "cyber members select" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "cyber members insert" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "cyber members update" ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS "cyber owners delete" ON %I', t);
    EXECUTE format('CREATE POLICY "cyber members select" ON %I FOR SELECT TO authenticated USING (is_cyber_member(shop_id))', t);
    EXECUTE format('CREATE POLICY "cyber members insert" ON %I FOR INSERT TO authenticated WITH CHECK (is_cyber_member(shop_id) AND business_type = ''cyber'')', t);
    EXECUTE format('CREATE POLICY "cyber members update" ON %I FOR UPDATE TO authenticated USING (is_cyber_member(shop_id)) WITH CHECK (is_cyber_member(shop_id) AND business_type = ''cyber'')', t);
    EXECUTE format('CREATE POLICY "cyber owners delete" ON %I FOR DELETE TO authenticated USING (is_cyber_member(shop_id, true))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "cyber members select" ON print_computers;
DROP POLICY IF EXISTS "cyber members update" ON print_computers;
DROP POLICY IF EXISTS "cyber owners delete"  ON print_computers;
CREATE POLICY "cyber members select" ON print_computers FOR SELECT TO authenticated USING (is_cyber_member(shop_id));
CREATE POLICY "cyber members update" ON print_computers FOR UPDATE TO authenticated USING (is_cyber_member(shop_id)) WITH CHECK (is_cyber_member(shop_id));
CREATE POLICY "cyber owners delete"  ON print_computers FOR DELETE TO authenticated USING (is_cyber_member(shop_id, true));

-- ----------------------------------------------------------
-- 3. STAFF-SIDE FUNCTIONS (called by the Sellora web app)
-- ----------------------------------------------------------
-- Register a PC and return its one-time agent secret.
CREATE OR REPLACE FUNCTION public.print_register_computer(p_shop_id text, p_name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_key text; v_id uuid;
BEGIN
  IF NOT is_cyber_member(p_shop_id, true) THEN RAISE EXCEPTION 'Not allowed (Cyber owner only)'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'Computer name required'; END IF;
  v_key := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO print_computers (shop_id, name, key_hash, key_hint, user_id)
  VALUES (p_shop_id, trim(p_name), print_hash_key(v_key), left(v_key, 4), auth.uid())
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('computer_id', v_id, 'security_key', v_key);
END; $$;

CREATE OR REPLACE FUNCTION public.print_regen_key(p_computer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_shop text; v_key text;
BEGIN
  SELECT shop_id INTO v_shop FROM print_computers WHERE id = p_computer_id;
  IF v_shop IS NULL OR NOT is_cyber_member(v_shop, true) THEN RAISE EXCEPTION 'Not allowed (Cyber owner only)'; END IF;
  v_key := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  UPDATE print_computers SET key_hash = print_hash_key(v_key), key_hint = left(v_key, 4) WHERE id = p_computer_id;
  RETURN jsonb_build_object('computer_id', p_computer_id, 'security_key', v_key);
END; $$;

-- Billing claim: exactly one caller can move a job unbilled -> billing. Prevents double charges across devices.
CREATE OR REPLACE FUNCTION public.print_claim_billing(p_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_shop text; v_n int;
BEGIN
  SELECT shop_id INTO v_shop FROM print_jobs WHERE id = p_job_id;
  IF v_shop IS NULL OR NOT is_cyber_member(v_shop) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE print_jobs SET billing_state = 'billing'
   WHERE id = p_job_id AND billing_state = 'unbilled' AND status = 'completed';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n = 1;
END; $$;

CREATE OR REPLACE FUNCTION public.print_mark_billed(p_job_id uuid, p_receipt text, p_amount numeric, p_service text, p_rate numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_shop text;
BEGIN
  SELECT shop_id INTO v_shop FROM print_jobs WHERE id = p_job_id;
  IF v_shop IS NULL OR NOT is_cyber_member(v_shop) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE print_jobs
     SET billing_state = 'billed', tx_receipt = p_receipt, amount = p_amount,
         service_name = p_service, rate = p_rate, billed_at = now()
   WHERE id = p_job_id AND billing_state = 'billing';
END; $$;

-- Owner can release a claim stuck in 'billing' (e.g. browser closed mid-sale). They must check Transactions first.
CREATE OR REPLACE FUNCTION public.print_release_billing(p_job_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_shop text;
BEGIN
  SELECT shop_id INTO v_shop FROM print_jobs WHERE id = p_job_id;
  IF v_shop IS NULL OR NOT is_cyber_member(v_shop, true) THEN RAISE EXCEPTION 'Not allowed (Cyber owner only)'; END IF;
  UPDATE print_jobs SET billing_state = 'unbilled' WHERE id = p_job_id AND billing_state = 'billing';
END; $$;

REVOKE ALL ON FUNCTION public.print_register_computer(text, text), public.print_regen_key(uuid),
  public.print_claim_billing(uuid), public.print_mark_billed(uuid, text, numeric, text, numeric),
  public.print_release_billing(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.print_register_computer(text, text), public.print_regen_key(uuid),
  public.print_claim_billing(uuid), public.print_mark_billed(uuid, text, numeric, text, numeric),
  public.print_release_billing(uuid) TO authenticated;

-- ----------------------------------------------------------
-- 4. AGENT-SIDE FUNCTIONS (called by the Windows Print Agent with the anon key + its secret)
-- ----------------------------------------------------------
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
                  AND t.status IN ('ACTIVE','EXPIRING_SOON')) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'shop is not an active Cyber subscription' USING ERRCODE = '28000'; END IF;
  RETURN c;
END; $$;
REVOKE ALL ON FUNCTION public.print_agent_auth(uuid, text) FROM public, anon, authenticated;

-- Heartbeat: updates PC + printer status. p_printers = [{name,status,status_detail,queue_length,connection}]
-- Returns settings + ids of this PC's jobs that staff asked to cancel.
CREATE OR REPLACE FUNCTION public.print_agent_heartbeat(p_computer_id uuid, p_key text, p_windows_user text, p_ip text, p_printers jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c print_computers; pr jsonb; v_status text; v_cancel jsonb;
BEGIN
  c := print_agent_auth(p_computer_id, p_key);
  UPDATE print_computers SET last_seen = now(), current_user_name = p_windows_user, ip = p_ip WHERE id = c.id;
  IF c.monitoring_enabled THEN
    FOR pr IN SELECT * FROM jsonb_array_elements(coalesce(p_printers, '[]'::jsonb)) LOOP
      v_status := CASE WHEN (pr->>'status') IN ('ready','printing','offline','error','paper_out') THEN pr->>'status' ELSE 'unknown' END;
      INSERT INTO print_printers (shop_id, name, status, status_detail, queue_length, connection, last_seen)
      VALUES (c.shop_id, pr->>'name', v_status, pr->>'status_detail', nullif(pr->>'queue_length','')::int,
              coalesce(pr->>'connection','unknown'), now())
      ON CONFLICT (shop_id, name) DO UPDATE
        SET status = EXCLUDED.status, status_detail = EXCLUDED.status_detail,
            queue_length = EXCLUDED.queue_length, last_seen = now();
    END LOOP;
  END IF;
  SELECT coalesce(jsonb_agg(j.job_hash), '[]'::jsonb) INTO v_cancel
    FROM print_jobs j WHERE j.computer_id = c.id AND j.cancel_requested AND j.status IN ('queued','printing');
  RETURN jsonb_build_object('monitoring_enabled', c.monitoring_enabled, 'cancel_job_hashes', v_cancel);
END; $$;

-- Report/update one job. Idempotent by (shop_id, job_hash). Terminal states are never overwritten
-- by a stale re-send, and a job can only move forward (queued -> printing -> terminal).
CREATE OR REPLACE FUNCTION public.print_agent_report_job(p_computer_id uuid, p_key text, p_job jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  c print_computers; v_printer uuid; v_id uuid; v_old text; v_new text;
  v_rank jsonb := '{"queued":1,"printing":2,"completed":3,"failed":3,"cancelled":3}';
BEGIN
  c := print_agent_auth(p_computer_id, p_key);
  IF NOT c.monitoring_enabled THEN RAISE EXCEPTION 'monitoring disabled for this computer'; END IF;
  IF coalesce(p_job->>'job_hash','') = '' THEN RAISE EXCEPTION 'job_hash required'; END IF;
  v_new := coalesce(p_job->>'status','queued');
  IF NOT (v_rank ? v_new) THEN RAISE EXCEPTION 'bad status %', v_new; END IF;

  SELECT id INTO v_printer FROM print_printers WHERE shop_id = c.shop_id AND name = p_job->>'printer_name';
  IF v_printer IS NULL AND coalesce(p_job->>'printer_name','') <> '' THEN
    INSERT INTO print_printers (shop_id, name, last_seen) VALUES (c.shop_id, p_job->>'printer_name', now())
    ON CONFLICT (shop_id, name) DO UPDATE SET last_seen = now() RETURNING id INTO v_printer;
  END IF;

  SELECT id, status INTO v_id, v_old FROM print_jobs WHERE shop_id = c.shop_id AND job_hash = p_job->>'job_hash';
  IF v_id IS NULL THEN
    INSERT INTO print_jobs (shop_id, job_hash, source, computer_id, printer_id, windows_user, document_name, file_type,
                            pages, copies, color_mode, paper_size, status, completion_evidence, error_message,
                            detected_at, started_at, completed_at)
    VALUES (c.shop_id, p_job->>'job_hash', 'agent', c.id, v_printer, p_job->>'windows_user', p_job->>'document_name',
            p_job->>'file_type', nullif(p_job->>'pages','')::int, nullif(p_job->>'copies','')::int,
            coalesce(nullif(p_job->>'color_mode',''), 'unknown'), p_job->>'paper_size', v_new,
            p_job->>'completion_evidence', p_job->>'error_message',
            coalesce(nullif(p_job->>'detected_at','')::timestamptz, now()),
            nullif(p_job->>'started_at','')::timestamptz, nullif(p_job->>'completed_at','')::timestamptz)
    RETURNING id INTO v_id;
  ELSIF (v_rank->>v_new)::int > (v_rank->>v_old)::int
     OR (v_new = v_old AND v_new IN ('queued','printing')) THEN
    UPDATE print_jobs SET
      status = v_new,
      pages = coalesce(nullif(p_job->>'pages','')::int, pages),
      copies = coalesce(nullif(p_job->>'copies','')::int, copies),
      color_mode = CASE WHEN coalesce(p_job->>'color_mode','') IN ('bw','color') THEN p_job->>'color_mode' ELSE color_mode END,
      completion_evidence = coalesce(p_job->>'completion_evidence', completion_evidence),
      error_message = coalesce(p_job->>'error_message', error_message),
      started_at = coalesce(started_at, nullif(p_job->>'started_at','')::timestamptz),
      completed_at = CASE WHEN v_new IN ('completed','failed','cancelled')
                          THEN coalesce(nullif(p_job->>'completed_at','')::timestamptz, now()) ELSE completed_at END
    WHERE id = v_id;
  END IF;
  RETURN v_id;
END; $$;

REVOKE ALL ON FUNCTION public.print_agent_heartbeat(uuid, text, text, text, jsonb),
  public.print_agent_report_job(uuid, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.print_agent_heartbeat(uuid, text, text, text, jsonb),
  public.print_agent_report_job(uuid, text, jsonb) TO anon, authenticated;
