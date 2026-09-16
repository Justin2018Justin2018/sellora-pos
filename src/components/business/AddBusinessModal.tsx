import React, { useState } from 'react';
import { X, Loader2, ShieldAlert, PlusCircle } from 'lucide-react';
import { BUSINESS_TYPES } from '../../data/businessTypes';
import { BusinessMode } from '../../types/pos';
import { claimAdditionalBusiness } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';

const slugify = (value: string): string => {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  return slug || `biz-${Date.now()}`;
};

interface AddBusinessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Self-service flow for an ALREADY signed-in customer to subscribe to
 * an additional business type under their own account (e.g. a Shop
 * customer adding Cyber too). Distinct from the Super Admin's
 * create-business flow, which provisions a brand-new customer/login -
 * this one just adds another shop_members row for the same user.
 *
 * NOTE: this creates the business on a 14-day trial, same as any new
 * shop claim. Real payment collection (M-Pesa) isn't built yet, so
 * "subscribing" here means claiming the business - a platform admin
 * still controls final plan/expiry from the Super Admin dashboard.
 */
export const AddBusinessModal: React.FC<AddBusinessModalProps> = ({ isOpen, onClose }) => {
  const { refresh } = useAuth();
  const [shopName, setShopName] = useState('');
  const [businessType, setBusinessType] = useState<BusinessMode>('general_shop');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const shopId = shopName.trim() ? slugify(shopName) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!shopId) {
      setError('Enter a name for this business.');
      return;
    }
    setBusy(true);
    const result = await claimAdditionalBusiness(shopId, businessType, shopName.trim());
    setBusy(false);

    if (!result.success) {
      setError(result.message);
      return;
    }
    await refresh();
    setShopName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <PlusCircle className="w-4.5 h-4.5 text-blue-600" />
            <span>Add a Business</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Subscribe to another business type. It stays completely separate from your existing businesses - its own
            products, sales, stock, and customers.
          </p>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Business Name
            </label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="e.g. Mama Justo Cyber"
              className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
            {shopId && (
              <p className="text-[11px] text-slate-400 mt-1">
                Business ID: <span className="font-mono text-slate-500">{shopId}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Business Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt.id}
                  type="button"
                  onClick={() => setBusinessType(bt.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-bold border transition-all ${
                    businessType === bt.id
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  <span className="text-base leading-none">{bt.emoji}</span>
                  <span className="truncate">{bt.shortName}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold text-sm transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Add Business'}
          </button>
        </form>
      </div>
    </div>
  );
};
