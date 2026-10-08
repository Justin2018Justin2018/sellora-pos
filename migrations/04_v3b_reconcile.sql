-- ==========================================================
-- SELLORA v3b - RECONCILE SCHEMA DRIFT (run after v3, before v4)
-- ==========================================================
-- WHY: the application code and v4 reference database objects that none of
-- v1/v2/v3 create (they exist only in the live database, created by hand):
--   * saas_tenants.business_type            (used by v4 is_cyber_member + supabase.ts)
--   * super_admins.pin_hash + set_super_admin_pin()   (used by tenantService.ts)
--   * claim_shop(text, text, text)          (used by supabase.ts claimAdditionalBusiness)
--   * pos_transactions.id as TEXT + payload/device_id/synced_at (used by syncEngine.ts)
--   * the "Shop members can view own tenant" policy (assumed by tenantService.ts)
-- Without them a FRESH database built from the repo fails at v4 and the offline
-- sync can never succeed. Everything here is additive and idempotent. It never
-- drops or rewrites business rows. The one type change (pos_transactions.id
-- BIGINT -> TEXT) preserves every value (12345 -> '12345').
--
-- !! DEPLOYED DATABASES: do NOT run blind. Run supabase-audit-queries.sql first
-- !! and apply to a Supabase branch / staging copy before production.
-- ==========================================================

-- ---------- helpers (also used by v5 policies) ----------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM super_admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_shop_member(p_shop_id text, p_owner_only boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM shop_members m
    WHERE m.user_id = auth.uid() AND m.shop_id = p_shop_id
      AND (NOT p_owner_only OR m.role = 'owner')
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM public, anon;
REVOKE ALL ON FUNCTION public.is_shop_member(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_member(text, boolean) TO authenticated;

-- ---------- missing columns ----------
ALTER TABLE public.saas_tenants ADD COLUMN IF NOT EXISTS business_type text;
ALTER TABLE public.super_admins ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE public.saas_subscription_audit ADD COLUMN IF NOT EXISTS actor_user_id uuid DEFAULT auth.uid();

-- pos_transactions: offline-created sales are keyed by a device UUID and carry the full sale in `payload`.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'pos_transactions'
               AND column_name = 'id' AND data_type = 'bigint') THEN
    ALTER TABLE public.pos_transactions ALTER COLUMN id TYPE text USING id::text;
  END IF;
END $$;
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS device_id text;
ALTER TABLE public.pos_transactions ADD COLUMN IF NOT EXISTS synced_at timestamptz;

-- ---------- members can read THEIR OWN tenant row (authoritative subscription status) ----------
DROP POLICY IF EXISTS "Shop members can view own tenant" ON public.saas_tenants;
CREATE POLICY "Shop members can view own tenant" ON public.saas_tenants
  FOR SELECT TO authenticated USING (public.is_shop_member(id));

-- ---------- super-admin PIN (hash only, own row only) ----------
CREATE OR REPLACE FUNCTION public.set_super_admin_pin(p_pin_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_pin_hash IS NULL OR p_pin_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid pin hash'; END IF;
  UPDATE super_admins SET pin_hash = p_pin_hash WHERE user_id = auth.uid();
  RETURN FOUND;
END; $$;
REVOKE ALL ON FUNCTION public.set_super_admin_pin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_super_admin_pin(text) TO authenticated;

-- ---------- shop ownership: one owner per shop, enforced by the database ----------
-- The v3 claim_shop() does check-then-insert, so two simultaneous first claims could both pass the check.
-- A partial unique index makes the second insert fail no matter which version of claim_shop() is deployed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM shop_members WHERE role = 'owner' GROUP BY shop_id HAVING count(*) > 1) THEN
    RAISE NOTICE 'SKIPPED uq_shop_members_one_owner: some shops already have more than one owner. Resolve them (see supabase-audit-queries.sql), then re-run this file.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_members_one_owner ON shop_members (shop_id) WHERE role = 'owner';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_shop_members_role') THEN
    ALTER TABLE shop_members ADD CONSTRAINT chk_shop_members_role CHECK (role IN ('owner', 'staff')) NOT VALID;
  END IF;
END $$;

-- claim_shop(text): same behaviour as v3 plus a per-shop advisory lock.
CREATE OR REPLACE FUNCTION public.claim_shop(p_shop_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_shop_id IS NULL OR length(trim(p_shop_id)) = 0 THEN RAISE EXCEPTION 'shop_id is required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_shop_id, 0));
  IF EXISTS (SELECT 1 FROM shop_members WHERE shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'This shop is already claimed. Ask the shop owner to add you as staff.';
  END IF;
  INSERT INTO shop_members (user_id, shop_id, role) VALUES (auth.uid(), p_shop_id, 'owner');
END; $$;
REVOKE ALL ON FUNCTION public.claim_shop(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_shop(text) TO authenticated;

-- claim_shop(text, text, text): RECONSTRUCTED from how src/services/supabase.ts calls it. It is created ONLY if
-- no 3-argument version exists, so an existing production function is never overwritten.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname = 'public' AND p.proname = 'claim_shop' AND p.pronargs = 3) THEN
    EXECUTE $f$
      CREATE FUNCTION public.claim_shop(p_shop_id text, p_business_type text, p_shop_name text)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $b$
      DECLARE v_email text;
      BEGIN
        IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
        IF p_shop_id IS NULL OR length(trim(p_shop_id)) = 0 THEN RAISE EXCEPTION 'shop_id is required'; END IF;
        IF p_business_type IS NULL OR length(trim(p_business_type)) = 0 THEN RAISE EXCEPTION 'business type is required'; END IF;
        PERFORM pg_advisory_xact_lock(hashtextextended(p_shop_id, 0));
        IF EXISTS (SELECT 1 FROM shop_members WHERE shop_id = p_shop_id)
           OR EXISTS (SELECT 1 FROM saas_tenants WHERE id = p_shop_id) THEN
          RAISE EXCEPTION 'This shop is already claimed.';
        END IF;
        SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
        INSERT INTO saas_tenants (id, shop_name, owner_name, phone, email, username, status, plan,
                                  start_date, expiry_date, business_type, notes)
        VALUES (p_shop_id, coalesce(nullif(trim(p_shop_name), ''), p_shop_id), '', '', coalesce(v_email, ''),
                p_shop_id, 'ACTIVE', 'BASIC', current_date, current_date + 14, trim(p_business_type),
                'Created by claim_shop (14-day trial). Super admin to set plan/expiry.');
        INSERT INTO shop_members (user_id, shop_id, role) VALUES (auth.uid(), p_shop_id, 'owner');
      END; $b$;
    $f$;
    REVOKE ALL ON FUNCTION public.claim_shop(text, text, text) FROM public, anon;
    GRANT EXECUTE ON FUNCTION public.claim_shop(text, text, text) TO authenticated;
  END IF;
END $$;
