import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  isSupabaseConfigured,
  getSupabase,
  getCurrentSupabaseUser,
  getMyShopMembership,
  signOutSupabaseUser,
} from '../services/supabase';
import {
  ensureTenantForShop,
  syncTenantsFromCloudIfAuthorized,
  autoElevateSuperAdminIfAuthorized,
} from '../services/saasService';
import { fetchOwnTenantFromDb } from '../services/tenantService';
import { fetchBusinessSubscriptionsFromDb } from '../services/businessSubscriptionService';
import { TenantAccount, BusinessSubscription } from '../types/pos';

interface AuthState {
  /** Whether this deployment has real Supabase credentials configured. */
  configured: boolean;
  /** True while the initial session/membership check is in flight. */
  loading: boolean;
  userId: string | null;
  userEmail: string | null;
  /** shop_id this user is a member of, per shop_members (null if none yet). */
  shopId: string | null;
  role: string | null;
  /**
   * Authoritative subscription/tenant row pulled directly from Supabase
   * for the current shop (null if not configured, not linked yet, or no
   * DB row exists for this shop). When present, this - not the local
   * tenant copy - should decide whether the app is subscription-blocked.
   */
  dbTenant: TenantAccount | null;
  /**
   * Authoritative list of this shop's per-business subscriptions,
   * pulled straight from Supabase (null if not configured/linked yet).
   * This - not the local cache - decides which businesses (Shop,
   * Cyber, Gas, Electronics, ...) the signed-in user may switch into.
   * It can't be edited from devtools the way localStorage can.
   */
  dbBusinessSubscriptions: BusinessSubscription[] | null;
  /**
   * True once this signed-in user has been confirmed (server-side, via
   * the super_admins table) as a real platform Super Admin for this
   * session. App.tsx uses this to drop them straight into the Super
   * Admin dashboard on login instead of requiring the local PIN step.
   */
  isVerifiedSuperAdmin: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState<boolean>(configured);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [dbTenant, setDbTenant] = useState<TenantAccount | null>(null);
  const [dbBusinessSubscriptions, setDbBusinessSubscriptions] = useState<BusinessSubscription[] | null>(null);
  const [isVerifiedSuperAdmin, setIsVerifiedSuperAdmin] = useState<boolean>(false);

  const resolveSession = useCallback(async () => {
    if (!configured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const user = await getCurrentSupabaseUser();
      if (!user) {
        setUserId(null);
        setUserEmail(null);
        setShopId(null);
        setRole(null);
        setDbTenant(null);
        setDbBusinessSubscriptions(null);
        setIsVerifiedSuperAdmin(false);
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const membership = await getMyShopMembership();
      if (membership) {
        setShopId(membership.shopId);
        setRole(membership.role);

        // Authoritative subscription status for THIS shop, straight from
        // the database - can't be spoofed by editing localStorage.
        const own = await fetchOwnTenantFromDb(membership.shopId);
        setDbTenant(own);

        // Authoritative list of which businesses (Shop, Cyber, Gas,
        // Electronics, ...) this shop currently has active - same
        // can't-be-spoofed guarantee as dbTenant above.
        const subs = await fetchBusinessSubscriptionsFromDb(membership.shopId);
        setDbBusinessSubscriptions(subs);

        // Bridge into the existing tenant-keyed local data model so every
        // existing view keeps working unchanged (see ensureTenantForShop).
        // Passing the DB record keeps business type/plan/status accurate
        // even the first time this shop is opened on a new device.
        ensureTenantForShop(membership.shopId, { ownerEmail: user.email ?? undefined }, own);

        // If this user is a real platform super admin, pull the full
        // tenant registry into local storage now, before the Super Admin
        // dashboard could possibly be opened.
        await syncTenantsFromCloudIfAuthorized();

        // Same DB-verified check decides whether to drop this user
        // straight into the Super Admin dashboard, skipping the local
        // PIN prompt (see autoElevateSuperAdminIfAuthorized for why
        // this can't be spoofed by just knowing/using an email).
        const autoAdmin = await autoElevateSuperAdminIfAuthorized();
        setIsVerifiedSuperAdmin(autoAdmin);
      } else {
        setIsVerifiedSuperAdmin(false);
        setShopId(null);
        setRole(null);
        setDbTenant(null);
        setDbBusinessSubscriptions(null);
      }
    } finally {
      setLoading(false);
    }
  }, [configured]);

  useEffect(() => {
    resolveSession();
    if (!configured) return;
    const client = getSupabase();
    if (!client) return;
    const { data: sub } = client.auth.onAuthStateChange(() => {
      resolveSession();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  const signOut = useCallback(async () => {
    await signOutSupabaseUser();
    setUserId(null);
    setUserEmail(null);
    setShopId(null);
    setRole(null);
    setDbTenant(null);
    setDbBusinessSubscriptions(null);
    setIsVerifiedSuperAdmin(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        configured,
        loading,
        userId,
        userEmail,
        shopId,
        role,
        dbTenant,
        dbBusinessSubscriptions,
        isVerifiedSuperAdmin,
        refresh: resolveSession,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
