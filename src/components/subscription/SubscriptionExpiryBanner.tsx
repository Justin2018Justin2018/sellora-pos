import React from 'react';
import { TenantAccount } from '../../types/pos';
import { computeSubscriptionStatus } from '../../services/saasService';
import { AlertTriangle, Clock, Sparkles, MessageSquareShare, ArrowRight } from 'lucide-react';

interface SubscriptionExpiryBannerProps {
  tenant: TenantAccount;
  onRenewClick?: () => void;
}

export const SubscriptionExpiryBanner: React.FC<SubscriptionExpiryBannerProps> = ({
  tenant,
  onRenewClick,
}) => {
  const { status, daysRemaining } = computeSubscriptionStatus(tenant);

  // Only show warning if within 14 days or expired
  if (daysRemaining > 14 && status !== 'EXPIRING_SOON') {
    return null;
  }

  const isUrgent = daysRemaining <= 3;
  const adminPhone = '0711146198';
  const whatsappUrl = `https://wa.me/254711146198?text=${encodeURIComponent(
    `Hello Hesborn (Sellora POS Super Admin), I would like to renew our SaaS POS subscription for ${tenant.shopName} (${tenant.plan} plan, Account ID: ${tenant.id}).`
  )}`;

  return (
    <div
      className={`rounded-2xl p-4 border transition-all ${
        isUrgent
          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl shrink-0 mt-0.5 ${
              isUrgent
                ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400'
                : 'bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400'
            }`}
          >
            {isUrgent ? (
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            ) : (
              <Clock className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-black">
                {daysRemaining <= 0
                  ? 'Subscription Grace Period Active'
                  : `Subscription Renewal Notice: ${daysRemaining} Day${daysRemaining === 1 ? '' : 's'} Remaining`}
              </h4>
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.2 rounded bg-slate-900/10 dark:bg-white/10">
                {tenant.plan} Plan
              </span>
            </div>
            <p className="text-xs mt-0.5 opacity-90">
              Your license expires on <span className="font-bold">{tenant.expiryDate}</span>. Renew promptly to prevent automated system lockouts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors"
          >
            <MessageSquareShare className="w-3.5 h-3.5" />
            <span>Renew via M-Pesa</span>
          </a>

          {onRenewClick && (
            <button
              onClick={onRenewClick}
              className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
            >
              <span>Manage</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
