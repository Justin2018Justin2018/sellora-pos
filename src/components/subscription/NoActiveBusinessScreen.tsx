import React from 'react';
import { TenantAccount } from '../../types/pos';
import { Store, ArrowRight, ShieldCheck } from 'lucide-react';

interface NoActiveBusinessScreenProps {
  tenant: TenantAccount;
  onSubscribe: () => void;
  onOpenSuperAdmin?: () => void;
}

/**
 * Distinct from SubscriptionBlockedScreen: the account itself is fine
 * (not expired/suspended), but every individual business subscription
 * has expired or been cancelled, so there is nothing left to switch
 * into. Historical data for every business is still safe - it simply
 * reappears the moment a business is reactivated.
 */
export const NoActiveBusinessScreen: React.FC<NoActiveBusinessScreenProps> = ({
  tenant,
  onSubscribe,
  onOpenSuperAdmin,
}) => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0B1220] px-4 py-10">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-center mb-5">
          <Store className="w-7 h-7 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-lg font-black text-slate-900 dark:text-white">No Active Business</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300">{tenant.shopName}</span>'s account is
          active, but every business module (Shop, Cyber, Gas, Electronics, ...) is currently unsubscribed or has
          expired. Subscribe to a business to get back in - none of your past sales, stock, or customer data was
          lost, and it will all reappear exactly as you left it.
        </p>

        <button
          onClick={onSubscribe}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors cursor-pointer"
        >
          <span>Subscribe to a Business</span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {onOpenSuperAdmin && (
          <button
            onClick={onOpenSuperAdmin}
            className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Super Admin Portal</span>
          </button>
        )}
      </div>
    </div>
  );
};
