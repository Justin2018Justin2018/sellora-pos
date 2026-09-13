import React, { useState, useRef, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Settings,
  Store,
  Printer,
  Shield,
  KeyRound,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Coins,
  Cpu,
  Save,
  Lock,
  DollarSign,
  ExternalLink,
  HelpCircle,
  Zap,
  History,
} from 'lucide-react';
import { BusinessProfile } from '../../types/pos';
import { BusinessTypeSelectionModal } from '../subscription/BusinessTypeSelectionModal';
import { SubscriptionBillingModal } from '../subscription/SubscriptionBillingModal';
import { getBusinessTypeConfig } from '../../data/businessTypes';
import { Sparkles, RefreshCw, Check } from 'lucide-react';
import { executeTestPrint, openTestPrintInNewTab } from '../../utils/printReceipt';
import { TaxSettingsSection } from './TaxSettingsSection';

export const SettingsView: React.FC = () => {
  const {
    profile,
    updateProfile,
    formatMoney,
    currentUser,
    switchUser,
    backupDatabase,
    restoreDatabase,
    resetDatabase,
    hasRole,
    addToast,
    updateAdminPassword,
    businessMode,
    currentTenant,
    auditLog,
  } = usePOS();

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [pricingVersion, setPricingVersion] = useState(0);
  const [isTestingPrinter, setIsTestingPrinter] = useState(false);

  useEffect(() => {
    const handlePricingUpdate = () => {
      setPricingVersion((v) => v + 1);
    };
    window.addEventListener('mj_pricing_updated', handlePricingUpdate);
    return () => window.removeEventListener('mj_pricing_updated', handlePricingUpdate);
  }, []);

  const activeConfig = getBusinessTypeConfig(businessMode);

  // Local form state
  const [formData, setFormData] = useState<BusinessProfile>({ ...profile });
  const [activationKey, setActivationKey] = useState('');
  const [currentSecurityPass, setCurrentSecurityPass] = useState('');
  const [newSecurityPass, setNewSecurityPass] = useState('');
  const [confirmSecurityPass, setConfirmSecurityPass] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateSecurityPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSecurityPass.trim()) {
      addToast({ type: 'error', title: 'Current Password Required' });
      return;
    }
    if (!newSecurityPass.trim() || newSecurityPass.trim().length < 4) {
      addToast({ type: 'error', title: 'Password Too Short', message: 'New password must be at least 4 characters long.' });
      return;
    }
    if (newSecurityPass !== confirmSecurityPass) {
      addToast({ type: 'error', title: 'Passwords Do Not Match', message: 'New password and confirmation must match.' });
      return;
    }
    const res = updateAdminPassword(currentSecurityPass, newSecurityPass);
    if (res.success) {
      setCurrentSecurityPass('');
      setNewSecurityPass('');
      setConfirmSecurityPass('');
    } else {
      addToast({ type: 'error', title: 'Update Failed', message: res.message });
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
  };

  const handleBackup = () => {
    const jsonStr = backupDatabase();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SelloraPOS_FullBackup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addToast({ type: 'success', title: 'Backup Downloaded Successfully' });
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = restoreDatabase(content);
      if (success) {
        window.location.reload();
      }
    };
    reader.readAsText(file);
  };

  const handleReset = () => {
    const confirmName = prompt(
      'Type "RESET" to confirm restoring system to factory default settings. All current transactions will be cleared:'
    );
    if (confirmName === 'RESET') {
      resetDatabase();
      window.location.reload();
    }
  };

  const handleActivateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (activationKey.trim().length >= 8) {
      updateProfile({
        licenseStatus: 'commercial',
        licenseKey: activationKey.trim().toUpperCase(),
      });
      addToast({
        type: 'success',
        title: 'Commercial License Activated!',
        message: 'Lifetime unlimited commercial license unlocked.',
      });
      setActivationKey('');
    } else {
      addToast({
        type: 'error',
        title: 'Invalid Activation Key',
        message: 'Please enter a valid commercial license serial key.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-blue-200 border border-white/20 mb-2">
              <Settings className="w-3.5 h-3.5" />
              <span>System Configuration & Hardware Setup</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              ⚙️ Business Settings & Commercial Controls
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
              Configure shop credentials, M-Pesa Till integration, thermal receipt printer sizing (58mm/80mm), multi-role security PINs, and automated JSON backups.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/20 text-right">
            <span className="text-[10px] uppercase font-bold text-blue-300">Software License</span>
            <p className="text-sm font-black text-emerald-300 flex items-center gap-1.5 justify-end mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>{profile.licenseStatus === 'commercial' ? 'Lifetime Commercial' : 'Active Trial'}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Business Profile Form */}
        <div className="lg:col-span-8 space-y-6">
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Store className="w-4 h-4 text-blue-600" />
              <span>Shop Identity & Customer Facing Details</span>
            </h3>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Business Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tagline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={formData.tagline}
                    onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Phone / WhatsApp Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Physical Location / Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    M-Pesa Till / Paybill No.
                  </label>
                  <input
                    type="text"
                    value={formData.tillNumber}
                    onChange={(e) => setFormData({ ...formData, tillNumber: e.target.value })}
                    placeholder="e.g. 5432100"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Tax / KRA PIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.kraPin || ''}
                    onChange={(e) => setFormData({ ...formData, kraPin: e.target.value })}
                    placeholder="e.g. P051234567Z"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Default Receipt Footer Note
                </label>
                <input
                  type="text"
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-transform active:scale-98"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Business Details</span>
                </button>
              </div>
            </form>
          </div>

          {/* Tax Rules & VAT Configuration */}
          <TaxSettingsSection />

          {/* Thermal Printer Sizing & Hardware Diagnostic */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Printer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <span>Thermal Receipt Printer & Hardware Setup</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Direct ESC/POS thermal printing for countertop, Bluetooth pocket, and standard office printers.
                </p>
              </div>

              {/* Test Print Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isTestingPrinter}
                  onClick={() => {
                    setIsTestingPrinter(true);
                    const format = profile.receiptFormat === '58mm' ? '58' : profile.receiptFormat === 'a4' ? 'A4' : '80';
                    addToast({
                      type: 'info',
                      title: '🖨️ Printing Test Ticket...',
                      message: `Sending diagnostic pattern to ${profile.receiptFormat || '80mm'} printer`,
                    });
                    executeTestPrint({
                      profile,
                      format,
                      formatMoney,
                    });
                    setTimeout(() => setIsTestingPrinter(false), 1200);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isTestingPrinter ? 'Printing...' : 'Print Test Ticket'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const format = profile.receiptFormat === '58mm' ? '58' : profile.receiptFormat === 'a4' ? 'A4' : '80';
                    openTestPrintInNewTab({
                      profile,
                      format,
                      formatMoney,
                    });
                  }}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                  title="Open test ticket in a new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview Tab</span>
                </button>
              </div>
            </div>

            {/* Paper Size Format Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                Target Paper Size & Driver Scaling
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    id: '80mm',
                    name: '80mm Standard POS',
                    badge: 'Recommended',
                    badgeColor: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400',
                    desc: 'Epson, Xprinter, Rongta, Bixolon, Sunmi countertop printers.',
                  },
                  {
                    id: '58mm',
                    name: '58mm Mini Thermal',
                    badge: 'Pocket / Mobile',
                    badgeColor: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400',
                    desc: 'POS-58, Goojprt, Bluetooth portable Android slips.',
                  },
                  {
                    id: 'a4',
                    name: 'A4 Office Invoice',
                    badge: 'Full Sheet',
                    badgeColor: 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-400',
                    desc: 'HP LaserJet, Epson EcoTank, Canon, Brother standard sheets.',
                  },
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    onClick={() => updateProfile({ receiptFormat: fmt.id as any })}
                    className={`p-4 rounded-2xl border text-left transition-all relative ${
                      profile.receiptFormat === fmt.id
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-xs text-slate-900 dark:text-white block">{fmt.name}</span>
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${fmt.badgeColor}`}>
                        {fmt.badge}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed block">{fmt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt Automation & Formatting Options */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                <div className="space-y-0.5 pr-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    <span>Instant Auto-Print On Sale</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Immediately send receipt to thermal printer as soon as cashier clicks Complete Sale.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={!!profile.autoPrintReceipt}
                  onChange={(e) => updateProfile({ autoPrintReceipt: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300">
                <div className="font-bold mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                  <span>Browser Thermal Printing Guide</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-800 dark:text-blue-200 opacity-90">
                  <li>In print dialog, set <strong>Destination</strong> to your POS printer.</li>
                  <li>Set <strong>Margins</strong> to <strong>None</strong> (or Minimum).</li>
                  <li>Check <strong>Background graphics</strong> to ensure clear divider lines and barcode output.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Security, Licensing, Backup */}
        <div className="lg:col-span-4 space-y-6">
          {/* Active Business Type & Subscription Plan Card */}
          <div className="rounded-3xl bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-900 p-6 text-white shadow-xl border border-blue-800/50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Active POS Plan
              </span>
              <span className="text-2xl">{activeConfig.emoji}</span>
            </div>

            <h3 className="text-base font-black tracking-tight text-white mb-1">
              {activeConfig.name}
            </h3>
            <p className="text-xs text-blue-200/80 mb-4 line-clamp-2">
              {activeConfig.description}
            </p>

            <div className="p-3 rounded-2xl bg-white/10 border border-white/15 mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-blue-300 uppercase font-bold block">Rate / Month</span>
                <span className="text-base font-black text-white">
                  KES {activeConfig.monthlyPrice.toLocaleString()}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-blue-300 uppercase font-bold block">Annual (Save 17%)</span>
                <span className="text-xs font-bold text-emerald-300">
                  KES {activeConfig.annualPrice.toLocaleString()}/yr
                </span>
              </div>
            </div>

            <div className="space-y-1.5 mb-4 text-xs text-slate-300">
              {activeConfig.features.slice(0, 3).map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{f}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setIsPlanModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/30 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Change Business Type / Plan</span>
              </button>

              <button
                type="button"
                onClick={() => setIsBillingModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-blue-100 border border-white/20 transition-all cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5 text-amber-300" />
                <span>Change Subscription Prices</span>
              </button>
            </div>
          </div>

          {/* Active Cashier / User Switching */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>Cashier & Role Security</span>
            </h3>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Current Logged In User</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{currentUser?.name || 'Not signed in'}</p>
                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 mt-1 capitalize">
                  {currentUser?.role ? `${currentUser.role} Privileges` : 'No active session'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Switch Active Operator:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => switchUser('cashier')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      currentUser?.role === 'cashier'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Cashier Shift
                  </button>
                  <button
                    onClick={() => switchUser('admin')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      currentUser?.role === 'admin'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Admin Master
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Security Password (for Transaction Deletions & High-Risk Actions) */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Admin Security Password
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Required to permanently delete transactions and perform system resets.
            </p>

            <form onSubmit={handleUpdateSecurityPassword} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Current Admin Password
                </label>
                <input
                  type="password"
                  value={currentSecurityPass}
                  onChange={(e) => setCurrentSecurityPass(e.target.value)}
                  placeholder="Enter current admin password"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  New Admin Password
                </label>
                <input
                  type="password"
                  value={newSecurityPass}
                  onChange={(e) => setNewSecurityPass(e.target.value)}
                  placeholder="Min 4 characters"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmSecurityPass}
                  onChange={(e) => setConfirmSecurityPass(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={!currentSecurityPass.trim() || !newSecurityPass.trim() || !confirmSecurityPass.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Save New Deletion Password</span>
              </button>
            </form>
          </div>
          <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl border border-slate-800">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span>Commercial License & Activation</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Enter reseller product key to activate unlimited multi-device commercial license.
            </p>

            <form onSubmit={handleActivateLicense} className="space-y-3">
              <input
                type="text"
                value={activationKey}
                onChange={(e) => setActivationKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-800 border border-slate-700 text-white font-mono uppercase tracking-widest placeholder-slate-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md transition-colors"
              >
                Verify & Activate
              </button>
            </form>
          </div>

          {/* Billing & Subscription Pricing Configuration */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Subscription Billing & Pricing</span>
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                Customizable
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Configure and modify subscription rates for Cyber, Gas, Electronics, and all industry editions or SaaS tiers.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 mb-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Active POS Plan:</span>
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  <span>{activeConfig.emoji}</span>
                  <span>{activeConfig.name}</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Monthly Rate:</span>
                <span className="font-bold font-mono text-slate-900 dark:text-white">
                  KES {activeConfig.monthlyPrice.toLocaleString()} / month
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Annual Rate (10x):</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  KES {activeConfig.annualPrice.toLocaleString()} / year
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsBillingModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white shadow-md transition-all cursor-pointer"
            >
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              <span>Change Subscription Prices</span>
            </button>
          </div>

          {/* Database Backup & Restore */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-600" />
              <span>Data Protection & Backup</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Export an encrypted full JSON snapshot of sales, stock, and debts for disaster recovery:
            </p>

            <div className="space-y-2">
              <button
                onClick={handleBackup}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Full JSON Backup</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleRestoreFile}
                accept=".json"
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Restore Database from File</span>
              </button>

              {hasRole('admin') && (
                <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleReset}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset to Factory Defaults</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Activity Log - who changed what and when, admin/owner only */}
          {hasRole('admin') && (
            <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" />
                <span>Activity Log</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                A record of important changes made in this shop - stock adjustments, pricing changes, deletions, and
                more - so you always know who did what and when.
              </p>

              {auditLog.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No activity recorded yet.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto -mx-2 px-2 space-y-1">
                  {auditLog.slice(0, 100).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-3 py-2 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs border-b border-slate-50 dark:border-slate-800/60 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">{entry.details}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {entry.staff} &middot; {entry.action}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {new Date(entry.time).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <BusinessTypeSelectionModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
      />

      <SubscriptionBillingModal
        isOpen={isBillingModalOpen}
        onClose={() => setIsBillingModalOpen(false)}
      />
    </div>
  );
};
