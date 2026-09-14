-- SELLORA POS - PLATFORM SUPER ADMIN AUTO-ENTRY (v5)
-- Promotes the existing platform-owner account by email.
-- This is independent of tenant/business subscriptions.
-- Run after supabase-schema-v2-security-fix.sql. Safe to re-run.

CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can check their own admin status" ON public.super_admins;
CREATE POLICY "Users can check their own admin status" ON public.super_admins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Platform owner account already used by Sellora. This does not grant
-- admin access based on a frontend value: the row is stored server-side
-- and all Super Admin RLS policies continue to check this table.
INSERT INTO public.super_admins (user_id, email)
SELECT id, email
FROM auth.users
WHERE lower(email) = lower('hesborn.nyakundi495@gmail.com')
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;

-- Do not let ordinary authenticated users insert/update/delete admin rows.
DROP POLICY IF EXISTS "Users can insert themselves as super admin" ON public.super_admins;
DROP POLICY IF EXISTS "Users can update their own admin status" ON public.super_admins;
DROP POLICY IF EXISTS "Users can delete their own admin status" ON public.super_admins;
