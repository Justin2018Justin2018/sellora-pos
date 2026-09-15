import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { BUSINESS_TYPES, BusinessTypeConfig, getBusinessTypeConfig, getBusinessTypes } from '../../data/businessTypes';
import { BusinessMode, SubscriptionPlan } from '../../types/pos';
import { createTenant, updateTenant } from '../../services/saasService';
import {
  X,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Phone,
  Store,
  User,
  MapPin,
  CreditCard,
  Building,
  Check,
  AlertCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

interface BusinessTypeSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'change_type' | 'signup_new';
  initialType?: BusinessMode;
}

export const BusinessTypeSelectionModal: React.FC<BusinessTypeSelectionModalProps> = ({
  isOpen,
  onClose,
  mode = 'change_type',
  initialType,
}) => {
  const {
    businessMode,
    setBusinessMode,
    currentTenant,
    switchTenant,
    addToast,
    formatMoney,
  } = usePOS();

  const [selectedType, setSelectedType] = useState<BusinessMode>(
    initialType || (mode === 'change_type' ? businessMode : 'cyber')
  );
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [step, setStep] = useState<'choose_type' | 'details' | 'payment'>('choose_type');

  // Sign up form state
  const [formData, setFormData] = useState({
    shopName: '',
    ownerName: '',
    phone: '',
    email: '',
    username: '',
    password: '',
    location: '',
    tillNumber: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState(currentTenant?.phone || '');

  if (!isOpen) return null;

  const activeConfig = getBusinessTypeConfig(selectedType);

  const priceToPay =
    billingCycle === 'monthly' ? activeConfig.monthlyPrice : activeConfig.annualPrice;

  // Plan mapping
  const planForType: SubscriptionPlan =
    selectedType === 'all'
      ? 'ENTERPRISE'
      : selectedType === 'pharmacy' || selectedType === 'restaurant'
      ? 'PREMIUM'
      : 'STANDARD';

  // Handle immediate change for existing tenant
  const handleApplyChange = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      // 1. Update context business mode
      setBusinessMode(selectedType);

      // 2. Persist to current tenant
      if (currentTenant?.id) {
        updateTenant(currentTenant.id, {
          businessType: selectedType,
          plan: planForType,
        });
      }

      addToast({
        title: `${activeConfig.name} Activated!`,
        message: `Your POS layout, categories, and features are now optimized for ${activeConfig.shortName}.`,
        type: 'success',
      });

      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  // Handle new tenant registration
  const handleRegisterNewShop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shopName.trim() || !formData.ownerName.trim() || !formData.phone.trim()) {
      alert('Please enter your Shop Name, Owner Name, and Phone number.');
      return;
    }

    setIsSubmitting(true);
    const startDate = new Date().toISOString().slice(0, 10);
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + (billingCycle === 'annual' ? 12 : 1));
    const expiryStr = expiry.toISOString().slice(0, 10);

    const generatedUsername =
      formData.username.trim() ||
      formData.shopName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) +
        Math.floor(100 + Math.random() * 900);

    const res = createTenant({
      shopName: formData.shopName.trim(),
      ownerName: formData.ownerName.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || `${generatedUsername}@pos.local`,
      username: generatedUsername,
      password: formData.password.trim() || 'pos1234',
      plan: planForType,
      startDate,
      expiryDate: expiryStr,
      location: formData.location.trim(),
      notes: `Registered with POS Business Type: ${activeConfig.name}. Billed ${billingCycle}.`,
    });

    if (res.success && res.tenant) {
      // Update tenant businessType
      updateTenant(res.tenant.id, { businessType: selectedType });

      addToast({
        title: 'New Shop POS Created!',
        message: `Welcome ${res.tenant.ownerName}! Your ${activeConfig.name} is ready.`,
        type: 'success',
      });

      // Switch to newly created tenant and set mode
      switchTenant(res.tenant.id);
      setBusinessMode(selectedType);

      setIsSubmitting(false);
      onClose();
    } else {
      setIsSubmitting(false);
      alert(res.message || 'Failed to create shop account. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="relative px-6 py-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-xl shadow-inner">
                {activeConfig.emoji}
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  {mode === 'change_type'
                    ? 'Choose Your Business POS Type & Plan'
                    : 'Register New Shop — Select Your POS Type'}
                </h2>
                <p className="text-xs text-blue-200 font-medium mt-0.5">
                  You are only charged for the specific POS type you select. Change or upgrade anytime.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="mt-4 flex items-center justify-between flex-wrap gap-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <span>Billing Frequency:</span>
              <div className="inline-flex p-1 bg-slate-800/80 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly Billed
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                    billingCycle === 'annual'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Annual Billed</span>
                  <span className="bg-emerald-500/30 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded font-black border border-emerald-400/40">
                    2 MOS FREE
                  </span>
                </button>
              </div>
            </div>

            <div className="text-xs text-slate-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Full Data Ownership & Instant Activation</span>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {mode === 'change_type' || step === 'choose_type' ? (
            <>
              {/* Prompt Bar */}
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-blue-900 dark:text-blue-300">
                    Tailored for Your Exact Trade:
                  </span>{' '}
                  Selecting a business type automatically adapts your Point of Sale console, inventory
                  units, preloaded categories, receipt headers, and analytics to your specific industry!
                </div>
              </div>

              {/* Grid of Business Types */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getBusinessTypes().map((type) => {
                  const isSelected = selectedType === type.id;
                  const isCurrentActive = mode === 'change_type' && businessMode === type.id;
                  const price =
                    billingCycle === 'monthly' ? type.monthlyPrice : type.annualPrice;

                  return (
                    <div
                      key={type.id}
                      onClick={() => setSelectedType(type.id)}
                      className={`relative rounded-2xl border-2 p-5 cursor-pointer transition-all duration-200 flex flex-col justify-between text-left group ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                      }`}
                    >
                      {/* Top Badges */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-3xl filter drop-shadow-sm">{type.emoji}</span>
                          <div>
                            <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                              {type.badge}
                            </span>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                              {type.name}
                            </h3>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md">
                            <Check className="w-4 h-4 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-slate-300 dark:border-slate-700 shrink-0 group-hover:border-slate-400" />
                        )}
                      </div>

                      {/* Tagline */}
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
                        {type.description}
                      </p>

                      {/* Pricing Tag */}
                      <div className="mb-4 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 flex items-baseline justify-between">
                        <div>
                          <span className="text-lg font-black text-slate-900 dark:text-white">
                            KES {price.toLocaleString()}
                          </span>
                          <span className="text-[11px] text-slate-500 ml-1">
                            / {billingCycle === 'monthly' ? 'month' : 'year'}
                          </span>
                        </div>
                        {billingCycle === 'annual' && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                            2 Mos Free
                          </span>
                        )}
                      </div>

                      {/* Feature Highlights */}
                      <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800 text-left">
                        {type.features.slice(0, 3).map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span className="truncate">{feat}</span>
                          </div>
                        ))}
                      </div>

                      {/* Current Active Indicator */}
                      {isCurrentActive && (
                        <div className="mt-3 text-center">
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            Currently Active On Your POS
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* Signup Step 2: Form Details */
            <form onSubmit={handleRegisterNewShop} className="max-w-2xl mx-auto space-y-5">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{activeConfig.emoji}</span>
                  <div>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">
                      Chosen Business POS Type
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-white">
                      {activeConfig.name}
                    </h4>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    KES {priceToPay.toLocaleString()}
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Billed {billingCycle}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Shop / Business Name *
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Reuben Quick Gas & Cyber"
                      value={formData.shopName}
                      onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Owner Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Hesborn Nyakundi"
                      value={formData.ownerName}
                      onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / WhatsApp (For Receipts & Alerts) *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      placeholder="0712345678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Physical Location / Branch
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="e.g. Stage 2, Reuben Central"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Login Username (Counter POS)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. shopadmin"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Login Password
                  </label>
                  <input
                    type="password"
                    placeholder="Leave blank for auto-generated"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setStep('choose_type')}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  ← Back to POS Types
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Creating Shop Account...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Launch {activeConfig.shortName} POS</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        {(mode === 'change_type' || step === 'choose_type') && (
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="text-xs">
                <span className="text-slate-500 block">Selected POS & Plan:</span>
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{activeConfig.emoji}</span>
                  <span>{activeConfig.name}</span>
                  <span className="text-blue-600 dark:text-blue-400 font-extrabold ml-1">
                    (KES {priceToPay.toLocaleString()} / {billingCycle === 'monthly' ? 'mo' : 'yr'})
                  </span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>

              {mode === 'change_type' ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleApplyChange}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Activating POS Type...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>
                        Switch to {activeConfig.shortName} (KES {priceToPay.toLocaleString()})
                      </span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Continue to Shop Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
