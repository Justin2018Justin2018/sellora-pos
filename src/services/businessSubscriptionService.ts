import { BusinessMode, BusinessSubscription, BusinessSubscriptionStatus, SubscriptionPlan } from '../types/pos';
import { getSupabase, isSupabaseConfigured } from './supabase';
import { logSubscriptionAudit } from './saasService';

/**
 * ------------------------------------------------------------------
 * Business Subscriptions - the real access-control data.
 * ------------------------------------------------------------------
 * A tenant (shop/customer) can hold many rows here, one per
 * BusinessMode they have paid for. This is the ONLY thing that
 * decides whether a tenant may switch into / read / write a given
 * business's data.
 *
 * Local-first, same pattern as saasService.ts / tenantService.ts:
 *   - Reads/writes localStorage immediately so the app works fully
 *     offline.
 *   - When Supabase is configured, the browser may READ its own
 *     entitlements, but it cannot manufacture ACTIVE subscription rows.
 *     Activation is trusted-payment/backend or super-admin controlled.
 *   - RLS on the actual data tables (pos_transactions, pos_stock,
 *     pos_expenses, pos_debts, pos_customers) additionally requires
 *     an ACTIVE, unexpired row here for the row's business_type. That
 *     is the real, un-bypassable enforcement boundary: even a
 *     hand-crafted API request or a devtools-edited localStorage
 *     value cannot read/write a business a shop hasn't paid for,
 *     because Postgres checks this table itself on every query.
 * ------------------------------------------------------------------
 */

const keyFor = (tenantId: string) => `mj_tenant_${tenantId}_business_subscriptions`;

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/** True if a subscription row is currently usable (active status + not past its expiry date). */
export function isSubscriptionCurrentlyActive(sub: BusinessSubscription): boolean {
  if (sub.status !== 'ACTIVE') return false;
  if (!sub.expiryDate) return true;
  const expiry = new Date(sub.expiryDate);
  expiry.setHours(23, 59, 59, 999);
  return expiry.getTime() >= Date.now();
}

/**
 * Reads the raw subscription list for a tenant, re-computing EXPIRED
 * status for any row whose expiryDate has passed (mirrors
 * computeSubscriptionStatus() in saasService.ts for the whole-account
 * subscription). Never mutates CANCELLED rows.
 */
export const getBusinessSubscriptions = (tenantId: string): BusinessSubscription[] => {
  const rows = safeGet<BusinessSubscription[]>(keyFor(tenantId), []);
  let changed = false;
  const recalculated = rows.map((r) => {
    if (r.status === 'ACTIVE' && !isSubscriptionCurrentlyActive(r)) {
      changed = true;
      return { ...r, status: 'EXPIRED' as BusinessSubscriptionStatus };
    }
    return r;
  });
  if (changed) {
    localStorage.setItem(keyFor(tenantId), JSON.stringify(recalculated));
  }
  return recalculated;
};

export const saveBusinessSubscriptions = (tenantId: string, subs: BusinessSubscription[]): void => {
  localStorage.setItem(keyFor(tenantId), JSON.stringify(subs));
};

/**
 * The set of business types this tenant may currently access. Expands
 * a bundle ('all') subscription into every concrete business type.
 */
export const getActiveBusinessTypes = (tenantId: string): BusinessMode[] => {
  const active = getBusinessSubscriptions(tenantId).filter(isSubscriptionCurrentlyActive);
  if (active.some((s) => s.businessType === 'all')) {
    return ['cyber', 'gas', 'electronics', 'general_shop', 'clothing', 'restaurant', 'pharmacy', 'other'];
  }
  return active.map((s) => s.businessType);
};

export const isBusinessTypeActive = (tenantId: string, businessType: BusinessMode): boolean => {
  if (!businessType) return false;
  return getActiveBusinessTypes(tenantId).includes(businessType);
};

/**
 * Activates (or renews) a business subscription for a tenant. Safe to
 * call for a business type the tenant already has - it renews/extends
 * the existing row instead of creating a duplicate, so a tenant never
 * ends up with two rows for the same business type.
 */
export const subscribeBusinessType = (
  tenantId: string,
  tenantName: string,
  businessType: BusinessMode,
  plan: SubscriptionPlan,
  billingCycle: 'monthly' | 'annual' = 'monthly',
  months?: number
): BusinessSubscription => {
  const subs = getBusinessSubscriptions(tenantId);
  const today = new Date();
  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + (months || (billingCycle === 'annual' ? 12 : 1)));

  const existingIdx = subs.findIndex((s) => s.businessType === businessType);
  let result: BusinessSubscription;

  if (existingIdx >= 0) {
    result = {
      ...subs[existingIdx],
      status: 'ACTIVE',
      plan,
      billingCycle,
      startDate: subs[existingIdx].status === 'ACTIVE' ? subs[existingIdx].startDate : today.toISOString().slice(0, 10),
      expiryDate: expiry.toISOString().slice(0, 10),
      cancelledAt: undefined,
    };
    subs[existingIdx] = result;
  } else {
    result = {
      id: `bsub_${tenantId}_${businessType}_${Date.now()}`,
      tenantId,
      businessType,
      status: 'ACTIVE',
      plan,
      billingCycle,
      startDate: today.toISOString().slice(0, 10),
      expiryDate: expiry.toISOString().slice(0, 10),
      createdAt: today.toISOString(),
    };
    subs.push(result);
  }

  saveBusinessSubscriptions(tenantId, subs);
  // IMPORTANT: when Supabase is configured, a browser must never be able
  // to manufacture an ACTIVE subscription by writing directly to the
  // subscription table. The authoritative activation path is a trusted
  // server/super-admin/payment webhook. Keep this local write only for
  // offline/demo deployments where there is no remote database.
  if (!isSupabaseConfigured()) {
    void pushBusinessSubscriptionToDb(result);
  }

  logSubscriptionAudit({
    action: existingIdx >= 0 ? 'SUBSCRIPTION_RENEWED' : 'SUBSCRIPTION_CHANGED',
    shopId: tenantId,
    shopName: tenantName,
    details: `${existingIdx >= 0 ? 'Renewed' : 'Activated'} the "${businessType}" business, expiring ${result.expiryDate}.`,
    newValue: JSON.stringify({ businessType, plan, expiry: result.expiryDate }),
  });

  return result;
};

/**
 * Cancels a business subscription. Historical data for that business
 * is NEVER deleted - only the row's status changes, which immediately
 * removes access (both locally and, once the RLS policy re-evaluates
 * on the next request, in the database) while every past sale, stock
 * item, expense, debt, and customer for that business stays intact
 * and reappears exactly as it was if the business is reactivated.
 */
export const cancelBusinessType = (tenantId: string, tenantName: string, businessType: BusinessMode): boolean => {
  const subs = getBusinessSubscriptions(tenantId);
  const idx = subs.findIndex((s) => s.businessType === businessType);
  if (idx === -1) return false;

  const updated: BusinessSubscription = {
    ...subs[idx],
    status: 'CANCELLED',
    cancelledAt: new Date().toISOString(),
  };
  subs[idx] = updated;
  saveBusinessSubscriptions(tenantId, subs);
  pushBusinessSubscriptionToDb(updated);

  logSubscriptionAudit({
    action: 'SUBSCRIPTION_CHANGED',
    shopId: tenantId,
    shopName: tenantName,
    details: `Cancelled the "${businessType}" business. Historical data preserved; access revoked immediately.`,
    newValue: JSON.stringify({ businessType, status: 'CANCELLED' }),
  });

  return true;
};

/**
 * One-time migration: if a tenant has no subscription rows yet but has
 * a legacy single `businessType` (the old one-business-per-shop
 * model), create an ACTIVE row from it so existing customers are never
 * locked out of data they already had access to. Safe to call
 * repeatedly - it only acts when the tenant has zero rows.
 */
export const migrateLegacyBusinessType = (
  tenantId: string,
  tenantName: string,
  legacyBusinessType: BusinessMode | undefined,
  plan: SubscriptionPlan,
  expiryDate: string
): BusinessSubscription[] => {
  const existing = getBusinessSubscriptions(tenantId);
  if (existing.length > 0) return existing;
  if (!legacyBusinessType) return existing;

  const migrated: BusinessSubscription = {
    id: `bsub_${tenantId}_${legacyBusinessType}_legacy`,
    tenantId,
    businessType: legacyBusinessType,
    status: 'ACTIVE',
    plan,
    billingCycle: 'monthly',
    startDate: new Date().toISOString().slice(0, 10),
    expiryDate: expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };
  const updated = [migrated];
  saveBusinessSubscriptions(tenantId, updated);
  pushBusinessSubscriptionToDb(migrated);
  return updated;
};

// -------------------------------------------------------------
// Cloud sync (Supabase) - best-effort, never blocks the UI.
// -------------------------------------------------------------
/**
 * Requests an additional business from the signed-in customer. A request
 * is NOT an access grant. When Supabase is configured, the customer can
 * submit the request, but only the trusted billing/payment path can turn
 * it into an ACTIVE business_subscriptions row.
 */
export const requestAdditionalBusiness = async (
  tenantId: string,
  businessType: BusinessMode,
  plan: SubscriptionPlan,
  billingCycle: 'monthly' | 'annual'
): Promise<{ success: boolean; message: string }> => {
  if (!isSupabaseConfigured()) {
    return { success: true, message: 'Offline/demo mode: subscription request recorded locally.' };
  }
  const client = getSupabase();
  if (!client) return { success: false, message: 'Supabase is not configured.' };
  try {
    const { error } = await client.from('business_subscription_requests').insert({
      shop_id: tenantId,
      business_type: businessType,
      plan,
      billing_cycle: billingCycle,
      status: 'PENDING',
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Subscription request submitted. Access will be enabled after payment is confirmed.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Could not submit subscription request.' };
  }
};


const toDbRow = (s: BusinessSubscription) => ({
  id: s.id,
  shop_id: s.tenantId,
  business_type: s.businessType,
  status: s.status,
  plan: s.plan,
  billing_cycle: s.billingCycle,
  start_date: s.startDate,
  expiry_date: s.expiryDate,
  created_at: s.createdAt,
  cancelled_at: s.cancelledAt || null,
});

const fromDbRow = (row: any): BusinessSubscription => ({
  id: row.id,
  tenantId: row.shop_id,
  businessType: row.business_type,
  status: row.status,
  plan: row.plan,
  billingCycle: row.billing_cycle,
  startDate: row.start_date,
  expiryDate: row.expiry_date,
  createdAt: row.created_at || new Date().toISOString(),
  cancelledAt: row.cancelled_at || undefined,
});

/**
 * Pushes one subscription row to Supabase. RLS only allows this to
 * succeed if the signed-in user is a member of `s.tenantId` (or a
 * super admin) - a request for someone else's shop is rejected by the
 * database regardless of what this function sends.
 */
export const pushBusinessSubscriptionToDb = async (s: BusinessSubscription): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const client = getSupabase();
  if (!client) return false;
  try {
    const { error } = await client.from('business_subscriptions').upsert(toDbRow(s));
    if (error) {
      console.warn('Failed to sync business subscription to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Error syncing business subscription to Supabase:', err);
    return false;
  }
};

/**
 * Pulls the authoritative subscription list for a shop straight from
 * Supabase. This is what App.tsx should prefer over the local copy
 * when deciding what a user can access - it can't be edited via
 * devtools/localStorage the way the local cache can.
 */
export const fetchBusinessSubscriptionsFromDb = async (
  tenantId: string
): Promise<BusinessSubscription[] | null> => {
  if (!isSupabaseConfigured()) return null;
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data, error } = await client
      .from('business_subscriptions')
      .select('*')
      .eq('shop_id', tenantId);
    if (error || !data) return null;
    const mapped = data.map(fromDbRow);
    // Keep the local cache in step with the DB so offline reads later
    // (e.g. next app launch before connectivity resolves) see the same
    // authoritative picture.
    saveBusinessSubscriptions(tenantId, mapped);
    return mapped;
  } catch (err) {
    console.warn('Error fetching business subscriptions from Supabase:', err);
    return null;
  }
};
