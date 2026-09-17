import React, { useState, useMemo, useEffect } from 'react';
import {
  TenantAccount,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionPlanConfig,
  SubscriptionAuditEntry,
  BusinessMode,
} from '../../types/pos';
import {
  getTenants,
  updateTenant,
  renewTenantSubscription,
  suspendTenant,
  reactivateTenant,
  terminateTenant,
  deleteTenant,
  resetTenantPassword,
  computeSubscriptionStatus,
  getSubscriptionAuditLog,
  getSaaSPlans,
  saveSaaSPlans,
  logoutSuperAdmin,
  getSuperAdminSession,
  setCurrentTenantId,
  checkSuperAdminAccess,
  loginOrSetupSuperAdminPin,
  changeSuperAdminPin,
  syncTenantsFromCloudIfAuthorized,
} from '../../services/saasService';
import { getSupabase } from '../../services/supabase';
import {
  BusinessTypeConfig,
  getBusinessTypes,
  saveCustomPlanPricing,
  resetCustomPlanPricing,
  updateCustomPlanPrice,
} from '../../data/businessTypes';
import {
  ShieldCheck,
  Store,
  Users,
  Search,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Calendar,
  Phone,
  Mail,
  MoreVertical,
  LogOut,
  RefreshCw,
  Edit,
  KeyRound,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Sliders,
  DollarSign,
  FileText,
  Copy,
  Check,
  Sparkles,
  ArrowUpRight,
  UserX,
  UserCheck,
  XCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';

interface SuperAdminDashboardProps {
  onExitAdmin: () => void;
  onSelectShopToView: (tenantId: string) => void;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  onExitAdmin,
  onSelectShopToView,
}) => {
  const [tenants, setTenants] = useState<TenantAccount[]>(() => getTenants());
  const [auditLog, setAuditLog] = useState<SubscriptionAuditEntry[]>(() => getSubscriptionAuditLog());
  const [plans, setPlans] = useState<SubscriptionPlanConfig[]>(() => getSaaSPlans());
  const [activeTab, setActiveTab] = useState<'shops' | 'audit' | 'plans'>('shops');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantAccount | null>(null);
  const [renewingTenant, setRenewingTenant] = useState<TenantAccount | null>(null);
  const [resetPassTenant, setResetPassTenant] = useState<TenantAccount | null>(null);
  const [generatedNewPass, setGeneratedNewPass] = useState<string | null>(null);
  const [confirmTerminateTenant, setConfirmTerminateTenant] = useState<TenantAccount | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Pricing State
  const [industryPlans, setIndustryPlans] = useState<BusinessTypeConfig[]>(() => getBusinessTypes());
  const [plansCategory, setPlansCategory] = useState<'industry' | 'saas'>('industry');
  const [editingPlanModal, setEditingPlanModal] = useState<SubscriptionPlanConfig | null>(null);
  const [planEditMonthly, setPlanEditMonthly] = useState<number>(0);
  const [planEditAnnual, setPlanEditAnnual] = useState<number>(0);

  const [editingIndustryModal, setEditingIndustryModal] = useState<BusinessTypeConfig | null>(null);
  const [industryEditMonthly, setIndustryEditMonthly] = useState<number>(0);
  const [industryEditAnnual, setIndustryEditAnnual] = useState<number>(0);

  // New Shop Form State
  const [newShopForm, setNewShopForm] = useState({
    shopName: '',
    businessType: 'general_shop' as BusinessMode,
    ownerName: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    plan: 'STANDARD' as SubscriptionPlan,
    startDate: new Date().toISOString().slice(0, 10),
    monthsToAdd: 1,
    location: '',
    notes: '',
  });
  const [createShopBusy, setCreateShopBusy] = useState(false);
  const [createShopError, setCreateShopError] = useState<string | null>(null);

  // Renew Form State
  const [renewMonths, setRenewMonths] = useState(1);
  const [customExpiry, setCustomExpiry] = useState('');

  const [session, setSession] = useState(() => getSuperAdminSession());
  const [accessCheck, setAccessCheck] = useState<{ isAdmin: boolean; hasPinSet: boolean } | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessCheckError, setAccessCheckError] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);

  const runAccessCheck = () => {
    setCheckingAccess(true);
    setAccessCheckError('');
    let cancelled = false;
    checkSuperAdminAccess()
      .then((result) => {
        if (!cancelled) {
          setAccessCheck(result);
          setCheckingAccess(false);
        }
      })
      .catch((err) => {
        // Previously there was no .catch() here at all, so any thrown
        // error (a network hiccup, an expired/invalid session, a
        // transient Supabase error) left checkingAccess stuck at `true`
        // forever with no feedback - an infinite spinner with no way
        // out except reloading the page. Now it surfaces a real error
        // and a retry button instead.
        if (!cancelled) {
          console.warn('Super admin access check failed:', err);
          setAccessCheckError(
            err instanceof Error ? err.message : 'Could not verify admin access. Check your connection and try again.'
          );
          setCheckingAccess(false);
        }
      });
    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    if (session) return;
    return runAccessCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginBusy(true);
    setLoginError('');
    const result = await loginOrSetupSuperAdminPin(pinInput, pinConfirmInput);
    setLoginBusy(false);
    if (result.success) {
      setSession(getSuperAdminSession());
      refreshData();
    } else {
      setLoginError(result.message);
    }
  };

  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');
  const [newPinConfirmInput, setNewPinConfirmInput] = useState('');
  const [changePinBusy, setChangePinBusy] = useState(false);
  const [changePinMessage, setChangePinMessage] = useState<string | null>(null);

  const refreshData = () => {
    setTenants(getTenants());
    setAuditLog(getSubscriptionAuditLog());
    setPlans(getSaaSPlans());
    setIndustryPlans(getBusinessTypes());
  };

  // KPIs
  const kpis = useMemo(() => {
    let total = tenants.length;
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let suspended = 0;
    let terminated = 0;

    tenants.forEach((t) => {
      const { status } = computeSubscriptionStatus(t);
      if (t.status === 'SUSPENDED') suspended++;
      else if (t.status === 'TERMINATED') terminated++;
      else if (status === 'EXPIRED') expired++;
      else if (status === 'EXPIRING_SOON') {
        active++;
        expiringSoon++;
      } else {
        active++;
      }
    });

    return { total, active, expiringSoon, expired, suspended, terminated };
  }, [tenants]);

  // Filtered shops
  const filteredTenants = useMemo(() => {
    return tenants.filter((t) => {
      const matchesSearch =
        t.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.phone.includes(searchQuery) ||
        t.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.email.toLowerCase().includes(searchQuery.toLowerCase());

      const { status } = computeSubscriptionStatus(t);
      const actualStatus = t.status === 'SUSPENDED' || t.status === 'TERMINATED' ? t.status : status;

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'EXPIRING' && actualStatus === 'EXPIRING_SOON') ||
        actualStatus === statusFilter;

      const matchesPlan = planFilter === 'ALL' || t.plan === planFilter;

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [tenants, searchQuery, statusFilter, planFilter]);

  // Handle Create Shop Submit - calls the create-business Edge Function,
  // which is the only safe place to provision a real login for someone
  // else (it holds the service-role key server-side; this dashboard
  // never does). See supabase/functions/create-business.
  const handleCreateShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateShopError(null);

    if (!newShopForm.shopName.trim() || !newShopForm.ownerName.trim() || !newShopForm.email.trim()) {
      setCreateShopError('Please fill out Shop Name, Owner Name, and Email.');
      return;
    }
    if (!newShopForm.password || newShopForm.password.length < 6) {
      setCreateShopError('Set a password of at least 6 characters for the new owner.');
      return;
    }

    const startDate = new Date(newShopForm.startDate);
    const expiryDate = new Date(startDate);
    expiryDate.setMonth(expiryDate.getMonth() + Number(newShopForm.monthsToAdd || 1));
    const expiryStr = expiryDate.toISOString().slice(0, 10);

    const client = getSupabase();
    if (!client) {
      setCreateShopError('Supabase is not configured in this deployment.');
      return;
    }

    setCreateShopBusy(true);
    const { data, error } = await client.functions.invoke('create-business', {
      body: {
        shopName: newShopForm.shopName.trim(),
        businessType: newShopForm.businessType,
        ownerName: newShopForm.ownerName.trim(),
        phone: newShopForm.phone.trim(),
        email: newShopForm.email.trim(),
        password: newShopForm.password,
        plan: newShopForm.plan,
        startDate: newShopForm.startDate,
        expiryDate: expiryStr,
        location: newShopForm.location.trim(),
        notes: newShopForm.notes.trim(),
      },
    });
    setCreateShopBusy(false);

    if (error || !data?.success) {
      setCreateShopError(data?.error || error?.message || 'Could not create the business. Please try again.');
      return;
    }

    await syncTenantsFromCloudIfAuthorized();
    refreshData();
    setIsCreateModalOpen(false);
    setCreateShopError(null);
    setNewShopForm({
      shopName: '',
      businessType: 'general_shop',
      ownerName: '',
      phone: '',
      email: '',
      username: '',
      password: '',
      plan: 'STANDARD',
      startDate: new Date().toISOString().slice(0, 10),
      monthsToAdd: 1,
      location: '',
      notes: '',
    });
  };

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRenewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewingTenant) return;

    renewTenantSubscription(renewingTenant.id, renewMonths, customExpiry || undefined);
    refreshData();
    setRenewingTenant(null);
    setCustomExpiry('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;

    updateTenant(editingTenant.id, {
      shopName: editingTenant.shopName,
      ownerName: editingTenant.ownerName,
      phone: editingTenant.phone,
      email: editingTenant.email,
      plan: editingTenant.plan,
      location: editingTenant.location,
      notes: editingTenant.notes,
      expiryDate: editingTenant.expiryDate,
    });
    refreshData();
    setEditingTenant(null);
  };

  const handleSwitchToShop = (tenantId: string) => {
    setCurrentTenantId(tenantId);
    onSelectShopToView(tenantId);
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 font-sans selection:bg-blue-600 selection:text-white">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xl shadow-blue-500/30 mb-3">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">Super Admin Portal</h2>
            <p className="text-xs text-slate-400 mt-1">Platform Owner & Multi-Tenant Control</p>
          </div>

          {checkingAccess ? (
            <div className="py-8 text-center text-sm text-slate-400">Checking your access…</div>
          ) : accessCheckError ? (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-sm space-y-3">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Couldn't verify access
              </p>
              <p className="text-rose-300/80 text-xs leading-relaxed">{accessCheckError}</p>
              <button
                type="button"
                onClick={runAccessCheck}
                className="w-full py-2 rounded-lg bg-rose-800/60 hover:bg-rose-800 text-white text-xs font-semibold transition-colors"
              >
                Try again
              </button>
            </div>
          ) : !accessCheck?.isAdmin ? (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-sm space-y-2">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Not authorized
              </p>
              <p className="text-rose-300/80 text-xs leading-relaxed">
                Your signed-in account is not registered as a Sellora platform super admin. Only accounts with a
                real row in the <code className="bg-slate-800 px-1 py-0.5 rounded">super_admins</code> table can
                access this dashboard - ask the platform owner to add you.
              </p>
            </div>
          ) : (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              {!accessCheck.hasPinSet && (
                <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-blue-300 text-xs">
                  First time here - choose a PIN to protect this dashboard on this device.
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {accessCheck.hasPinSet ? 'Admin PIN' : 'Choose a PIN (min. 6 characters)'}
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                  autoFocus
                  required
                />
              </div>

              {!accessCheck.hasPinSet && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Confirm PIN</label>
                  <input
                    type="password"
                    value={pinConfirmInput}
                    onChange={(e) => setPinConfirmInput(e.target.value)}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              )}

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loginBusy}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-blue-500/30 transition-all active:scale-95 cursor-pointer"
              >
                {loginBusy ? 'Please wait…' : accessCheck.hasPinSet ? 'Sign In to Super Admin' : 'Create PIN & Sign In'}
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <button
              onClick={onExitAdmin}
              className="text-xs text-slate-400 hover:text-slate-200 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>Return to POS Terminal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Super Admin Navbar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 lg:px-8 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-black text-white shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-white text-base sm:text-lg tracking-tight">
                SELLORA SAAS CONTROL
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/30">
                Super Admin
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">
              Owner: <span className="text-slate-200 font-semibold">{session?.name || 'Platform Owner'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Refresh Data */}
          <button
            onClick={refreshData}
            title="Refresh tenants and audits"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* New Shop Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/25 transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Register New Shop</span>
            <span className="sm:hidden">New Shop</span>
          </button>

          {/* Exit / Return to POS Terminal */}
          <button
            onClick={onExitAdmin}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm border border-slate-700 transition-colors"
            title="Return to the active shop's POS workspace"
          >
            <Store className="w-4 h-4 text-emerald-400" />
            <span className="hidden md:inline">Open POS Terminal</span>
          </button>

          {/* Change PIN */}
          <button
            onClick={() => setIsChangePinOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition-colors"
            title="Change your Super Admin PIN"
          >
            <KeyRound className="w-4 h-4" />
          </button>

          {/* Sign Out Super Admin */}
          <button
            onClick={() => {
              logoutSuperAdmin();
              onExitAdmin();
            }}
            className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
            title="Sign out of Super Admin"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {isChangePinOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h3 className="text-white font-bold text-base mb-1">Change Super Admin PIN</h3>
            <p className="text-slate-400 text-xs mb-4">This only changes your local sign-in PIN for this dashboard.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setChangePinBusy(true);
                setChangePinMessage(null);
                const result = await changeSuperAdminPin(newPinInput, newPinConfirmInput);
                setChangePinBusy(false);
                setChangePinMessage(result.message);
                if (result.success) {
                  setNewPinInput('');
                  setNewPinConfirmInput('');
                  setTimeout(() => setIsChangePinOpen(false), 1200);
                }
              }}
              className="space-y-3"
            >
              <input
                type="password"
                value={newPinInput}
                onChange={(e) => setNewPinInput(e.target.value)}
                placeholder="New PIN (min. 6 characters)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                required
                autoFocus
              />
              <input
                type="password"
                value={newPinConfirmInput}
                onChange={(e) => setNewPinConfirmInput(e.target.value)}
                placeholder="Confirm new PIN"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500"
                required
              />
              {changePinMessage && (
                <div className="text-xs text-center text-slate-300">{changePinMessage}</div>
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsChangePinOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changePinBusy}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-bold transition-colors"
                >
                  {changePinBusy ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full overflow-y-auto">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Total */}
          <div
            onClick={() => setStatusFilter('ALL')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Total Shops</span>
              <Store className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{kpis.total}</div>
            <div className="text-[10px] text-slate-500 mt-1">Platform tenants</div>
          </div>

          {/* Active */}
          <div
            onClick={() => setStatusFilter('ACTIVE')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Active</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{kpis.active}</div>
            <div className="text-[10px] text-emerald-500/80 mt-1">Licensed & billing</div>
          </div>

          {/* Expiring Soon */}
          <div
            onClick={() => setStatusFilter('EXPIRING')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'EXPIRING'
                ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Expiring Soon</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">{kpis.expiringSoon}</div>
            <div className="text-[10px] text-amber-500/80 mt-1">Due within 30 days</div>
          </div>

          {/* Expired */}
          <div
            onClick={() => setStatusFilter('EXPIRED')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'EXPIRED'
                ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Expired</span>
              <Lock className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-400">{kpis.expired}</div>
            <div className="text-[10px] text-rose-500/80 mt-1">Terminal blocked</div>
          </div>

          {/* Suspended */}
          <div
            onClick={() => setStatusFilter('SUSPENDED')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'SUSPENDED'
                ? 'bg-orange-950/40 border-orange-500 ring-1 ring-orange-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Suspended</span>
              <ShieldAlert className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-orange-400">{kpis.suspended}</div>
            <div className="text-[10px] text-orange-500/80 mt-1">Admin hold</div>
          </div>

          {/* Terminated */}
          <div
            onClick={() => setStatusFilter('TERMINATED')}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              statusFilter === 'TERMINATED'
                ? 'bg-red-950/40 border-red-500 ring-1 ring-red-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-xs font-semibold mb-1">
              <span>Terminated</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-red-500">{kpis.terminated}</div>
            <div className="text-[10px] text-red-500/80 mt-1">Closed accounts</div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-sm font-bold">
            <button
              onClick={() => setActiveTab('shops')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'shops'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Shop Registry ({tenants.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'audit'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Subscription Audit Trail</span>
            </button>

            <button
              onClick={() => setActiveTab('plans')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'plans'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Pricing Plans</span>
            </button>
          </div>
        </div>

        {/* TAB 1: SHOPS REGISTRY TABLE */}
        {activeTab === 'shops' && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="relative w-full md:w-80">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by shop, owner, phone, username..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <span>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACTIVE">Active Only</option>
                    <option value="EXPIRING">Expiring Soon (≤30d)</option>
                    <option value="EXPIRED">Expired</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="TERMINATED">Terminated</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <span>Plan:</span>
                  <select
                    value={planFilter}
                    onChange={(e) => setPlanFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="ALL">All Plans</option>
                    <option value="BASIC">Basic</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </div>

                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('ALL');
                    setPlanFilter('ALL');
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Shop & Owner</th>
                      <th className="px-3 py-3.5">Plan</th>
                      <th className="px-3 py-3.5">Status</th>
                      <th className="px-3 py-3.5">Dates</th>
                      <th className="px-3 py-3.5">Days Remaining</th>
                      <th className="px-3 py-3.5">Contact / Login</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          No shop accounts match your filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((tenant) => {
                        const { status, daysRemaining } = computeSubscriptionStatus(tenant);
                        const displayStatus =
                          tenant.status === 'SUSPENDED' || tenant.status === 'TERMINATED'
                            ? tenant.status
                            : status;

                        return (
                          <tr
                            key={tenant.id}
                            className="hover:bg-slate-800/40 transition-colors group"
                          >
                            {/* Shop & Owner */}
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0">
                                  {tenant.shopName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white truncate">
                                      {tenant.shopName}
                                    </span>
                                    {tenant.isPrimaryTenant && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-slate-400 truncate">
                                    Owner: <span className="text-slate-300">{tenant.ownerName}</span>
                                    {tenant.location && ` • ${tenant.location}`}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Plan */}
                            <td className="px-3 py-3.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  tenant.plan === 'PREMIUM'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : tenant.plan === 'STANDARD'
                                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {tenant.plan}
                              </span>
                            </td>

                            {/* Status */}
                            <td className="px-3 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black tracking-wider uppercase ${
                                  displayStatus === 'ACTIVE'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : displayStatus === 'EXPIRING_SOON'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : displayStatus === 'EXPIRED'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : displayStatus === 'SUSPENDED'
                                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                    : 'bg-red-500/20 text-red-500 border border-red-500/30'
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {displayStatus.replace('_', ' ')}
                              </span>
                            </td>

                            {/* Dates */}
                            <td className="px-3 py-3.5 text-xs text-slate-300 whitespace-nowrap">
                              <div className="flex items-center gap-1 text-slate-400">
                                <span>Start:</span> {tenant.startDate || tenant.createdAt.slice(0, 10)}
                              </div>
                              <div className="flex items-center gap-1 font-semibold text-slate-200">
                                <span>Expires:</span> {tenant.expiryDate}
                              </div>
                            </td>

                            {/* Days Remaining */}
                            <td className="px-3 py-3.5 whitespace-nowrap">
                              {displayStatus === 'TERMINATED' ? (
                                <span className="text-red-400 font-bold text-xs">Terminated</span>
                              ) : displayStatus === 'SUSPENDED' ? (
                                <span className="text-orange-400 font-bold text-xs">On Hold</span>
                              ) : daysRemaining <= 0 ? (
                                <span className="text-rose-400 font-extrabold text-xs">
                                  Expired ({Math.abs(daysRemaining)}d ago)
                                </span>
                              ) : (
                                <span
                                  className={`font-bold text-xs ${
                                    daysRemaining <= 7
                                      ? 'text-amber-400'
                                      : daysRemaining <= 30
                                      ? 'text-yellow-300'
                                      : 'text-emerald-400'
                                  }`}
                                >
                                  {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
                                </span>
                              )}
                            </td>

                            {/* Contact / Credentials */}
                            <td className="px-3 py-3.5 text-xs">
                              <div className="flex items-center gap-1 text-slate-300">
                                <Phone className="w-3 h-3 text-slate-500" />
                                <span>{tenant.phone}</span>
                              </div>
                              <div className="flex items-center gap-1 font-mono text-[11px] text-slate-400">
                                <span>User:</span>
                                <span className="text-blue-400 font-bold">{tenant.username}</span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1 sm:gap-1.5">
                                {/* Open POS Terminal as this tenant */}
                                <button
                                  onClick={() => handleSwitchToShop(tenant.id)}
                                  title="Enter and manage this shop's terminal"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>

                                {/* Renew Button */}
                                <button
                                  onClick={() => {
                                    setRenewingTenant(tenant);
                                    setRenewMonths(1);
                                  }}
                                  title="Renew or extend subscription"
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/30 transition-colors"
                                >
                                  Renew +
                                </button>

                                {/* Edit Button */}
                                <button
                                  onClick={() => setEditingTenant(tenant)}
                                  title="Edit shop details"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                {/* Reset Password */}
                                <button
                                  onClick={() => {
                                    const newPass = resetTenantPassword(tenant.id);
                                    refreshData();
                                    setResetPassTenant(tenant);
                                    setGeneratedNewPass(newPass);
                                  }}
                                  title="Reset password for this shop"
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 transition-colors"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>

                                {/* Suspend / Reactivate */}
                                {tenant.status === 'SUSPENDED' ? (
                                  <button
                                    onClick={() => {
                                      reactivateTenant(tenant.id);
                                      refreshData();
                                    }}
                                    title="Reactivate shop"
                                    className="p-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white transition-colors"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      const reason = prompt(`Enter reason for suspending ${tenant.shopName}:`);
                                      if (reason !== null) {
                                        suspendTenant(tenant.id, reason);
                                        refreshData();
                                      }
                                    }}
                                    title="Suspend shop access"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-orange-600 text-slate-400 hover:text-white transition-colors"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {/* Terminate */}
                                {tenant.status !== 'TERMINATED' && !tenant.isPrimaryTenant && (
                                  <button
                                    onClick={() => setConfirmTerminateTenant(tenant)}
                                    title="Terminate subscription"
                                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-700 text-slate-400 hover:text-white transition-colors"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-white text-base">Platform Subscription Audit Log</h3>
                <p className="text-xs text-slate-400">
                  Immutable record of renewals, creations, suspensions, reactivations, and credential resets.
                </p>
              </div>
              <button
                onClick={refreshData}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Log</span>
              </button>
            </div>

            <div className="divide-y divide-slate-800/80 max-h-[600px] overflow-y-auto">
              {auditLog.map((entry) => (
                <div key={entry.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          entry.action.includes('RENEWED') || entry.action.includes('ACTIVATED')
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : entry.action.includes('SUSPENDED') || entry.action.includes('TERMINATED')
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : entry.action.includes('PASSWORD')
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-white">{entry.shopName}</span>
                      <span className="text-slate-500">• Performed by: {entry.admin}</span>
                    </div>
                    <p className="text-slate-300 text-xs">{entry.details}</p>
                  </div>
                  <div className="text-[11px] text-slate-500 shrink-0 font-mono whitespace-nowrap">
                    {new Date(entry.time).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PRICING PLANS */}
        {activeTab === 'plans' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <span>Subscription Plans & Pricing Control</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Manage commercial subscription rates and feature tiers for both Industry POS solutions and Platform SaaS tiers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="p-1 rounded-xl bg-slate-800 border border-slate-700 flex text-xs font-bold">
                  <button
                    onClick={() => setPlansCategory('industry')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      plansCategory === 'industry'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Industry Editions ({industryPlans.length})
                  </button>
                  <button
                    onClick={() => setPlansCategory('saas')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      plansCategory === 'saas'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    SaaS Tiers ({plans.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset all custom subscription prices back to factory standard?')) {
                      resetCustomPlanPricing();
                      localStorage.removeItem('mj_saas_plans');
                      refreshData();
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  Reset Defaults
                </button>
              </div>
            </div>

            {/* INDUSTRY EDITIONS PRICING */}
            {plansCategory === 'industry' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {industryPlans.map((ind) => (
                  <div
                    key={ind.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col justify-between shadow-xl transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-3xl">{ind.emoji}</span>
                          <div>
                            <h4 className="font-black text-base text-white">{ind.name}</h4>
                            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60 text-blue-300">
                              {ind.shortName}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 mb-4 line-clamp-2">{ind.description}</p>

                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 mb-4 space-y-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-slate-400">Monthly Rate:</span>
                          <span className="text-xl font-black text-white font-mono">
                            KES {ind.monthlyPrice.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/mo</span>
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-slate-400">Annual (2 mos free):</span>
                          <span className="text-xs font-bold text-emerald-400 font-mono">
                            KES {ind.annualPrice.toLocaleString()} /yr
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-4">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Key Capabilities:
                        </span>
                        {ind.features.slice(0, 3).map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            <span className="truncate">{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setEditingIndustryModal(ind);
                        setIndustryEditMonthly(ind.monthlyPrice);
                        setIndustryEditAnnual(ind.annualPrice);
                      }}
                      className="mt-2 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Change Subscription Price</span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* SAAS TIERS PRICING */}
            {plansCategory === 'saas' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {plans.map((p) => (
                  <div
                    key={p.id}
                    className={`bg-slate-900 border rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden ${
                      p.id === 'PREMIUM'
                        ? 'border-purple-500/60 shadow-purple-500/5'
                        : p.id === 'STANDARD'
                        ? 'border-blue-500/60 shadow-blue-500/5'
                        : 'border-slate-800'
                    }`}
                  >
                    {p.badge && (
                      <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-blue-600/30 text-blue-400 border border-blue-500/40 text-[10px] font-bold uppercase tracking-wider">
                        {p.badge}
                      </div>
                    )}

                    <div>
                      <h4 className="font-extrabold text-xl text-white">{p.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">{p.description}</p>

                      <div className="my-5 pb-5 border-b border-slate-800">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xs text-slate-400 font-semibold">KES</span>
                          <span className="text-3xl font-black text-white">
                            {p.priceMonthly.toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400">/ month</span>
                        </div>
                        <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                          KES {p.priceAnnual.toLocaleString()} billed annually (2 months free)
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Included Capabilities:
                        </p>
                        {p.features.map((feat, fIdx) => (
                          <div key={fIdx} className="flex items-center gap-2 text-xs text-slate-300">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800">
                      <button
                        onClick={() => {
                          setEditingPlanModal(p);
                          setPlanEditMonthly(p.priceMonthly);
                          setPlanEditAnnual(p.priceAnnual);
                        }}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5 text-blue-400" />
                        <span>Change Subscription Price</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL 1: REGISTER NEW SHOP */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Register New Shop Tenant</h3>
                  <p className="text-xs text-slate-400">Generate credentials and set subscription parameters</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShopSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Shop Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopForm.shopName}
                    onChange={(e) => setNewShopForm({ ...newShopForm, shopName: e.target.value })}
                    placeholder="e.g. Apex Cyber & Tech"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Shop Owner Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopForm.ownerName}
                    onChange={(e) => setNewShopForm({ ...newShopForm, ownerName: e.target.value })}
                    placeholder="e.g. Samuel Mwangi"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Business Type *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {industryPlans.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewShopForm({ ...newShopForm, businessType: opt.id })}
                      className={`px-2.5 py-2 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 justify-center ${
                        newShopForm.businessType === opt.id
                          ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.shortName}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone Number (M-Pesa) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newShopForm.phone}
                    onChange={(e) => setNewShopForm({ ...newShopForm, phone: e.target.value })}
                    placeholder="0712345678"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Owner Email (used to sign in) *
                  </label>
                  <input
                    type="email"
                    required
                    value={newShopForm.email}
                    onChange={(e) => setNewShopForm({ ...newShopForm, email: e.target.value })}
                    placeholder="owner@example.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Owner Password *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={6}
                    value={newShopForm.password}
                    onChange={(e) => setNewShopForm({ ...newShopForm, password: e.target.value })}
                    placeholder="At least 6 characters - share this with the owner"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {createShopError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/50 text-rose-300 text-xs">
                  {createShopError}
                </div>
              )}


              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Subscription Tier
                  </label>
                  <select
                    value={newShopForm.plan}
                    onChange={(e) => setNewShopForm({ ...newShopForm, plan: e.target.value as SubscriptionPlan })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="BASIC">Basic Cyber (KES 1,200)</option>
                    <option value="STANDARD">Standard Pro (KES 2,200)</option>
                    <option value="PREMIUM">Premium Enterprise (KES 3,500)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={newShopForm.startDate}
                    onChange={(e) => setNewShopForm({ ...newShopForm, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Initial Period
                  </label>
                  <select
                    value={newShopForm.monthsToAdd}
                    onChange={(e) => setNewShopForm({ ...newShopForm, monthsToAdd: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  >
                    <option value={1}>1 Month</option>
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={12}>1 Year (12 Months)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Location / Physical Address
                </label>
                <input
                  type="text"
                  value={newShopForm.location}
                  onChange={(e) => setNewShopForm({ ...newShopForm, location: e.target.value })}
                  placeholder="e.g. Roysambu Lumumba Drive, Shop 4"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createShopBusy}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                >
                  {createShopBusy ? 'Creating…' : 'Register & Provision Shop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUAL RENEWAL / EXTENSION */}
      {renewingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Renew Subscription</h3>
                  <p className="text-xs text-slate-400">{renewingTenant.shopName}</p>
                </div>
              </div>
              <button
                onClick={() => setRenewingTenant(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Current Expiry Date:</span>
                  <span className="font-bold text-white">{renewingTenant.expiryDate}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Subscription Plan:</span>
                  <span className="font-bold text-blue-400">{renewingTenant.plan}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">
                  Select Period to Extend
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '+1 Month', value: 1 },
                    { label: '+3 Months', value: 3 },
                    { label: '+6 Months', value: 6 },
                    { label: '+1 Year', value: 12 },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setRenewMonths(opt.value);
                        setCustomExpiry('');
                      }}
                      className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                        renewMonths === opt.value && !customExpiry
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Or Set Specific Custom Expiry Date:
                </label>
                <input
                  type="date"
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setRenewingTenant(null)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all"
                >
                  Confirm Renewal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT SHOP DETAILS */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                  <Edit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Edit Shop Information</h3>
                  <p className="text-xs text-slate-400">{editingTenant.shopName}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTenant(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Shop Name
                </label>
                <input
                  type="text"
                  required
                  value={editingTenant.shopName}
                  onChange={(e) => setEditingTenant({ ...editingTenant, shopName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Owner Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editingTenant.ownerName}
                  onChange={(e) => setEditingTenant({ ...editingTenant, ownerName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    required
                    value={editingTenant.phone}
                    onChange={(e) => setEditingTenant({ ...editingTenant, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editingTenant.email}
                    onChange={(e) => setEditingTenant({ ...editingTenant, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Plan
                  </label>
                  <select
                    value={editingTenant.plan}
                    onChange={(e) => setEditingTenant({ ...editingTenant, plan: e.target.value as SubscriptionPlan })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="BASIC">Basic</option>
                    <option value="STANDARD">Standard</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={editingTenant.expiryDate}
                    onChange={(e) => setEditingTenant({ ...editingTenant, expiryDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Location / Physical Address
                </label>
                <input
                  type="text"
                  value={editingTenant.location || ''}
                  onChange={(e) => setEditingTenant({ ...editingTenant, location: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: SHOW / COPY RESET CREDENTIALS */}
      {resetPassTenant && generatedNewPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="text-center space-y-2 mb-5">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-500/30">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white">Client Login Credentials</h3>
              <p className="text-xs text-slate-400">
                Share these details with {resetPassTenant.ownerName} ({resetPassTenant.shopName})
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs space-y-2 text-slate-300">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Shop:</span>
                <span className="text-white font-bold font-sans">{resetPassTenant.shopName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Username:</span>
                <span className="text-blue-400 font-bold">{resetPassTenant.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Password:</span>
                <span className="text-emerald-400 font-bold">{generatedNewPass}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Plan:</span>
                <span className="text-purple-300 font-bold">{resetPassTenant.plan}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Expires:</span>
                <span className="text-slate-300">{resetPassTenant.expiryDate}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  const shareText = `*Sellora POS Credentials*\nShop: ${resetPassTenant.shopName}\nUsername: ${resetPassTenant.username}\nPassword: ${generatedNewPass}\nPlan: ${resetPassTenant.plan}\nExpiry: ${resetPassTenant.expiryDate}`;
                  handleCopy(shareText, 'creds');
                }}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                {copiedKey === 'creds' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey === 'creds' ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
              </button>

              <button
                onClick={() => {
                  setResetPassTenant(null);
                  setGeneratedNewPass(null);
                }}
                className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: EDIT SAAS TIER PRICING */}
      {editingPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Edit Subscription Price</h3>
                  <p className="text-xs text-slate-400">{editingPlanModal.name} SaaS Tier</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPlanModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const updated = plans.map((pl) =>
                  pl.id === editingPlanModal.id
                    ? {
                        ...pl,
                        priceMonthly: Number(planEditMonthly),
                        priceAnnual: Number(planEditAnnual),
                      }
                    : pl
                );
                setPlans(updated);
                saveSaaSPlans(updated);
                setEditingPlanModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Monthly Subscription (KES)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    KES
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={planEditMonthly}
                    onChange={(e) => {
                      const m = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setPlanEditMonthly(m);
                      setPlanEditAnnual(m * 10);
                    }}
                    className="w-full pl-12 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Annual Subscription (KES)
                  </label>
                  <button
                    type="button"
                    onClick={() => setPlanEditAnnual(planEditMonthly * 10)}
                    className="text-[11px] text-blue-400 hover:underline font-bold"
                  >
                    10x (2 Mo Free)
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    KES
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={planEditAnnual}
                    onChange={(e) => setPlanEditAnnual(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full pl-12 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="flex justify-between">
                  <span>Current Tier:</span>
                  <span className="text-white font-bold">{editingPlanModal.name}</span>
                </p>
                <p className="flex justify-between">
                  <span>Effective Monthly Rate:</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    KES {planEditMonthly.toLocaleString()}
                  </span>
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingPlanModal(null)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                >
                  Save Subscription Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: EDIT INDUSTRY EDITION PRICING */}
      {editingIndustryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-xl shadow-md">
                  {editingIndustryModal.emoji}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Edit Industry Pricing</h3>
                  <p className="text-xs text-slate-400">{editingIndustryModal.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingIndustryModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateCustomPlanPrice(editingIndustryModal.id, industryEditMonthly, industryEditAnnual);
                refreshData();
                setEditingIndustryModal(null);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Monthly Subscription Fee (KES)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    KES
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={industryEditMonthly}
                    onChange={(e) => {
                      const m = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setIndustryEditMonthly(m);
                      setIndustryEditAnnual(m * 10);
                    }}
                    className="w-full pl-12 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Annual Fee (KES)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIndustryEditAnnual(industryEditMonthly * 10)}
                    className="text-[11px] text-blue-400 hover:underline font-bold"
                  >
                    10x (2 Mo Free)
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                    KES
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={industryEditAnnual}
                    onChange={(e) =>
                      setIndustryEditAnnual(Math.max(0, parseInt(e.target.value, 10) || 0))
                    }
                    className="w-full pl-12 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="flex justify-between">
                  <span>Edition:</span>
                  <span className="text-white font-bold">{editingIndustryModal.shortName}</span>
                </p>
                <p className="flex justify-between">
                  <span>Annual Discount:</span>
                  <span className="text-emerald-400 font-mono font-bold">
                    Save KES {(industryEditMonthly * 12 - industryEditAnnual).toLocaleString()} /yr
                  </span>
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingIndustryModal(null)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all"
                >
                  Save Subscription Price
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmTerminateTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-rose-900/80 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center border border-rose-500/30">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Terminate Subscription?</h3>
                <p className="text-xs text-rose-300">This action will immediately restrict POS access</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1 mb-4">
              <p>
                <strong className="text-white">Shop:</strong> {confirmTerminateTenant.shopName}
              </p>
              <p>
                <strong className="text-white">Owner:</strong> {confirmTerminateTenant.ownerName}
              </p>
              <p className="text-slate-400 pt-1">
                Note: 100% of this shop's sales records, stock count, and expenses will be safely preserved. The owner simply will not be able to operate the terminal until reactivated.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmTerminateTenant(null)}
                className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  terminateTenant(confirmTerminateTenant.id);
                  refreshData();
                  setConfirmTerminateTenant(null);
                }}
                className="flex-1 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition-all"
              >
                Confirm Termination
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
