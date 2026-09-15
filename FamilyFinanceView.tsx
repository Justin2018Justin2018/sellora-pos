import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  HeartHandshake,
  Plus,
  Trash2,
  DollarSign,
  ShieldCheck,
  TrendingDown,
  Lock,
  PiggyBank,
  CheckCircle2
} from 'lucide-react';
import { FamilyExpense } from '../../types/pos';

export const FamilyFinanceView: React.FC = () => {
  const {
    familyExpenses,
    addFamilyExpense,
    deleteFamilyExpense,
    transactions,
    expenses,
    formatMoney,
    hasRole,
    addToast,
  } = usePOS();

  // Form State
  const [recipient, setRecipient] = useState('Home & Groceries');
  const [amount, setAmount] = useState<number>(500);
  const [purpose, setPurpose] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Options
  const recipientCategories = [
    'Home & Groceries',
    'School Fees & Books',
    'Family House Rent',
    'Medical & Health',
    'Emergency & Relatives',
    'Personal Savings',
    'Other Personal Drawing',
  ];

  // Calculations
  const stats = useMemo(() => {
    const thisMonthStr = new Date().toISOString().slice(0, 7);
    let totalAllTime = 0;
    let totalThisMonth = 0;

    familyExpenses.forEach((f) => {
      const a = Number(f.amount || 0);
      totalAllTime += a;
      if (f.date.slice(0, 7) === thisMonthStr) totalThisMonth += a;
    });

    // Business net sales
    const netSales = transactions
      .filter((t) => t.status !== 'cancelled' && t.payment !== 'Credit / Debt')
      .reduce((sum, t) => sum + t.total, 0);

    const businessExpensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
    const businessMaterialTotal = transactions.reduce((sum, t) => sum + (t.materialTotal || 0), 0);
    const trueNetBusinessProfit = netSales - businessExpensesTotal - businessMaterialTotal;

    const remainingRetainedCapital = trueNetBusinessProfit - totalAllTime;

    return { totalAllTime, totalThisMonth, trueNetBusinessProfit, remainingRetainedCapital };
  }, [familyExpenses, transactions, expenses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      addToast({ type: 'error', title: 'Invalid Amount', message: 'Amount must be greater than 0.' });
      return;
    }

    addFamilyExpense(
      recipient,
      amount,
      date,
      'Cash',
      purpose.trim() || recipient
    );

    setAmount(500);
    setPurpose('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-emerald-200 border border-white/20 mb-2">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>Capital Preservation & Financial Discipline</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              🏡 Family Drawings & Personal Finance Isolation
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-emerald-100 max-w-xl">
              Keep personal and household drawings separate from shop expenses. Protect your working capital so the shop never runs out of paper, toner, or gas stock!
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/20 text-right">
            <span className="text-[10px] uppercase font-bold text-emerald-300">Retained Business Capital</span>
            <p className="text-xl font-black">{formatMoney(stats.remainingRetainedCapital)}</p>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Family Drawings (This Month)</span>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatMoney(stats.totalThisMonth)}
          </h4>
          <span className="text-xs text-slate-500">Withdrawn for household needs</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">All-Time Family Drawings</span>
          <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {formatMoney(stats.totalAllTime)}
          </h4>
          <span className="text-xs text-slate-500">Total owner distributions</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Safe Working Capital Balance</span>
          <h4 className={`text-2xl font-black mt-1 ${stats.remainingRetainedCapital >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatMoney(stats.remainingRetainedCapital)}
          </h4>
          <span className="text-xs text-slate-500">Safe cash left to restock inventory</span>
        </div>
      </div>

      {/* Record Family Withdrawal Form */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-600" />
          <span>Record Personal / Family Cash Withdrawal</span>
        </h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Category / Purpose</label>
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              >
                {recipientCategories.map((rc) => (
                  <option key={rc} value={rc}>
                    {rc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount Withdrawn (KES)</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Specific Purpose / Notes</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Bought groceries & vegetables"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Record Family Drawing ({formatMoney(amount)})</span>
            </button>
          </div>
        </form>
      </div>

      {/* Family Drawings Ledger Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Family Drawings History</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Details / Purpose</th>
                <th className="py-3 px-3 text-right">Amount Withdrawn</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {familyExpenses.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-3 text-slate-500">{f.date}</td>
                  <td className="py-3 px-3">
                    <span className="inline-block px-2.5 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      {f.name}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-medium text-slate-900 dark:text-white">{f.note || f.name}</td>
                  <td className="py-3 px-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-400">
                    -{formatMoney(f.amount)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {hasRole('admin') && (
                      <button
                        onClick={() => {
                          if (confirm('Delete family drawing record?')) {
                            deleteFamilyExpense(f.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                        title="Delete record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {familyExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No family drawings recorded. All business profits remain safe in the shop account!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
