import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  isSupabaseConfigured,
  getSupabase,
  getCurrentSupabaseUser,
  getMyShopMemberships,
  BusinessMembership,
  signOutSupabaseUser,
} from '../services/supabase';
import { ensureTenantForShop, syncTenantsFromCloudIfAuthorized } from '../services/saasService';
import { fetchOwnTenantFromDb } from '../services/tenantService';
import { TenantAccount } from '../types/pos';

const ACTIVE_BUSINESS_KEY = 'sellora_active_business_shop_id';

interface AuthState {
  /** Whether this deployment has real Supabase credentials configured. */
  configured: boolean;
  /** True while the initial session/membership check is in flight. */
  loading: boolean;
  userId: string | null;
  userEmail: string | null;
  /**
   * Every business (shop) this customer has - a customer can hold
   * several active subscriptions at once (e.g. Shop + Cyber), each
   * fully isolated by shop_id via RLS. Empty if not linked to any
   * business yet.
   */
  memberships: BusinessMembership[];
  /** shop_id of the business currently in use. null if the user has none yet. */
  shopId: string | null;
  role: string | null;
  /**
   * Authoritative subscription/tenant row pulled directly from Supabase
   * for the ACTIVE business (null if not configured, not linked yet, or
   * no DB row exists for this shop). When present, this - not the local
   * tenant copy - should decide whether the app is subscription-blocked.
   */
  dbTenant: TenantAccount | null;
  /**
   * Switches which business is active for this session. Only succeeds
   * for a business this customer actually has an ACTIVE subscription
   * for - never lets them switch into an expired/suspended/unclaimed
   * one. Reloads the app after switching so every existing view
   * (POSContext included) re-initializes cleanly from the newly active
   * business's own data, with zero chance of one business's in-memory
   * state bleeding into another's screen mid-session.
   */
  switchActiveBusiness: (shopId: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState<boolean>(configured);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<BusinessMembership[]>([]);
  const [shopId, setShopId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [dbTenant, setDbTenant] = useState<TenantAccount | null>(null);

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
        setMemberships([]);
        setShopId(null);
        setRole(null);
        setDbTenant(null);
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? null);

      const allMemberships = await getMyShopMemberships();
      setMemberships(allMemberships);

      if (allMemberships.length > 0) {
        // Prefer the previously-selected business if the customer still
        // actually has it and it's still active; otherwise fall back to
        // the first active one, or just the first one at all (so an
        // expired-only account still opens to something and can show
        // the subscription-blocked screen rather than nothing).
        const savedShopId = localStorage.getItem(ACTIVE_BUSINESS_KEY);
        const savedIsValid = savedShopId && allMemberships.some((m) => m.shopId === savedShopId);
        const firstActive = allMemberships.find((m) => m.status === 'ACTIVE');
        const chosen = (savedIsValid ? savedShopId : null) || firstActive?.shopId || allMemberships[0].shopId;

        const chosenMembership = allMemberships.find((m) => m.shopId === chosen)!;
        setShopId(chosen);
        setRole(chosenMembership.role);
        localStorage.setItem(ACTIVE_BUSINESS_KEY, chosen);

        // Authoritative subscription status for the ACTIVE business,
        // straight from the database - can't be spoofed by editing
        // localStorage.
        const own = await fetchOwnTenantFromDb(chosen);
        setDbTenant(own);

        // Bridge into the existing tenant-keyed local data model so every
        // existing view keeps working unchanged (see ensureTenantForShop).
        ensureTenantForShop(chosen, { ownerEmail: user.email ?? undefined }, own);

        // If this user is a real platform super admin, pull the full
        // tenant registry into local storage now, before the Super Admin
        // dashboard could possibly be opened.
        await syncTenantsFromCloudIfAuthorized();
      } else {
        setShopId(null);
        setRole(null);
        setDbTenant(null);
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

  const switchActiveBusiness = useCallback(
    (targetShopId: string) => {
      const target = memberships.find((m) => m.shopId === targetShopId);
      if (!target) return;
      if (target.status !== 'ACTIVE') return; // never allow switching into an inactive subscription
      localStorage.setItem(ACTIVE_BUSINESS_KEY, targetShopId);
      // Full reload - the safest way to guarantee POSContext and every
      // other view re-initializes purely from the newly active
      // business's own data, with no risk of one business's state
      // carrying over into another's screen.
      window.location.reload();
    },
    [memberships]
  );

  const signOut = useCallback(async () => {
    await signOutSupabaseUser();
    setUserId(null);
    setUserEmail(null);
    setMemberships([]);
    setShopId(null);
    setRole(null);
    setDbTenant(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        configured,
        loading,
        userId,
        userEmail,
        memberships,
        shopId,
        role,
        dbTenant,
        switchActiveBusiness,
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
