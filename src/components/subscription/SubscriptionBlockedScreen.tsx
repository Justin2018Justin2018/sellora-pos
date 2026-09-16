import React, { useState } from 'react';
import { TenantAccount } from '../../types/pos';
import { useAuth } from '../../context/AuthContext';
import { getBusinessTypeConfig } from '../../data/businessTypes';
import {
  ShieldAlert,
  Lock,
  Phone,
  MessageSquareShare,
  Mail,
  ShieldCheck,
  RefreshCw,
  KeyRound,
  Store,
  CheckCircle2,
  Calendar,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';
import { loginSuperAdmin } from '../../services/saasService';

interface SubscriptionBlockedScreenProps {
  tenant: TenantAccount;
  onSuperAdminAuthenticated: () => void;
  onSwitchTenant: () => void;
  onRefreshStatus: () => void;
}

export const SubscriptionBlockedScreen: React.FC<SubscriptionBlockedScreenProps> = ({
  tenant,
  onSuperAdminAuthenticated,
  onSwitchTenant,
  onRefreshStatus,
}) => {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState('superadmin');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const { memberships, shopId: activeShopId, switchActiveBusiness } = useAuth();
  const otherActiveBusinesses = memberships.filter((m) => m.status === 'ACTIVE' && m.shopId !== activeShopId);

  const isExpired = tenant.status === 'EXPIRED';
  const isSuspended = tenant.status === 'SUSPENDED';
  const isTerminated = tenant.status === 'TERMINATED';

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!adminPassword.trim()) {
      setLoginError('Please enter the Super Admin security key.');
      return;
    }
    const success = await loginSuperAdmin(adminPassword, adminUsername);
    if (success) {
      onSuperAdminAuthenticated();
    } else {
      setLoginError('Invalid Super Admin credentials. Please check your password.');
    }
  };

  const adminPhone = '0711146198';
  const adminAltPhone = '0711146198';
  const adminEmail = 'hesborn.nyakundi495@gmail.com';
  const whatsappUrl = `https://wa.me/254711146198?text=${encodeURIComponent(
    `Hello Hesborn (Sellora POS Platform Admin), I am the owner of ${tenant.shopName} (${tenant.ownerName}). My subscription is currently ${tenant.status} (Expiry: ${tenant.expiryDate}). I would like to renew/reactivate my account.`
  )}`;

  return (
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-blue-600 selection:text-white p-4 sm:p-6 lg:p-10 font-sans">
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-lg shadow-lg shadow-blue-500/30">
            S
          </div>
          <div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight text-white block">
              SELLORA POS
            </span>
            <span className="text-[11px] text-blue-400 font-semibold tracking-wider uppercase">
              Subscription Management Gateway
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onRefreshStatus}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700 transition-colors"
            title="Check if admin has renewed your account"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Check Status</span>
          </button>

          <button
            onClick={() => setShowAdminLogin(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-xs font-semibold text-blue-400 border border-blue-500/40 transition-colors"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Super Admin Portal</span>
          </button>
        </div>
      </header>

      {/* Main Lockout Notice */}
      <main className="w-full max-w-3xl mx-auto my-auto py-8">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          {/* Subtle Status Light Strip */}
          <div
            className={`absolute top-0 left-0 right-0 h-1.5 ${
              isTerminated
                ? 'bg-red-700'
                : isSuspended
                ? 'bg-amber-500'
                : 'bg-rose-600'
            }`}
          />

          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            {/* Status Icon */}
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-xl ${
                isTerminated
                  ? 'bg-red-950/80 border border-red-800 text-red-400'
                  : isSuspended
                  ? 'bg-amber-950/80 border border-amber-700 text-amber-400'
                  : 'bg-rose-950/80 border border-rose-800 text-rose-400'
              }`}
            >
              {isTerminated ? (
                <AlertOctagon className="w-8 h-8" />
              ) : isSuspended ? (
                <ShieldAlert className="w-8 h-8" />
              ) : (
                <Lock className="w-8 h-8" />
              )}
            </div>

            {/* Title & Description */}
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black tracking-wider uppercase ${
                    isTerminated
                      ? 'bg-red-600 text-white'
                      : isSuspended
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {tenant.status}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  Shop ID: {tenant.id}
                </span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {isTerminated
                  ? 'Account Terminated'
                  : isSuspended
                  ? 'Account Temporarily Suspended'
                  : 'Subscription Expired'}
              </h2>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                {isTerminated ? (
                  <>
                    The subscription for <strong className="text-white">{tenant.shopName}</strong> has been terminated by the platform administrator. Access to the POS terminal is currently restricted.
                  </>
                ) : isSuspended ? (
                  <>
                    Access for <strong className="text-white">{tenant.shopName}</strong> is temporarily suspended. Please contact the platform owner to settle any outstanding issues and restore instant access.
                  </>
                ) : (
                  <>
                    Your <strong className="text-white">Sellora POS ({tenant.plan} Plan)</strong> subscription for{' '}
                    <strong className="text-white">{tenant.shopName}</strong> expired on{' '}
                    <strong className="text-rose-400">{tenant.expiryDate}</strong>. Please renew your monthly or annual subscription to resume sales and billing.
                  </>
                )}
              </p>

              {/* Data Safety Guarantee Box */}
              <div className="mt-4 p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-slate-300">
                  <span className="font-bold text-white block mb-0.5">
                    Your Shop Data Is 100% Safe & Preserved
                  </span>
                  All past receipts, inventory ream counts, gas refill records, customer debt ledgers, and profit reports remain safely stored. Everything will be instantly accessible the moment your account is renewed or reactivated.
                </div>
              </div>
            </div>
          </div>

          {/* Action Hub */}
          <div className="mt-8 pt-6 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all active:scale-95"
            >
              <MessageSquareShare className="w-4 h-4" />
              <span>Renew via WhatsApp Now</span>
            </a>

            <a
              href={`tel:${adminPhone}`}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm border border-slate-700 transition-all"
            >
              <Phone className="w-4 h-4 text-blue-400" />
              <span>Call Admin: {adminPhone}</span>
            </a>
          </div>

          {/* If this customer has other ACTIVE businesses, this specific
              one being blocked shouldn't lock them out of those too. */}
          {otherActiveBusinesses.length > 0 && (
            <div className="mt-6 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-900/50">
              <p className="text-xs font-bold text-emerald-300 mb-2.5 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                <span>You still have access to your other businesses:</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {otherActiveBusinesses.map((m) => {
                  const config = getBusinessTypeConfig(m.businessType as any);
                  return (
                    <button
                      key={m.shopId}
                      onClick={() => switchActiveBusiness(m.shopId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-200 text-xs font-semibold transition-colors"
                    >
                      <span>{config.emoji}</span>
                      <span>{m.shopName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Secondary Details & Controls */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 pt-4 border-t border-slate-800/60">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                Registered: {tenant.startDate || tenant.createdAt?.slice(0, 10)}
              </span>
              <span>•</span>
              <span>Owner: {tenant.ownerName}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onSwitchTenant}
                className="hover:text-blue-400 underline underline-offset-2 flex items-center gap-1 transition-colors"
              >
                <Store className="w-3 h-3" />
                <span>Switch Shop Account</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Support Info */}
      <footer className="w-full max-w-5xl mx-auto pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
        <p>
          Sellora SaaS POS Platform • Platform Super Admin: <span className="text-slate-300">Hesborn Nyakundi</span> • Support: <span className="text-blue-400">{adminPhone}</span> • <span className="text-slate-400">{adminEmail}</span>
        </p>
      </footer>

      {/* Super Admin Login Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Super Admin Access</h3>
                  <p className="text-xs text-slate-400">Platform Owner Control Portal</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAdminLogin(false);
                  setLoginError('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {loginError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-medium">
                {loginError}
              </div>
            )}

            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Super Admin Username
                </label>
                <input
                  type="text"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="superadmin"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Super Admin Master Password
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter security key"
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white focus:outline-hidden focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  This is the platform-level Super Admin account, configured via
                  environment variables for this deployment.
                </p>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAdminLogin(false)}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all"
                >
                  <span>Unlock Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
