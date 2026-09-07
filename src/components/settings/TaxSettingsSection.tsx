import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Receipt,
  Percent,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  Calculator,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Info,
  Check,
} from 'lucide-react';
import { TaxRule } from '../../types/pos';

export const TaxSettingsSection: React.FC = () => {
  const {
    profile,
    updateProfile,
    taxRules,
    addTaxRule,
    updateTaxRule,
    deleteTaxRule,
    toggleTaxRule,
    setDefaultTaxRule,
    formatMoney,
    hasRole,
    addToast,
  } = usePOS();

  const [isAddingRule, setIsAddingRule] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleRate, setNewRuleRate] = useState<number>(16);
  const [newRuleType, setNewRuleType] = useState<'inclusive' | 'exclusive'>('inclusive');
  const [newRuleDescription, setNewRuleDescription] = useState('');
  const [newRuleIsDefault, setNewRuleIsDefault] = useState(false);

  // Live calculator test state
  const [sampleAmount, setSampleAmount] = useState<number>(1000);

  const activeDefaultRule = taxRules.find((r) => r.isDefault && r.active) || taxRules[0];
  const activeRate = activeDefaultRule ? activeDefaultRule.rate : (profile.defaultTaxRate ?? 16);
  const activeType = activeDefaultRule ? activeDefaultRule.type : (profile.taxCalculationMode ?? 'inclusive');

  // Math for sample calculation
  const calculatedSample = React.useMemo(() => {
    const amt = Math.max(0, sampleAmount || 0);
    if (!profile.enableTax || activeRate <= 0) {
      return {
        gross: amt,
        net: amt,
        tax: 0,
        rate: 0,
        type: activeType,
      };
    }

    if (activeType === 'inclusive') {
      // Inclusive: Gross = amt. Net = amt / (1 + rate/100). Tax = Gross - Net.
      const net = amt / (1 + activeRate / 100);
      const tax = amt - net;
      return {
        gross: amt,
        net,
        tax,
        rate: activeRate,
        type: 'inclusive' as const,
      };
    } else {
      // Exclusive: Net = amt. Tax = amt * (rate/100). Gross = amt + Tax.
      const tax = amt * (activeRate / 100);
      const gross = amt + tax;
      return {
        gross,
        net: amt,
        tax,
        rate: activeRate,
        type: 'exclusive' as const,
      };
    }
  }, [sampleAmount, profile.enableTax, activeRate, activeType]);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) {
      addToast({ type: 'warning', title: 'Rule Name Required', message: 'Enter a valid descriptive name.' });
      return;
    }
    if (newRuleRate < 0 || newRuleRate > 100) {
      addToast({ type: 'error', title: 'Invalid Tax Rate', message: 'Tax percentage must be between 0% and 100%.' });
      return;
    }

    addTaxRule({
      name: newRuleName.trim(),
      rate: Number(newRuleRate),
      type: newRuleType,
      description: newRuleDescription.trim(),
      isDefault: newRuleIsDefault,
      active: true,
    });

    setIsAddingRule(false);
    setNewRuleName('');
    setNewRuleRate(16);
    setNewRuleType('inclusive');
    setNewRuleDescription('');
    setNewRuleIsDefault(false);
  };

  const applyKenyaStandardPresets = () => {
    updateProfile({
      enableTax: true,
      taxCalculationMode: 'inclusive',
      defaultTaxRate: 16,
      taxName: 'VAT (16%)',
      kraPin: profile.kraPin || 'P051234567Z',
    });
    addToast({
      type: 'success',
      title: 'Kenya Standard VAT Applied',
      message: '16% Inclusive VAT set as standard business tax rule.',
    });
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Tax Rules & VAT Configuration
              </h3>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  profile.enableTax
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {profile.enableTax ? 'Tax Engine Active' : 'Tax Disabled'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Configure Value Added Tax (VAT), sales tax rates, KRA PIN compliance, and pricing modes for automated checkout calculations.
            </p>
          </div>
        </div>

        {/* Master Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextState = !profile.enableTax;
              updateProfile({ enableTax: nextState });
              addToast({
                type: nextState ? 'success' : 'info',
                title: nextState ? 'Tax Enabled' : 'Tax Disabled',
                message: nextState
                  ? 'Automatic VAT will now be applied during sales.'
                  : 'Sales will proceed with 0% tax calculation.',
              });
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              profile.enableTax
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {profile.enableTax ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
            <span>{profile.enableTax ? 'Tax Calculation ON' : 'Tax Calculation OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main Settings Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            KRA PIN / Tax ID (Receipts & Invoices)
          </label>
          <input
            type="text"
            value={profile.kraPin || ''}
            onChange={(e) => updateProfile({ kraPin: e.target.value.toUpperCase() })}
            placeholder="e.g. P051234567Z"
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-mono font-bold tracking-wider placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Displayed on thermal receipts and formal customer invoices.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Default Tax Display Label
          </label>
          <input
            type="text"
            value={profile.taxName || 'VAT (16%)'}
            onChange={(e) => updateProfile({ taxName: e.target.value })}
            placeholder="e.g. VAT (16%) or Sales Tax"
            className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Printed on receipts alongside calculated tax values.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Default Tax Rate (%)
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={profile.defaultTaxRate ?? 16}
              onChange={(e) => updateProfile({ defaultTaxRate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3.5 py-2.5 pr-8 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 dark:text-slate-500 font-bold">
              %
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Standard VAT in Kenya is 16.0%, LPG / Fuel is 8.0%.
          </p>
        </div>
      </div>

      {/* Tax Calculation Mode Selector */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
          Calculation Mode (How Prices Are Treated in POS)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Inclusive Option */}
          <div
            onClick={() => updateProfile({ taxCalculationMode: 'inclusive' })}
            className={`cursor-pointer p-4 rounded-2xl border transition-all ${
              profile.taxCalculationMode === 'inclusive'
                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Tax Inclusive (Recommended for Retail & Cyber)</span>
              </span>
              {profile.taxCalculationMode === 'inclusive' && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Product prices already include tax. A product tagged at KSh 100 sells for KSh 100.
              The receipt will clearly extract Net Amount (KSh 86.21) + 16% VAT (KSh 13.79).
            </p>
          </div>

          {/* Exclusive Option */}
          <div
            onClick={() => updateProfile({ taxCalculationMode: 'exclusive' })}
            className={`cursor-pointer p-4 rounded-2xl border transition-all ${
              profile.taxCalculationMode === 'exclusive'
                ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold flex items-center gap-2">
                <Percent className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Tax Exclusive (Added at Checkout)</span>
              </span>
              {profile.taxCalculationMode === 'exclusive' && (
                <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Tax is calculated on top of product prices at checkout. A product tagged at KSh 100
              will add KSh 16.00 VAT, totaling KSh 116.00 at final payment.
            </p>
          </div>
        </div>
      </div>

      {/* Tax Rules List */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Configured Tax Rules & VAT Rates</span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Select standard rates or add custom rules for various product categories.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={applyKenyaStandardPresets}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Reset Kenya VAT Presets</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddingRule(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Tax Rule</span>
            </button>
          </div>
        </div>

        {/* New Rule Modal / Inline Form */}
        {isAddingRule && (
          <form
            onSubmit={handleCreateRule}
            className="p-4 rounded-2xl bg-blue-50/50 dark:bg-slate-800/90 border border-blue-200 dark:border-slate-700 space-y-4 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-blue-100 dark:border-slate-700">
              <h5 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Create New Tax Rule</span>
              </h5>
              <button
                type="button"
                onClick={() => setIsAddingRule(false)}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reduced Rate (8%)"
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tax Rate (%) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  required
                  value={newRuleRate}
                  onChange={(e) => setNewRuleRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Calculation Type
                </label>
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as 'inclusive' | 'exclusive')}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="inclusive">Inclusive (in price)</option>
                  <option value="exclusive">Exclusive (added at checkout)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description / Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Applicable to LPG cylinders and cooking gas refills"
                value={newRuleDescription}
                onChange={(e) => setNewRuleDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={newRuleIsDefault}
                  onChange={(e) => setNewRuleIsDefault(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <span>Set as default tax rule for sales</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingRule(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-sm"
                >
                  Save Tax Rule
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Rules Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold">
                <th className="py-2.5 px-4">Tax Rule Name</th>
                <th className="py-2.5 px-4 text-center">Rate</th>
                <th className="py-2.5 px-4">Calculation</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-900">
              {taxRules.map((rule) => {
                const isDefault = rule.isDefault || rule.id === activeDefaultRule?.id;
                return (
                  <tr
                    key={rule.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                      !rule.active ? 'opacity-50' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {rule.name}
                        </span>
                        {isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                            DEFAULT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {rule.rate}%
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-slate-600 dark:text-slate-400 font-medium">
                        {rule.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px] max-w-xs truncate">
                      {rule.description || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleTaxRule(rule.id)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rule.active
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {rule.active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isDefault && rule.active && (
                          <button
                            type="button"
                            onClick={() => setDefaultTaxRule(rule.id)}
                            className="px-2 py-1 text-[11px] font-medium rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            title="Set as Default Rule"
                          >
                            Set Default
                          </button>
                        )}
                        {hasRole('admin') && taxRules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteTaxRule(rule.id)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            title="Delete Tax Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-Time Live Tax Calculation Preview & Simulator */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-xs font-bold text-slate-900 dark:text-white">
              Live POS Checkout Tax Preview & Simulator
            </span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Interactive Test Sandbox
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Sample Sale Amount ({profile.currency || 'KSh'})
            </label>
            <input
              type="number"
              min="1"
              value={sampleAmount}
              onChange={(e) => setSampleAmount(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
            />
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80">
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
              Net Subtotal
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5">
              {formatMoney(calculatedSample.net)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50">
            <div className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase flex items-center justify-between">
              <span>{profile.taxName || 'VAT'} ({calculatedSample.rate}%)</span>
              <span className="capitalize text-[9px] font-bold">
                {calculatedSample.type}
              </span>
            </div>
            <div className="text-sm font-bold text-amber-700 dark:text-amber-300 font-mono mt-0.5">
              {formatMoney(calculatedSample.tax)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50">
            <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase">
              Customer Total
            </div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
              {formatMoney(calculatedSample.gross)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
          <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span>
            {calculatedSample.type === 'inclusive'
              ? `Prices are Tax Inclusive: A sale of ${formatMoney(calculatedSample.gross)} contains ${formatMoney(calculatedSample.tax)} in ${profile.taxName || 'VAT'}, with net revenue of ${formatMoney(calculatedSample.net)}.`
              : `Prices are Tax Exclusive: A sale of ${formatMoney(calculatedSample.net)} adds ${formatMoney(calculatedSample.tax)} tax, making grand total payable ${formatMoney(calculatedSample.gross)}.`}
          </span>
        </div>
      </div>
    </div>
  );
};
