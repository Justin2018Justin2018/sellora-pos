import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  UserCog,
  ShieldCheck,
  Plus,
  Coins,
  Scale,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Users
} from 'lucide-react';
import { UserRole } from '../../types/pos';
import { generalSaleToTransaction } from '../../utils/generalSaleAdapter';

export const StaffView: React.FC = () => {
  const {
    currentUser,
    switchUser,
    businessMode,
    transactions,
    generalSales,
    expenses,
    familyExpenses,
    formatMoney,
    hasRole,
    addToast,
  } = usePOS();

  // Shift Drawer Balancing
  const [openingFloat, setOpeningFloat] = useState<number>(1000);
  const [actualCashCount, setActualCashCount] = useState<number>(1000);

  // Filter today's figures
  const todayKey = new Date().toISOString().slice(0, 10);

  // Cashiers ring sales through the service ledger in cyber mode and through
  // the product POS everywhere else — the drawer must reconcile either way.
  const salesLedger = useMemo(
    () => (businessMode === 'cyber' ? transactions : generalSales.map(generalSaleToTransaction)),
    [businessMode, transactions, generalSales]
  );

  const shiftStats = useMemo(() => {
    let todayCashSales = 0;
    let todayMpesaSales = 0;

    salesLedger.forEach((t) => {
      if (t.status === 'cancelled' || t.date.slice(0, 10) !== todayKey) return;
      if (t.payment === 'Cash') todayCashSales += t.total;
      if (t.payment === 'M-Pesa') todayMpesaSales += t.total;
    });

    let todayCashExpenses = 0;
    expenses.forEach((e) => {
      if (e.date === todayKey && e.payment === 'Cash') todayCashExpenses += e.amount;
    });

    let todayCashFamily = 0;
    familyExpenses.forEach((f) => {
      if (f.date === todayKey) todayCashFamily += f.amount;
    });

    const expectedCashInDrawer = openingFloat + todayCashSales - todayCashExpenses - todayCashFamily;
    const difference = actualCashCount - expectedCashInDrawer;

    return {
      todayCashSales,
      todayMpesaSales,
      todayCashExpenses,
      todayCashFamily,
      expectedCashInDrawer,
      difference,
    };
  }, [salesLedger, expenses, familyExpenses, openingFloat, actualCashCount, todayKey]);

  // Cashier performance
  const staffPerformance = useMemo(() => {
    const map: Record<string, { salesCount: number; volume: number }> = {};

    salesLedger.forEach((t) => {
      if (t.status === 'cancelled') return;
      const s = t.staff || 'Cashier';
      if (!map[s]) map[s] = { salesCount: 0, volume: 0 };
      map[s].salesCount++;
      map[s].volume += t.total;
    });

    return map;
  }, [salesLedger]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-blue-200 border border-white/20 mb-2">
              <UserCog className="w-3.5 h-3.5" />
              <span>Cashier Shift Management & Anti-Fraud Balancing</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              👤 Staff Auditing & End-of-Day Cash Drawer Reconciliation
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
              Zero tolerance for missing funds! Compare starting float, daily cash receipts, and actual drawer counts at shift handover.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/20 text-right">
            <span className="text-[10px] uppercase font-bold text-blue-300">Active Shift Operator</span>
            <p className="text-base font-black text-white">{currentUser?.name || 'Not signed in'}</p>
            <span className="text-[10px] text-blue-200 uppercase font-semibold">({currentUser?.role || 'no session'})</span>
          </div>
        </div>
      </div>

      {/* Daily Cash Drawer Balancing Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600" />
            <span>End of Shift / End of Day Till Balancing</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">Date: {todayKey}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Morning Opening Float (Change given to Cashier)
              </label>
              <input
                type="number"
                min="0"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Actual Physical Cash Counted in Drawer at Handover
              </label>
              <input
                type="number"
                min="0"
                value={actualCashCount}
                onChange={(e) => setActualCashCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-base rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-black"
              />
            </div>
          </div>

          {/* Breakdown calculation */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>+ Starting Float:</span>
              <span className="font-mono">{formatMoney(openingFloat)}</span>
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>+ Today's Cash Sales Collected:</span>
              <span className="font-mono">+{formatMoney(shiftStats.todayCashSales)}</span>
            </div>
            <div className="flex justify-between text-rose-600 dark:text-rose-400">
              <span>- Cash Expenses Paid Out:</span>
              <span className="font-mono">-{formatMoney(shiftStats.todayCashExpenses)}</span>
            </div>
            <div className="flex justify-between text-amber-600 dark:text-amber-400">
              <span>- Family Cash Withdrawals:</span>
              <span className="font-mono">-{formatMoney(shiftStats.todayCashFamily)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-white text-sm">
              <span>Expected Cash in Drawer:</span>
              <span className="font-mono text-blue-600 dark:text-blue-400">
                {formatMoney(shiftStats.expectedCashInDrawer)}
              </span>
            </div>
          </div>

          {/* Variance status */}
          <div
            className={`p-6 rounded-2xl border flex flex-col justify-between ${
              shiftStats.difference === 0
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800'
                : shiftStats.difference > 0
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
            }`}
          >
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Till Variance Audit
              </span>
              <h4 className="text-2xl font-black mt-1 font-mono">
                {shiftStats.difference === 0 && <span className="text-emerald-600">Exact Match (KSh 0)</span>}
                {shiftStats.difference > 0 && (
                  <span className="text-blue-600">+{formatMoney(shiftStats.difference)} Surplus</span>
                )}
                {shiftStats.difference < 0 && (
                  <span className="text-rose-600">-{formatMoney(Math.abs(shiftStats.difference))} Shortage</span>
                )}
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
              {shiftStats.difference === 0
                ? '✅ Perfect handover! Every single shilling is accounted for.'
                : shiftStats.difference < 0
                ? '⚠️ Cash shortage detected. Verify unauthorized payouts or unrecorded transactions with cashier.'
                : 'ℹ️ Cash surplus in drawer. Check if a sale was collected in cash but not keyed in.'}
            </p>
          </div>
        </div>
      </div>

      {/* Staff Performance Leaderboard */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <span>Cashier Sales Leaderboard</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(Object.entries(staffPerformance) as [string, { salesCount: number; volume: number }][]).map(([staffName, data]) => (
            <div
              key={staffName}
              className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
            >
              <span className="text-xs font-bold text-slate-900 dark:text-white block">{staffName}</span>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono mt-1">
                {formatMoney(data.volume)}
              </p>
              <span className="text-xs text-slate-500">{data.salesCount} customer sales logged</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
