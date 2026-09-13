import { getSupabase, isSupabaseConfigured } from './supabase';
import { TenantAccount, SubscriptionAuditEntry } from '../types/pos';

/**
 * ------------------------------------------------------------------
 * Real (database-backed) tenant/subscription data layer.
 * ------------------------------------------------------------------
 * saasService.ts historically stored the entire tenant/subscription
 * registry in localStorage only - meaning subscription status could be
 * edited from devtools, and admin actions never left the admin's own
 * browser. This file talks to the real `saas_tenants` /
 * `saas_subscription_audit` / `super_admins` tables instead.
 *
 * Every function here degrades gracefully (returns null / no-ops) when
 * Supabase isn't configured, and RLS is the actual security boundary -
 * these functions don't grant anything on their own. See:
 *   - "Super admins manage tenants" policy on saas_tenants (ALL, admin-only)
 *   - "Shop members can view own tenant" policy on saas_tenants (SELECT, own row)
 *   - "Users can check their own admin status" policy on super_admins
 * ------------------------------------------------------------------
 */

const toDbRow = (t: TenantAccount) => ({
  id: t.id,
  shop_name: t.shopName,
  owner_name: t.ownerName,
  phone: t.phone,
  email: t.email,
  username: t.username,
  status: t.status,
  plan: t.plan,
  start_date: t.startDate,
  expiry_date: t.expiryDate,
  location: t.location || null,
  notes: t.notes || null,
  is_primary_tenant: t.isPrimaryTenant || false,
  last_login: t.lastLogin || null,
  business_type: t.businessType || null,
});

const fromDbRow = (row: any): TenantAccount => ({
  id: row.id,
  shopName: row.shop_name,
  ownerName: row.owner_name,
  phone: row.phone,
  email: row.email,
  username: row.username,
  status: row.status,
  plan: row.plan,
  startDate: row.start_date,
  expiryDate: row.expiry_date,
  createdAt: row.created_at || new Date().toISOString(),
  lastLogin: row.last_login || undefined,
  notes: row.notes || undefined,
  location: row.location || undefined,
  isPrimaryTenant: row.is_primary_tenant || false,
  businessType: row.business_type || undefined,
});

/**
 * True only if the signed-in Supabase user has a real row in
 * super_admins. This is a convenience check for the UI - it is NOT what
 * makes admin actions secure. RLS enforces that independently on the
 * server, so even if this check were bypassed client-side, unauthorized
 * writes to saas_tenants would still be rejected by the database.
 */
export const isCurrentUserSuperAdminInDb = async (): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;
  const { data: userData } = await client.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return false;
  const { data, error } = await client.from('super_admins').select('user_id').eq('user_id', uid).maybeSingle();
  return !error && !!data;
};

/** Pulls the full tenant list. Only returns rows for an actual super admin (RLS-enforced). */
export const pullTenantsFromDb = async (): Promise<TenantAccount[] | null> => {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('saas_tenants').select('*');
  if (error || !data) return null;
  return data.map(fromDbRow);
};

/** Upserts one tenant record. No-ops silently if not configured; RLS rejects unauthorized writes regardless. */
export const pushTenantToDb = async (tenant: TenantAccount): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  try {
    const { error } = await client.from('saas_tenants').upsert(toDbRow(tenant));
    if (error) console.warn('Could not sync tenant to Supabase:', error.message);
  } catch (err) {
    console.warn('Error syncing tenant to Supabase:', err);
  }
};

export const deleteTenantFromDb = async (id: string): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  try {
    const { error } = await client.from('saas_tenants').delete().eq('id', id);
    if (error) console.warn('Could not delete tenant in Supabase:', error.message);
  } catch (err) {
    console.warn('Error deleting tenant in Supabase:', err);
  }
};

/**
 * Fetches the signed-in user's OWN shop's subscription row - readable by
 * any member of that shop (not just admins), via the "Shop members can
 * view own tenant" policy. This is what makes subscription-expiry
 * enforcement authoritative instead of trusting local storage.
 */
export const fetchOwnTenantFromDb = async (shopId: string): Promise<TenantAccount | null> => {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('saas_tenants').select('*').eq('id', shopId).maybeSingle();
  if (error || !data) return null;
  return fromDbRow(data);
};

export const pushAuditEntryToDb = async (entry: SubscriptionAuditEntry): Promise<void> => {
  const client = getSupabase();
  if (!client) return;
  try {
    const { error } = await client.from('saas_subscription_audit').insert({
      time: entry.time,
      admin: entry.admin,
      shop_id: entry.shopId,
      shop_name: entry.shopName,
      action: entry.action,
      details: entry.details,
      prev_value: entry.prevValue || null,
      new_value: entry.newValue || null,
    });
    if (error) console.warn('Could not sync audit entry to Supabase:', error.message);
  } catch (err) {
    console.warn('Error syncing audit entry to Supabase:', err);
  }
};

/**
 * Reads the signed-in super admin's own PIN hash. Returns:
 *  - null: user IS a registered admin, but hasn't set a PIN yet (bootstrap case)
 *  - a string: the stored hash to compare against
 *  - undefined: user is not a registered admin at all (or not signed in)
 */
export const getMyAdminPinHash = async (): Promise<string | null | undefined> => {
  const client = getSupabase();
  if (!client) return undefined;
  const { data: userData } = await client.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return undefined;

  const { data, error } = await client.from('super_admins').select('pin_hash').eq('user_id', uid).maybeSingle();
  if (error || !data) return undefined;
  return data.pin_hash ?? null;
};

/** Sets/changes the signed-in admin's own PIN hash via the set_super_admin_pin RPC (see migration). */
export const setMyAdminPin = async (pinHash: string): Promise<boolean> => {
  const client = getSupabase();
  if (!client) return false;
  const { data, error } = await client.rpc('set_super_admin_pin', { p_pin_hash: pinHash });
  if (error) {
    console.warn('Could not set admin PIN:', error.message);
    return false;
  }
  return Boolean(data);
};
