import React, { useState, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  getBusinessTypes,
  saveCustomPlanPricing,
  resetCustomPlanPricing,
  getCustomPlanPricing,
  BusinessTypeConfig,
} from '../../data/businessTypes';
import {
  getSaaSPlans,
  saveSaaSPlans,
  logSubscriptionAudit,
} from '../../services/saasService';
import { SubscriptionPlanConfig } from '../../types/pos';
import {
  X,
  DollarSign,
  Save,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  Layers,
  Calculator,
} from 'lucide-react';

interface SubscriptionBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubscriptionBillingModal: React.FC<SubscriptionBillingModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { addToast, formatMoney, businessMode, currentTenant } = usePOS();

  const [activeCategory, setActiveCategory] = useState<'industry' | 'tiers'>('industry');
  const [businessTypes, setBusinessTypes] = useState<BusinessTypeConfig[]>([]);
  const [saasPlans, setSaasPlans] = useState<SubscriptionPlanConfig[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Editable states
  const [editableIndustryPrices, setEditableIndustryPrices] = useState<
    Record<string, { monthlyPrice: number; annualPrice: number }>
  >({});

  const [editableTierPrices, setEditableTierPrices] = useState<
    Record<string, { monthlyPrice: number; annualPrice: number }>
  >({});

  const loadData = () => {
    const types = getBusinessTypes();
    setBusinessTypes(types);

    const indMap: Record<string, { monthlyPrice: number; annualPrice: number }> = {};
    types.forEach((t) => {
      indMap[t.id] = {
        monthlyPrice: t.monthlyPrice,
        annualPrice: t.annualPrice,
      };
    });
    setEditableIndustryPrices(indMap);

    const plans = getSaaSPlans();
    setSaasPlans(plans);

    const tierMap: Record<string, { monthlyPrice: number; annualPrice: number }> = {};
    plans.forEach((p) => {
      tierMap[p.id] = {
        monthlyPrice: p.priceMonthly,
        annualPrice: p.priceAnnual,
      };
    });
    setEditableTierPrices(tierMap);

    setHasChanges(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleIndustryPriceChange = (
    id: string,
    field: 'monthlyPrice' | 'annualPrice',
    value: string
  ) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setEditableIndustryPrices((prev) => {
      const current = prev[id] || { monthlyPrice: 0, annualPrice: 0 };
      const updated = { ...current, [field]: num };

      // If user changed monthly and annual hasn't been explicitly touched, auto-suggest 10x
      if (field === 'monthlyPrice' && (!current.annualPrice || current.annualPrice === current.monthlyPrice * 10)) {
        updated.annualPrice = num * 10;
      }

      return { ...prev, [id]: updated };
    });
    setHasChanges(true);
  };

  const handleAutoAnnualIndustry = (id: string) => {
    const current = editableIndustryPrices[id];
    if (!current) return;
    const calculatedAnnual = current.monthlyPrice * 10; // 2 months free discount
    setEditableIndustryPrices((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        annualPrice: calculatedAnnual,
      },
    }));
    setHasChanges(true);
  };

  const handleTierPriceChange = (
    id: string,
    field: 'monthlyPrice' | 'annualPrice',
    value: string
  ) => {
    const num = Math.max(0, parseInt(value, 10) || 0);
    setEditableTierPrices((prev) => {
      const current = prev[id] || { monthlyPrice: 0, annualPrice: 0 };
      const updated = { ...current, [field]: num };

      if (field === 'monthlyPrice' && (!current.annualPrice || current.annualPrice === current.monthlyPrice * 10)) {
        updated.annualPrice = num * 10;
      }

      return { ...prev, [id]: updated };
    });
    setHasChanges(true);
  };

  const handleSaveAll = () => {
    setIsSaving(true);

    try {
      // 1. Save industry prices
      saveCustomPlanPricing(editableIndustryPrices);

      // 2. Save SaaS tier prices
      const updatedPlans = saasPlans.map((p) => {
        const custom = editableTierPrices[p.id];
        if (custom) {
          return {
            ...p,
            priceMonthly: custom.monthlyPrice,
            priceAnnual: custom.annualPrice,
          };
        }
        return p;
      });
      saveSaaSPlans(updatedPlans);

      // Log audit
      logSubscriptionAudit({
        action: 'SUBSCRIPTION_CHANGED',
        shopId: currentTenant?.id || 'SYSTEM',
        shopName: currentTenant?.shopName || 'System Billing',
        details: 'Updated subscription rates for business types and SaaS tiers',
      });

      addToast({
        type: 'success',
        title: 'Billing Prices Saved',
        message: 'Subscription pricing updated successfully across the POS platform.',
      });

      setHasChanges(false);
      setIsSaving(false);
      loadData();
    } catch (err) {
      console.error('Error saving subscription prices:', err);
      setIsSaving(false);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not update pricing. Please try again.',
      });
    }
  };

  const handleResetDefaults = () => {
    if (
      !window.confirm(
        'Are you sure you want to reset all subscription prices to standard factory defaults?'
      )
    ) {
      return;
    }

    resetCustomPlanPricing();
    localStorage.removeItem('mj_saas_plans');

    addToast({
      type: 'info',
      title: 'Pricing Reset',
      message: 'Subscription prices have been restored to default rates.',
    });

    loadData();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                <DollarSign className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Billing Configuration
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              Manage Subscription Pricing
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Set custom monthly and annual subscription rates for industry POS plans and SaaS platform tiers. All updates take effect immediately in billing reminders, renewals, and the shop setup catalog.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => setActiveCategory('industry')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeCategory === 'industry'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Industry POS Plans ({businessTypes.length})</span>
            </button>

            <button
              onClick={() => setActiveCategory('tiers')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeCategory === 'tiers'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>SaaS Platform Tiers ({saasPlans.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Reset all prices to initial defaults"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Factory Defaults</span>
            </button>
          </div>
        </div>

        {/* Pricing Content Area */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/40">
          {activeCategory === 'industry' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {businessTypes.map((type) => {
                const isCurrent = businessMode === type.id;
                const prices = editableIndustryPrices[type.id] || {
                  monthlyPrice: type.monthlyPrice,
                  annualPrice: type.annualPrice,
                };

                return (
                  <div
                    key={type.id}
                    className={`rounded-2xl p-4.5 border transition-all bg-white dark:bg-slate-900 ${
                      isCurrent
                        ? 'border-blue-500/60 ring-2 ring-blue-500/20 shadow-md'
                        : 'border-slate-200 dark:border-slate-800 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{type.emoji}</span>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{type.name}</span>
                            {isCurrent && (
                              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 font-bold">
                                Current
                              </span>
                            )}
                          </h4>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {type.tagline}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Price Inputs */}
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Monthly Fee (KES)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                            KES
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="50"
                            value={prices.monthlyPrice}
                            onChange={(e) =>
                              handleIndustryPriceChange(type.id, 'monthlyPrice', e.target.value)
                            }
                            className="w-full pl-11 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Annual Fee (KES)
                          </label>
                          <button
                            type="button"
                            onClick={() => handleAutoAnnualIndustry(type.id)}
                            title="Auto-calculate 10x monthly (2 months free)"
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                          >
                            <Calculator className="w-2.5 h-2.5" />
                            <span>10x</span>
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                            KES
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={prices.annualPrice}
                            onChange={(e) =>
                              handleIndustryPriceChange(type.id, 'annualPrice', e.target.value)
                            }
                            className="w-full pl-11 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Annual Savings:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                        {prices.monthlyPrice * 12 > prices.annualPrice
                          ? `Save ${formatMoney(prices.monthlyPrice * 12 - prices.annualPrice)} /yr`
                          : 'Standard Rate'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeCategory === 'tiers' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {saasPlans.map((plan) => {
                const prices = editableTierPrices[plan.id] || {
                  monthlyPrice: plan.priceMonthly,
                  annualPrice: plan.priceAnnual,
                };

                return (
                  <div
                    key={plan.id}
                    className="rounded-2xl p-5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
                          {plan.name}
                        </span>
                        {plan.isPopular && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
                            Most Popular
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        {plan.description}
                      </p>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Monthly Subscription (KES)
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                            KES
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={prices.monthlyPrice}
                            onChange={(e) =>
                              handleTierPriceChange(plan.id, 'monthlyPrice', e.target.value)
                            }
                            className="w-full pl-11 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Annual Subscription (KES)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const calc = prices.monthlyPrice * 10;
                              setEditableTierPrices((prev) => ({
                                ...prev,
                                [plan.id]: { ...prev[plan.id], annualPrice: calc },
                              }));
                              setHasChanges(true);
                            }}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                          >
                            <Calculator className="w-2.5 h-2.5" />
                            <span>10x (2 Mo Free)</span>
                          </button>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-400">
                            KES
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            value={prices.annualPrice}
                            onChange={(e) =>
                              handleTierPriceChange(plan.id, 'annualPrice', e.target.value)
                            }
                            className="w-full pl-11 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {hasChanges ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                <span>You have unsaved pricing modifications</span>
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Subscription rates are synchronized</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || !hasChanges}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Subscription Prices'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
