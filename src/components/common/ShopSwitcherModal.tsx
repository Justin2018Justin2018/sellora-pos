import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Store, X, Plus, Check, MapPin, Phone, ShieldCheck, KeyRound, Building2 } from 'lucide-react';
import { getTenants, computeSubscriptionStatus } from '../../services/saasService';

interface ShopSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSuperAdmin?: () => void;
}

export const ShopSwitcherModal: React.FC<ShopSwitcherModalProps> = ({
  isOpen,
  onClose,
  onOpenSuperAdmin,
}) => {
  const { shops, currentShop, switchShop, addToast, currentTenant, switchTenant } = usePOS();

  const [activeView, setActiveView] = useState<'tenants' | 'branches'>('tenants');
  const [isAdding, setIsAdding] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchLocation, setBranchLocation] = useState('');
  const [branchPhone, setBranchPhone] = useState('');

  if (!isOpen) return null;

  const tenants = getTenants();

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      addToast({ type: 'error', title: 'Branch Name Required' });
      return;
    }

    addToast({
      type: 'info',
      title: 'Branch Added',
      message: 'New branch configured for multi-location synchronization.',
    });

    setBranchName('');
    setBranchLocation('');
    setBranchPhone('');
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Shop & Account Switcher
              </h3>
              <p className="text-xs text-slate-500">Switch between client shops or branch counters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800/60">
          <button
            onClick={() => setActiveView('tenants')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeView === 'tenants'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            SaaS Client Shops ({tenants.length})
          </button>

          <button
            onClick={() => setActiveView('branches')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
              activeView === 'branches'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Physical Outlets ({shops.length})
          </button>
        </div>

        {/* TAB 1: SAAS CLIENT SHOPS */}
        {activeView === 'tenants' && (
          <div className="space-y-4 pt-4">
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {tenants.map((t) => {
                const isSelected = t.id === currentTenant.id;
                const { status, daysRemaining } = computeSubscriptionStatus(t);
                const displayStatus = t.status === 'SUSPENDED' || t.status === 'TERMINATED' ? t.status : status;

                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      switchTenant(t.id);
                      addToast({
                        type: 'info',
                        title: 'Switched Shop Account',
                        message: `Now operating terminal for ${t.shopName}`,
                      });
                      onClose();
                    }}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {t.shopName}
                        </h4>
                        <span
                          className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${
                            displayStatus === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                              : displayStatus === 'EXPIRING_SOON'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {displayStatus}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Owner: {t.ownerName}</span>
                        <span>•</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{t.plan} Plan</span>
                        <span>•</span>
                        <span>
                          {daysRemaining > 0 ? `${daysRemaining} days left` : 'Expired'}
                        </span>
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {onOpenSuperAdmin && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => {
                    onClose();
                    onOpenSuperAdmin();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Open Platform Super Admin Dashboard</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PHYSICAL OUTLETS */}
        {activeView === 'branches' && (
          <div className="pt-4">
            {!isAdding ? (
              <div className="space-y-4">
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {shops.map((shop) => {
                    const isSelected = shop.id === currentShop.id;
                    return (
                      <button
                        key={shop.id}
                        onClick={() => {
                          switchShop(shop.id);
                          onClose();
                        }}
                        className={`w-full p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{shop.name}</span>
                            {isSelected && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                                Active
                              </span>
                            )}
                          </h4>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {shop.location}
                            </span>
                            {shop.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {shop.phone}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setIsAdding(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Branch / Outlet</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateBranch} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Branch Outlet Name *
                  </label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="e.g. Sellora - Stage Branch"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Physical Location
                  </label>
                  <input
                    type="text"
                    value={branchLocation}
                    onChange={(e) => setBranchLocation(e.target.value)}
                    placeholder="e.g. Near Reuben Dispensary"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Branch Phone Number
                  </label>
                  <input
                    type="text"
                    value={branchPhone}
                    onChange={(e) => setBranchPhone(e.target.value)}
                    placeholder="07xxxxxxxx"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                  >
                    Create Branch
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
