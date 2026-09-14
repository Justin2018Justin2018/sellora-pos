import {
  TenantAccount,
  SubscriptionStatus,
  SubscriptionPlan,
  SubscriptionPlanConfig,
  SubscriptionAuditEntry,
} from '../types/pos';
import { isSupabaseConfigured } from './supabase';
import {
  isCurrentUserSuperAdminInDb,
  pullTenantsFromDb,
  pushTenantToDb,
  deleteTenantFromDb,
  pushAuditEntryToDb,
  getMyAdminPinHash,
  setMyAdminPin,
} from './tenantService';

// Storage keys
const SAAS_TENANTS_KEY = 'mj_saas_tenants';
const SAAS_PLANS_KEY = 'mj_saas_plans';
const SAAS_AUDIT_KEY = 'mj_saas_subscription_audit';
const SAAS_CURRENT_TENANT_KEY = 'mj_saas_active_tenant_id';
const SAAS_SUPERADMIN_SESSION_KEY = 'mj_saas_superadmin_session';

export const DEFAULT_SAAS_PLANS: SubscriptionPlanConfig[] = [
  {
    id: 'BASIC',
    name: 'Basic Cyber Starter',
    priceMonthly: 1200,
    priceAnnual: 12000,
    description: 'Perfect for single-terminal cyber cafes and printing shops.',
    features: [
      'Cyber Sales Console & Thermal Receipts',
      'Material Auto-Deduction per Service',
      'Daily Expense Tracker & Profit Calculator',
      'Basic Customer Directory',
      'Single Shop Terminal',
    ],
    badge: 'Starter',
  },
  {
    id: 'STANDARD',
    name: 'Standard Pro Business',
    priceMonthly: 2200,
    priceAnnual: 22000,
    description: 'Best for growing multi-service shops with gas refill operations.',
    features: [
      'Everything in Basic',
      'Gas Cylinder Station & Refill Tracking',
      'Customer Debt & Credit SMS Alerts',
      'Staff Cash Drawer & Shift Handover',
      'Multi-Branch Shop Switcher',
      'P&L Financial Reports & CSV Export',
    ],
    badge: 'Most Popular',
  },
  {
    id: 'PREMIUM',
    name: 'Premium Enterprise Hub',
    priceMonthly: 3500,
    priceAnnual: 35000,
    description: 'Full retail power with electronics, serial warranties, and AI advisor.',
    features: [
      'Everything in Standard',
      'Electronics Hub with Barcodes & Serial Numbers',
      'Family Finance & Owner Drawings Isolation',
      'Supabase Cloud Backup & Sync',
      'Sellora AI Business Advisor',
      'Priority 24/7 Super Admin Support',
    ],
    badge: 'All-Inclusive',
  },
];

// Helper to safely parse localStorage
function safeStorageGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

/**
 * Calculates current days remaining and dynamic subscription status
 */
export function computeSubscriptionStatus(tenant: TenantAccount): {
  status: SubscriptionStatus;
  daysRemaining: number;
} {
  // If explicitly suspended or terminated, keep administrative override
  if (tenant.status === 'SUSPENDED') {
    return { status: 'SUSPENDED', daysRemaining: 0 };
  }
  if (tenant.status === 'TERMINATED') {
    return { status: 'TERMINATED', daysRemaining: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(tenant.expiryDate);
  expiry.setHours(23, 59, 59, 999);

  const diffTime = expiry.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return { status: 'EXPIRED', daysRemaining };
  } else if (daysRemaining <= 30) {
    return { status: 'EXPIRING_SOON', daysRemaining };
  }
  return { status: 'ACTIVE', daysRemaining };
}

/**
 * Initializes the initial tenant registry safely preserving existing records.
 */
function getInitialTenants(): TenantAccount[] {
  let existing = safeStorageGet<TenantAccount[]>(SAAS_TENANTS_KEY, []);
  if (existing.length > 0) {
    let changed = false;
    existing = existing.map((t) => {
      const isLegacy =
        t.isPrimaryTenant ||
        /mama/i.test(t.shopName) ||
        /justo/i.test(t.shopName) ||
        /mama/i.test(t.ownerName) ||
        /justo/i.test(t.ownerName) ||
        t.username === 'mamajusto';
      if (isLegacy) {
        changed = true;
        return {
          ...t,
          id: t.id === 'tenant_mamajusto_main' ? 'tenant_sellora_main' : t.id,
          shopName: /mama/i.test(t.shopName) || /justo/i.test(t.shopName) ? 'Sellora POS (Main)' : t.shopName,
          ownerName: 'Hesborn Nyakundi',
          phone: '0711146198',
          email: 'hesborn.nyakundi495@gmail.com',
          username: t.username === 'mamajusto' ? 'sellora' : t.username,
        };
      }
      return t;
    });
    if (changed) {
      localStorage.setItem(SAAS_TENANTS_KEY, JSON.stringify(existing));
    }
    return existing;
  }

  // Calculate 1-year forward expiry for the primary shop
  const today = new Date();
  const nextYear = new Date();
  nextYear.setFullYear(today.getFullYear() + 1);

  const primaryTenant: TenantAccount = {
    id: 'tenant_sellora_main',
    shopName: 'Sellora POS (Main)',
    ownerName: 'Hesborn Nyakundi',
    phone: '0711146198',
    email: 'hesborn.nyakundi495@gmail.com',
    username: 'sellora',
    password: 'password123',
    status: 'ACTIVE',
    plan: 'PREMIUM',
    startDate: today.toISOString().slice(0, 10),
    expiryDate: nextYear.toISOString().slice(0, 10),
    createdAt: today.toISOString(),
    lastLogin: today.toISOString(),
    notes: 'Primary seed flagship shop. Existing historical sales and stock preserved.',
    location: 'Nairobi Central, Commercial St., Nairobi',
    isPrimaryTenant: true,
  };

  // Demo client shop for testing multi-tenancy immediately
  const demoExpiry = new Date();
  demoExpiry.setDate(today.getDate() + 24); // Expiring in 24 days

  const sampleTenant: TenantAccount = {
    id: 'tenant_mwangaza_cyber',
    shopName: 'Mwangaza Cyber & Stationery',
    ownerName: 'Peter Kamau',
    phone: '0722334455',
    email: 'kamau.mwangaza@gmail.com',
    username: 'mwangaza',
    password: 'mwangaza123',
    status: 'ACTIVE',
    plan: 'STANDARD',
    startDate: today.toISOString().slice(0, 10),
    expiryDate: demoExpiry.toISOString().slice(0, 10),
    createdAt: today.toISOString(),
    lastLogin: today.toISOString(),
    notes: 'Subscribed on Standard monthly plan. Ream auto-deduct enabled.',
    location: 'Stage 2, Embakasi East',
    isPrimaryTenant: false,
  };

  const initial = [primaryTenant, sampleTenant];
  localStorage.setItem(SAAS_TENANTS_KEY, JSON.stringify(initial));
  return initial;
}

// -------------------------------------------------------------
// Core Tenant Management API
// -------------------------------------------------------------

export const getTenants = (): TenantAccount[] => {
  const tenants = getInitialTenants();
  // Ensure statuses are updated based on real-time dates
  return tenants.map((t) => {
    const { status } = computeSubscriptionStatus(t);
    // If calculated status changed and not administrative override
    if (t.status !== 'SUSPENDED' && t.status !== 'TERMINATED' && t.status !== status) {
      return { ...t, status };
    }
    return t;
  });
};

export const saveTenants = (tenants: TenantAccount[]): void => {
  localStorage.setItem(SAAS_TENANTS_KEY, JSON.stringify(tenants));

  // Best-effort cloud sync so tenant/subscription data survives across
  // devices and browsers, not just this one localStorage - fire and
  // forget, never blocks the UI. Silently no-ops if Supabase isn't
  // configured or this user isn't a real DB super admin; RLS enforces
  // that server-side regardless of what this client-side check decides.
  if (isSupabaseConfigured()) {
    isCurrentUserSuperAdminInDb().then((isAdmin) => {
      if (!isAdmin) return;
      tenants.forEach((t) => {
        pushTenantToDb(t);
      });
    });
  }
};

/**
 * Pulls the authoritative tenant list from Supabase (only returns data if
 * the signed-in user is a real DB super admin) and merges it into local
 * storage before the Super Admin dashboard's own state initializes off
 * getTenants(). Any purely-local tenant not yet in the cloud is kept and
 * pushed up, so nothing is lost. Call this once per session, before the
 * Super Admin dashboard can be opened - see AuthContext.resolveSession.
 */
export const syncTenantsFromCloudIfAuthorized = async (): Promise<void> => {
  if (!isSupabaseConfigured()) return;
  const isAdmin = await isCurrentUserSuperAdminInDb();
  if (!isAdmin) return;

  const remote = await pullTenantsFromDb();
  if (!remote) return;

  const local = safeStorageGet<TenantAccount[]>(SAAS_TENANTS_KEY, []);
  const remoteIds = new Set(remote.map((t) => t.id));
  const localOnly = local.filter((t) => !remoteIds.has(t.id));
  const merged = [...remote, ...localOnly];

  // Direct localStorage write (not saveTenants) to avoid re-triggering a
  // redundant push of rows we just pulled; localOnly rows below still
  // get pushed up via the follow-up saveTenants-less push loop.
  localStorage.setItem(SAAS_TENANTS_KEY, JSON.stringify(merged));
  localOnly.forEach((t) => {
    pushTenantToDb(t);
  });
};

export const getTenantById = (id: string): TenantAccount | undefined => {
  const all = getTenants();
  return all.find((t) => t.id === id);
};

export const getCurrentTenantId = (): string => {
  let stored = localStorage.getItem(SAAS_CURRENT_TENANT_KEY);
  if (stored === 'tenant_mamajusto_main') {
    stored = 'tenant_sellora_main';
    localStorage.setItem(SAAS_CURRENT_TENANT_KEY, stored);
  }
  if (stored) return stored;
  const tenants = getTenants();
  const defaultId = tenants[0]?.id || 'tenant_sellora_main';
  localStorage.setItem(SAAS_CURRENT_TENANT_KEY, defaultId);
  return defaultId;
};

export const setCurrentTenantId = (tenantId: string): void => {
  localStorage.setItem(SAAS_CURRENT_TENANT_KEY, tenantId);
};

export const getCurrentTenant = (): TenantAccount => {
  const id = getCurrentTenantId();
  const tenant = getTenantById(id);
  if (tenant) {
    if (/mama/i.test(tenant.shopName) || /justo/i.test(tenant.shopName)) {
      tenant.shopName = 'Sellora POS (Main)';
    }
    return tenant;
  }
  const all = getTenants();
  return all[0];
};

/**
 * Creates a new shop owner tenant
 */
export const createTenant = (data: {
  shopName: string;
  ownerName: string;
  phone: string;
  email: string;
  username: string;
  password?: string;
  plan: SubscriptionPlan;
  startDate: string;
  expiryDate: string;
  location?: string;
  notes?: string;
}): { success: boolean; tenant?: TenantAccount; message: string } => {
  const tenants = getTenants();
  const cleanUsername = data.username.trim().toLowerCase();

  if (tenants.some((t) => t.username.toLowerCase() === cleanUsername)) {
    return { success: false, message: `Username "${data.username}" is already assigned to another shop.` };
  }

  const newId = `tenant_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const password = data.password?.trim() || `pos${Math.floor(1000 + Math.random() * 9000)}`;

  const newTenant: TenantAccount = {
    id: newId,
    shopName: data.shopName.trim(),
    ownerName: data.ownerName.trim(),
    phone: data.phone.trim(),
    email: data.email.trim(),
    username: cleanUsername,
    password,
    status: 'ACTIVE',
    plan: data.plan,
    startDate: data.startDate || new Date().toISOString().slice(0, 10),
    expiryDate: data.expiryDate,
    createdAt: new Date().toISOString(),
    location: data.location || '',
    notes: data.notes || '',
    isPrimaryTenant: false,
  };

  const updated = [newTenant, ...tenants];
  saveTenants(updated);

  logSubscriptionAudit({
    action: 'ACCOUNT_CREATED',
    shopId: newTenant.id,
    shopName: newTenant.shopName,
    details: `Created shop account for ${newTenant.ownerName} on ${newTenant.plan} plan expiring ${newTenant.expiryDate}.`,
    newValue: JSON.stringify({ plan: newTenant.plan, expiry: newTenant.expiryDate }),
  });

  return { success: true, tenant: newTenant, message: 'Shop owner account created successfully!' };
};

/**
 * Updates a tenant's information
 */
export const updateTenant = (id: string, updates: Partial<TenantAccount>): boolean => {
  const tenants = getTenants();
  const targetIndex = tenants.findIndex((t) => t.id === id);
  if (targetIndex === -1) return false;

  const prev = tenants[targetIndex];
  const updatedTenant = { ...prev, ...updates };

  // Re-evaluate subscription status
  const { status } = computeSubscriptionStatus(updatedTenant);
  if (updatedTenant.status !== 'SUSPENDED' && updatedTenant.status !== 'TERMINATED') {
    updatedTenant.status = status;
  }

  tenants[targetIndex] = updatedTenant;
  saveTenants(tenants);

  logSubscriptionAudit({
    action: 'DETAILS_UPDATED',
    shopId: id,
    shopName: updatedTenant.shopName,
    details: `Updated shop information for ${updatedTenant.shopName}.`,
  });

  return true;
};

/**
 * Manual Subscription Renewal
 */
export const renewTenantSubscription = (
  id: string,
  monthsToAdd: number,
  customExpiryDate?: string
): { success: boolean; oldExpiry: string; newExpiry: string } => {
  const tenants = getTenants();
  const target = tenants.find((t) => t.id === id);
  if (!target) return { success: false, oldExpiry: '', newExpiry: '' };

  const oldExpiry = target.expiryDate;
  let newExpiry = '';

  if (customExpiryDate) {
    newExpiry = customExpiryDate;
  } else {
    // If currently expired, start from today. If still active, extend from current expiry.
    const todayStr = new Date().toISOString().slice(0, 10);
    const baseDate = target.expiryDate < todayStr ? new Date() : new Date(target.expiryDate);
    baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
    newExpiry = baseDate.toISOString().slice(0, 10);
  }

  const targetIndex = tenants.findIndex((t) => t.id === id);
  tenants[targetIndex] = {
    ...target,
    expiryDate: newExpiry,
    status: 'ACTIVE',
  };
  saveTenants(tenants);

  logSubscriptionAudit({
    action: 'SUBSCRIPTION_RENEWED',
    shopId: id,
    shopName: target.shopName,
    details: `Renewed subscription by ${monthsToAdd > 0 ? `+${monthsToAdd} month(s)` : 'custom date'}. Previous expiry: ${oldExpiry}, New expiry: ${newExpiry}.`,
    prevValue: oldExpiry,
    newValue: newExpiry,
  });

  return { success: true, oldExpiry, newExpiry };
};

/**
 * Suspend an account
 */
export const suspendTenant = (id: string, reason?: string): boolean => {
  const tenants = getTenants();
  const target = tenants.find((t) => t.id === id);
  if (!target) return false;

  const targetIndex = tenants.findIndex((t) => t.id === id);
  tenants[targetIndex] = { ...target, status: 'SUSPENDED' };
  saveTenants(tenants);

  logSubscriptionAudit({
    action: 'ACCOUNT_SUSPENDED',
    shopId: id,
    shopName: target.shopName,
    details: `Suspended account. Reason: ${reason || 'Administrative action'}`,
  });

  return true;
};

/**
 * Reactivate an account
 */
export const reactivateTenant = (id: string): boolean => {
  const tenants = getTenants();
  const target = tenants.find((t) => t.id === id);
  if (!target) return false;

  // Recalculate status based on expiry
  const tempTenant = { ...target, status: 'ACTIVE' as SubscriptionStatus };
  const { status } = computeSubscriptionStatus(tempTenant);

  const targetIndex = tenants.findIndex((t) => t.id === id);
  tenants[targetIndex] = { ...target, status };
  saveTenants(tenants);

  logSubscriptionAudit({
    action: 'ACCOUNT_REACTIVATED',
    shopId: id,
    shopName: target.shopName,
    details: `Reactivated account. Resulting status: ${status}`,
  });

  return true;
};

/**
 * Terminate an account
 */
export const terminateTenant = (id: string, reason?: string): boolean => {
  const tenants = getTenants();
  const target = tenants.find((t) => t.id === id);
  if (!target) return false;

  const targetIndex = tenants.findIndex((t) => t.id === id);
  tenants[targetIndex] = { ...target, status: 'TERMINATED' };
  saveTenants(tenants);

  logSubscriptionAudit({
    action: 'ACCOUNT_TERMINATED',
    shopId: id,
    shopName: target.shopName,
    details: `Terminated account. Historical data preserved. Reason: ${reason || 'Contract cancellation'}`,
  });

  return true;
};

/**
 * Reset password
 */
export const resetTenantPassword = (id: string, customPass?: string): string => {
  const tenants = getTenants();
  const target = tenants.find((t) => t.id === id);
  if (!target) return '';

  const newPass = customPass?.trim() || `mj${Math.floor(10000 + Math.random() * 90000)}`;
  const targetIndex = tenants.findIndex((t) => t.id === id);
  tenants[targetIndex] = { ...target, password: newPass };
  saveTenants(tenants);

  logSubscriptionAudit({
    action: 'PASSWORD_RESET',
    shopId: id,
    shopName: target.shopName,
    details: `Password reset for user ${target.username}.`,
  });

  return newPass;
};

/**
 * Delete a tenant (Only if permanently requested by Super Admin)
 */
export const deleteTenant = (id: string): boolean => {
  const tenants = getTenants();
  const target = tenants.find((t) => t.id === id);
  if (!target) return false;

  if (target.isPrimaryTenant) {
    return false; // Guard primary tenant
  }

  const filtered = tenants.filter((t) => t.id !== id);
  saveTenants(filtered);
  if (isSupabaseConfigured()) {
    isCurrentUserSuperAdminInDb().then((isAdmin) => {
      if (isAdmin) deleteTenantFromDb(id);
    });
  }

  logSubscriptionAudit({
    action: 'ACCOUNT_DELETED',
    shopId: id,
    shopName: target.shopName,
    details: `Deleted tenant record ${target.shopName} (${target.ownerName}) from registry.`,
  });

  return true;
};

/**
 * Ensures a local TenantAccount record exists for a shop that a user has
 * just authenticated into via real Supabase Auth (see AuthContext /
 * AuthGate). The rest of the app (POSContext, all views) reads/writes
 * tenant-scoped data via getTenantKeyStatic(currentTenantId, ...), so
 * rather than migrating that whole storage model in one risky pass, this
 * bridges the real authenticated shop_id into that existing system: if a
 * matching tenant record already exists it's reused as-is (so existing
 * shop data isn't touched); if not, a new one is created on a 14-day
 * trial. Either way it also sets this shop as the active tenant.
 */
export const ensureTenantForShop = (
  shopId: string,
  meta: { shopName?: string; ownerEmail?: string; ownerName?: string },
  dbTenant?: TenantAccount | null
): TenantAccount => {
  const tenants = getTenants();
  const existing = tenants.find((t) => t.id === shopId);

  if (existing) {
    setCurrentTenantId(shopId);
    // If we have the authoritative DB record, keep the local copy of
    // business-defining fields (type, plan, status, dates) in sync with
    // it - these are admin-controlled and shouldn't drift from what was
    // actually provisioned, e.g. via the Super Admin "create business"
    // flow on a different device than the one currently in use.
    if (dbTenant) {
      const synced: TenantAccount = {
        ...existing,
        shopName: dbTenant.shopName || existing.shopName,
        businessType: dbTenant.businessType || existing.businessType,
        plan: dbTenant.plan || existing.plan,
        status: dbTenant.status || existing.status,
        startDate: dbTenant.startDate || existing.startDate,
        expiryDate: dbTenant.expiryDate || existing.expiryDate,
      };
      if (JSON.stringify(synced) !== JSON.stringify(existing)) {
        saveTenants(tenants.map((t) => (t.id === shopId ? synced : t)));
      }
      return synced;
    }
    return existing;
  }

  // No local record yet. If we already have the authoritative DB record
  // (the normal case for any shop provisioned via claim_shop or the
  // Super Admin create-business flow), bridge it in directly instead of
  // guessing with generic trial defaults.
  if (dbTenant) {
    saveTenants([...tenants, dbTenant]);
    setCurrentTenantId(shopId);
    return dbTenant;
  }

  const today = new Date();
  const trialEnd = new Date();
  trialEnd.setDate(today.getDate() + 14);

  const newTenant: TenantAccount = {
    id: shopId,
    shopName: meta.shopName || shopId,
    ownerName: meta.ownerName || '',
    phone: '',
    email: meta.ownerEmail || '',
    username: meta.ownerEmail || shopId,
    status: 'ACTIVE',
    plan: 'BASIC',
    startDate: today.toISOString().slice(0, 10),
    expiryDate: trialEnd.toISOString().slice(0, 10),
    createdAt: today.toISOString(),
    lastLogin: today.toISOString(),
    notes: 'Created from a real Supabase account sign-up (14-day trial).',
    isPrimaryTenant: false,
  };

  saveTenants([...tenants, newTenant]);
  setCurrentTenantId(shopId);
  return newTenant;
};

// -------------------------------------------------------------
// Super Admin Session & Authentication
// -------------------------------------------------------------

export interface SuperAdminSession {
  username: string;
  name: string;
  email: string;
  authenticatedAt: string;
}

export const isSuperAdminAuthenticated = (): boolean => {
  const session = safeStorageGet<SuperAdminSession | null>(SAAS_SUPERADMIN_SESSION_KEY, null);
  return Boolean(session && session.username);
};

export const getSuperAdminSession = (): SuperAdminSession | null => {
  return safeStorageGet<SuperAdminSession | null>(SAAS_SUPERADMIN_SESSION_KEY, null);
};

/**
 * SECURITY NOTE
 * -------------
 * This used to compare the entered password against several literal
 * strings ("superadmin123", "admin123", "hesborn2026") baked directly
 * into this file. Because this is client-side code, that meant the
 * real admin passwords for the whole platform shipped in plain text
 * inside the JS bundle - visible to anyone who opened devtools or
 * ran `view-source`, with no login/backend required to see them.
 *
 * This local check is still NOT a substitute for real server-side
 * auth (see signInShopAccount/getCurrentSupabaseUser in
 * src/services/supabase.ts + supabase-schema-v2-security-fix.sql,
 * which gate the actual cloud data via Supabase Auth + RLS). This
 * function only guards the LOCAL admin dashboard UI. To use it:
 *
 *   1. Generate a hash for your chosen password, e.g. in a browser
 *      console:
 *        crypto.subtle.digest('SHA-256', new TextEncoder().encode('yourpassword'))
 *          .then(buf => console.log([...new Uint8Array(buf)]
 *            .map(b => b.toString(16).padStart(2, '0')).join('')));
 *   2. Set VITE_SUPERADMIN_EMAIL and VITE_SUPERADMIN_PASSWORD_HASH
 *      in your .env (never commit real values - .env* is gitignored).
 *   3. If those env vars are not set, super admin login is disabled
 *      entirely rather than falling back to a guessable default.
 */
const sha256Hex = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/**
 * ------------------------------------------------------------------
 * Real (database-backed) Super Admin PIN login
 * ------------------------------------------------------------------
 * The env-var-based loginSuperAdmin() below still works if you want
 * it, but it depends on getting VITE_SUPERADMIN_EMAIL /
 * VITE_SUPERADMIN_PASSWORD_HASH set correctly at BUILD time on your
 * hosting provider, which is easy to get wrong. This is the
 * recommended path instead: it only ever works for an account that's
 * already a real row in the `super_admins` table (see
 * isCurrentUserSuperAdminInDb / the Supabase migration that seeds the
 * first admin) - so it can never grant admin access to someone who
 * doesn't already have it, but it lets that person set up (and later
 * change) their own PIN from right inside the app, no redeploy needed.
 */
export interface SuperAdminPinResult {
  success: boolean;
  message: string;
  /** True if this call just created a brand-new PIN (first-time setup). */
  bootstrapped?: boolean;
  /** True if this account isn't a registered platform admin at all. */
  notAnAdmin?: boolean;
}

/** Call this on mount of the login screen to decide which form to show. */
export const checkSuperAdminAccess = async (): Promise<{ isAdmin: boolean; hasPinSet: boolean }> => {
  const isAdmin = await isCurrentUserSuperAdminInDb();
  if (!isAdmin) return { isAdmin: false, hasPinSet: false };
  const hash = await getMyAdminPinHash();
  return { isAdmin: true, hasPinSet: hash !== null && hash !== undefined };
};

export const loginOrSetupSuperAdminPin = async (
  pin: string,
  confirmPin?: string
): Promise<SuperAdminPinResult> => {
  const isAdmin = await isCurrentUserSuperAdminInDb();
  if (!isAdmin) {
    return {
      success: false,
      notAnAdmin: true,
      message: 'This account is not registered as a Sellora platform super admin.',
    };
  }

  const existingHash = await getMyAdminPinHash();
  const enteredHash = await sha256Hex(pin.trim());

  if (existingHash === null || existingHash === undefined) {
    // First time this admin has logged in - set up their PIN now.
    if (pin.trim().length < 6) {
      return { success: false, message: 'Choose a PIN of at least 6 characters.' };
    }
    if (pin.trim() !== (confirmPin || '').trim()) {
      return { success: false, message: 'PINs do not match.' };
    }
    const ok = await setMyAdminPin(enteredHash);
    if (!ok) {
      return { success: false, message: 'Could not set up your PIN. Please try again.' };
    }
    createSuperAdminLocalSession();
    logSubscriptionAudit({
      action: 'ADMIN_LOGIN',
      shopId: 'PLATFORM',
      shopName: 'Super Admin Console',
      details: 'Super Admin PIN created and signed in for the first time.',
    });
    return { success: true, bootstrapped: true, message: 'Your Super Admin PIN has been set.' };
  }

  if (enteredHash !== existingHash) {
    return { success: false, message: 'Incorrect PIN.' };
  }

  createSuperAdminLocalSession();
  logSubscriptionAudit({
    action: 'ADMIN_LOGIN',
    shopId: 'PLATFORM',
    shopName: 'Super Admin Console',
    details: 'Super Admin logged into SaaS Management Dashboard.',
  });
  return { success: true, message: 'Signed in.' };
};

/** Change your PIN once already logged in. */
export const changeSuperAdminPin = async (newPin: string, confirmPin: string): Promise<SuperAdminPinResult> => {
  if (newPin.trim().length < 6) {
    return { success: false, message: 'Choose a PIN of at least 6 characters.' };
  }
  if (newPin.trim() !== confirmPin.trim()) {
    return { success: false, message: 'PINs do not match.' };
  }
  const isAdmin = await isCurrentUserSuperAdminInDb();
  if (!isAdmin) {
    return { success: false, notAnAdmin: true, message: 'This account is not a registered platform admin.' };
  }
  const hash = await sha256Hex(newPin.trim());
  const ok = await setMyAdminPin(hash);
  return ok ? { success: true, message: 'PIN updated.' } : { success: false, message: 'Could not update PIN.' };
};

export const createSuperAdminLocalSession = (): void => {
  const session: SuperAdminSession = {
    username: 'superadmin',
    name: 'Platform Owner',
    email: '',
    authenticatedAt: new Date().toISOString(),
  };
  localStorage.setItem(SAAS_SUPERADMIN_SESSION_KEY, JSON.stringify(session));
};

export const loginSuperAdmin = async (password: string, username = 'superadmin'): Promise<boolean> => {
  const cleanPass = password.trim();
  const cleanUser = username.trim().toLowerCase();

  const configuredEmail = (import.meta.env.VITE_SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const configuredHash = (import.meta.env.VITE_SUPERADMIN_PASSWORD_HASH || '').trim().toLowerCase();

  if (!configuredEmail || !configuredHash) {
    // No admin configured for this deployment - fail closed, not open.
    return false;
  }

  if (cleanUser !== configuredEmail && cleanUser !== 'superadmin') {
    return false;
  }

  const enteredHash = await sha256Hex(cleanPass);
  if (enteredHash !== configuredHash) {
    return false;
  }

  const session: SuperAdminSession = {
    username: 'superadmin',
    name: 'Platform Owner',
    email: configuredEmail,
    authenticatedAt: new Date().toISOString(),
  };
  localStorage.setItem(SAAS_SUPERADMIN_SESSION_KEY, JSON.stringify(session));

  logSubscriptionAudit({
    action: 'ADMIN_LOGIN',
    shopId: 'PLATFORM',
    shopName: 'Super Admin Console',
    details: 'Super Admin logged into SaaS Management Dashboard.',
  });
  return true;
};

export const logoutSuperAdmin = (): void => {
  localStorage.removeItem(SAAS_SUPERADMIN_SESSION_KEY);
  logSubscriptionAudit({
    action: 'ADMIN_LOGOUT',
    shopId: 'PLATFORM',
    shopName: 'Super Admin Console',
    details: 'Super Admin signed out.',
  });
};

// -------------------------------------------------------------
// Audit Log
// -------------------------------------------------------------

export const getSubscriptionAuditLog = (): SubscriptionAuditEntry[] => {
  return safeStorageGet<SubscriptionAuditEntry[]>(SAAS_AUDIT_KEY, [
    {
      id: 1,
      time: new Date().toISOString(),
      admin: 'Super Admin',
      shopId: 'tenant_sellora_main',
      shopName: 'Sellora POS (Main)',
      action: 'ACCOUNT_ACTIVATED',
      details: 'Initial flagship tenant provisioned with active commercial license.',
    },
  ]);
};

export const logSubscriptionAudit = (entry: {
  action: SubscriptionAuditEntry['action'];
  shopId: string;
  shopName: string;
  details: string;
  prevValue?: string;
  newValue?: string;
}): void => {
  const currentLog = getSubscriptionAuditLog();
  const session = getSuperAdminSession();
  const newEntry: SubscriptionAuditEntry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    time: new Date().toISOString(),
    admin: session ? session.name : 'Super Admin',
    shopId: entry.shopId,
    shopName: entry.shopName,
    action: entry.action,
    details: entry.details,
    prevValue: entry.prevValue,
    newValue: entry.newValue,
  };
  const updated = [newEntry, ...currentLog.slice(0, 1000)];
  localStorage.setItem(SAAS_AUDIT_KEY, JSON.stringify(updated));

  if (isSupabaseConfigured()) {
    isCurrentUserSuperAdminInDb().then((isAdmin) => {
      if (isAdmin) pushAuditEntryToDb(newEntry);
    });
  }
};

// -------------------------------------------------------------
// Subscription Plans Management
// -------------------------------------------------------------

export const getSaaSPlans = (): SubscriptionPlanConfig[] => {
  return safeStorageGet<SubscriptionPlanConfig[]>(SAAS_PLANS_KEY, DEFAULT_SAAS_PLANS);
};

export const saveSaaSPlans = (plans: SubscriptionPlanConfig[]): void => {
  localStorage.setItem(SAAS_PLANS_KEY, JSON.stringify(plans));
};
