import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { BUSINESS_TYPES, getBusinessTypeConfig } from '../../data/businessTypes';
import { BusinessMode } from '../../types/pos';
import {
  Sparkles,
  X,
  Store,
  Printer,
  Fuel,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Check,
  Zap,
} from 'lucide-react';

interface SetupWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SetupWizardModal: React.FC<SetupWizardModalProps> = ({ isOpen, onClose }) => {
  const {
    profile,
    updateProfile,
    businessMode,
    setBusinessMode,
    addToast,
  } = usePOS();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedType, setSelectedType] = useState<BusinessMode>(businessMode || 'cyber');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

  const [shopName, setShopName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [tillNumber, setTillNumber] = useState(profile.tinNumber || '5432100');
  const [printerFormat, setPrinterFormat] = useState<'58' | '80' | 'A4'>(profile.defaultThermalWidth || '80');

  if (!isOpen) return null;

  const activeConfig = getBusinessTypeConfig(selectedType);
  const priceToPay = billingCycle === 'monthly' ? activeConfig.monthlyPrice : activeConfig.annualPrice;

  const handleFinish = () => {
    // 1. Activate selected business mode
    setBusinessMode(selectedType);

    // 2. Update profile
    updateProfile({
      name: shopName.trim() || 'Sellora POS',
      phone: phone.trim() || '0711146198',
      address: address.trim() || 'Nairobi, Kenya',
      tinNumber: tillNumber.trim() || '5432100',
      defaultThermalWidth: printerFormat,
    });

    addToast({
      type: 'success',
      title: `${activeConfig.name} Activated!`,
      message: `Your POS layout, categories, and features are now tailored for ${activeConfig.shortName}.`,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/25">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Shop Setup & Business Type Wizard
              </h3>
              <p className="text-xs text-slate-500 font-medium">Step {step} of 4 — 2-Minute Quick Start</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP 1: Select Business POS Type */}
        {step === 1 && (
          <div className="space-y-4 pt-4 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-0.5">
                  Step 1: Choose What Type of POS You Need
                </h4>
                <p className="text-xs text-slate-500">
                  Select your trade. You are only charged for the POS features you use.
                </p>
              </div>

              {/* Billing Toggle */}
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('annual')}
                  className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 ${
                    billingCycle === 'annual'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1 py-0.2 rounded font-black">
                    -17%
                  </span>
                </button>
              </div>
            </div>

            {/* Business Type Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {BUSINESS_TYPES.map((type) => {
                const isSelected = selectedType === type.id;
                const price = billingCycle === 'monthly' ? type.monthlyPrice : type.annualPrice;

                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between group ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl shrink-0">{type.emoji}</span>
                        <div className="min-w-0">
                          <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 block truncate">
                            {type.badge}
                          </span>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {type.name}
                          </h5>
                        </div>
                      </div>

                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300 dark:border-slate-700 shrink-0" />
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-1">
                      {type.description}
                    </p>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        KES {price.toLocaleString()}
                        <span className="font-normal text-slate-500 text-[10px]">
                          /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </span>
                      </span>

                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        {type.features.length} Features
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 cursor-pointer"
              >
                <span>Continue with {activeConfig.shortName}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Business Profile & Credentials */}
        {step === 2 && (
          <div className="space-y-4 pt-4 flex-1">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                Step 2: Your Business Profile
              </h4>
              <p className="text-xs text-slate-500 mb-2">
                These credentials will appear on customer receipts and WhatsApp alerts.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Shop / Business Name
              </label>
              <input
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Reuben Express POS"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  WhatsApp / Phone Number
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07xxxxxxxx"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  M-Pesa Till / Paybill
                </label>
                <input
                  type="text"
                  value={tillNumber}
                  onChange={(e) => setTillNumber(e.target.value)}
                  placeholder="e.g. 5432100"
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Physical Location / Town
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Mukuru Kwa Reuben, Stage 2"
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Thermal Receipt Printer */}
        {step === 3 && (
          <div className="space-y-4 pt-4 flex-1">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                Step 3: Thermal Receipt Printer Setup
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Choose the receipt printer size connected to your counter PC or phone.
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  id: '80',
                  title: '80mm Standard POS Thermal Printer',
                  desc: 'Default commercial standard for East Africa (Epson, Xprinter, Rongta, USB & Ethernet)',
                },
                {
                  id: '58',
                  title: '58mm Mini Pocket POS',
                  desc: 'Compact portable Bluetooth or USB thermal receipt printers',
                },
                {
                  id: 'A4',
                  title: 'A4 Full Sheet / Laser / Inkjet',
                  desc: 'Formal PDF A4 tax invoices and printouts',
                },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPrinterFormat(p.id as any)}
                  className={`w-full p-4 rounded-2xl border text-left transition-all ${
                    printerFormat === p.id
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-between">
                    <span>{p.title}</span>
                    {printerFormat === p.id && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                  </h5>
                  <p className="text-[11px] text-slate-500 mt-1">{p.desc}</p>
                </button>
              ))}
            </div>

            <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Ready to Launch */}
        {step === 4 && (
          <div className="space-y-4 pt-4 flex-1">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                Step 4: Ready to Launch Your Terminal!
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Your point of sale system is primed and customized for your exact industry.
              </p>
            </div>

            {/* Selected Trade Card */}
            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{activeConfig.emoji}</span>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                    Active POS Trade
                  </span>
                  <h5 className="text-sm font-black text-slate-900 dark:text-white">
                    {activeConfig.name}
                  </h5>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-900 dark:text-white">
                  KES {priceToPay.toLocaleString()}
                </span>
                <p className="text-[10px] text-slate-500">
                  {billingCycle === 'monthly' ? 'Billed Monthly' : 'Billed Annually'}
                </p>
              </div>
            </div>

            {/* Features Activated */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Preloaded {activeConfig.shortName} catalog, units & categories</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>M-Pesa STK push & Till simulator active ({tillNumber || '5432100'})</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Printer set to {printerFormat}mm thermal layout</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Offline local encrypted storage active</span>
              </div>
            </div>

            <div className="flex justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Launch {activeConfig.shortName} POS</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
