import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  ShoppingCart,
  Coins,
  AlertTriangle,
  Clock,
  Printer,
  Copy,
  Camera,
  FileText,
  FileCheck,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Sparkles,
  ChevronRight,
  CreditCard,
  Building,
  Target,
  FileSpreadsheet
} from 'lucide-react';
import { Transaction } from '../../types/pos';

interface DashboardViewProps {
  onQuickServiceSelect: (serviceName: string) => void;
  onOpenNewSale: () => void;
  onOpenDocRequest: () => void;
  onSelectTransaction: (tx: Transaction) => void;
}

type PeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'all';

export const DashboardView: React.FC<DashboardViewProps> = ({
  onQuickServiceSelect,
  onOpenNewSale,
  onOpenDocRequest,
  onSelectTransaction,
}) => {
  const {
    profile,
    transactions,
    expenses,
    gasTransactions,
    debts,
    stock,
    stockRemaining,
    lowStockItems,
    formatMoney,
    currentUser,
  } = usePOS();

  const [period, setPeriod] = useState<PeriodFilter>('today');

  // Date range logic
  const dateRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (period === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'week') {
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'year') {
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === 'all') {
      return null;
    }

    return { start, end };
  }, [period]);

  // Filtered transactions (excluding credit until paid)
  const filteredSales = useMemo(() => {
    return transactions.filter((t) => {
      if (t.status === 'cancelled') return false;
      if (t.payment === 'Credit / Debt') return false; // Cash basis: unpaid debt not recognized
      if (!dateRange) return true;
      const d = new Date(t.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [transactions, dateRange]);

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!dateRange) return true;
      const d = new Date(e.date);
      return d >= dateRange.start && d <= dateRange.end;
    });
  }, [expenses, dateRange]);

  // Financial calculations
  const totalSales = useMemo(
    () => filteredSales.reduce((sum, t) => sum + t.total, 0),
    [filteredSales]
  );

  const totalMaterialCost = useMemo(
    () => filteredSales.reduce((sum, t) => sum + (t.materialCost || 0), 0),
    [filteredSales]
  );

  const totalExpensesAmt = useMemo(
    () => filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  const netProfit = useMemo(
    () => totalSales - totalMaterialCost - totalExpensesAmt,
    [totalSales, totalMaterialCost, totalExpensesAmt]
  );

  const profitMargin = useMemo(
    () => (totalSales > 0 ? ((netProfit / totalSales) * 100).toFixed(1) : '0.0'),
    [totalSales, netProfit]
  );

  const totalOutstandingDebt = useMemo(() => {
    return debts.reduce((sum, d) => sum + Math.max(0, d.original - d.paid), 0);
  }, [debts]);

  // Top Service Calculation
  const topServiceData = useMemo(() => {
    const counts: Record<string, { count: number; revenue: number }> = {};
    transactions.forEach((tx) => {
      if (tx.status === 'cancelled') return;
      if (!counts[tx.service]) {
        counts[tx.service] = { count: 0, revenue: 0 };
      }
      counts[tx.service].count += 1;
      counts[tx.service].revenue += tx.total;
    });

    const entries = Object.entries(counts);
    if (entries.length === 0) {
      return { name: 'KRA Returns & Services', count: 24, revenue: 14400 };
    }
    entries.sort((a, b) => b[1].revenue - a[1].revenue);
    return {
      name: entries[0][0],
      count: entries[0][1].count,
      revenue: entries[0][1].revenue,
    };
  }, [transactions]);

  // Inventory Health items
  const inventoryHealthItems = useMemo(() => {
    return stock.slice(0, 4).map((item) => {
      const rem = stockRemaining(item);
      const total = Math.max(item.openingStock + item.stockAdded, 1);
      const percent = Math.min(100, Math.max(5, Math.round((rem / total) * 100)));
      return {
        name: item.name,
        unit: item.unit,
        remaining: rem,
        percent,
        isLow: rem <= (item.reorderLevel ?? 10),
      };
    });
  }, [stock, stockRemaining]);

  // Daily Trend Chart
  const chartData = useMemo(() => {
    const days = 14;
    const data: Array<{ date: string; day: string; sales: number }> = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const target = new Date(now);
      target.setDate(target.getDate() - i);
      const dateKey = target.toISOString().slice(0, 10);
      const dayLabel = target.toLocaleDateString('en-US', { weekday: 'short' });

      let dayTotal = 0;
      transactions.forEach((t) => {
        if (t.status === 'cancelled') return;
        if (t.payment === 'Credit / Debt') return;
        if (t.date.startsWith(dateKey)) {
          dayTotal += t.total;
        }
      });

      data.push({
        date: dateKey,
        day: dayLabel,
        sales: dayTotal,
      });
    }
    const max = Math.max(...data.map((d) => d.sales), 100);
    return { data, max };
  }, [transactions]);

  // Popular quick services
  const popularServices = [
    { name: 'PRINTING', label: 'Printing', icon: Printer, price: 'KSh 10' },
    { name: 'PHOTOCOPY B & W', label: 'Photocopy B&W', icon: Copy, price: 'KSh 5' },
    { name: 'PASSPORT', label: 'Passport Photo', icon: Camera, price: 'KSh 25' },
    { name: 'LAMINATION', label: 'A4 Lamination', icon: FileCheck, price: 'KSh 50' },
    { name: 'CV/RESUME', label: 'CV / Resume', icon: FileText, price: 'KSh 50' },
    { name: 'K.R.A WITH EMAIL', label: 'KRA Pin & Email', icon: Globe, price: 'KSh 150' },
  ];

  return (
    <div className="space-y-6">
      {/* Signature Professional Polish 4-Metric Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Today's Revenue */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
              {period === 'today' ? "Today's Revenue" : 'Gross Revenue'}
            </p>
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white mt-1">
            {formatMoney(totalSales)}
          </p>
          <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
            {filteredSales.length} paid sales ({filteredSales.filter((s) => s.payment.includes('M-Pesa')).length} M-Pesa)
          </div>
        </div>

        {/* Daily Expenses */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
              Daily Expenses
            </p>
            <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {formatMoney(totalExpensesAmt)}
          </p>
          <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
            Rent, Power & Shop Supplies ({filteredExpenses.length} items)
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
              Net Profit
            </p>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(netProfit)}
          </p>
          <div className="mt-2 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full inline-block">
            Margin: {profitMargin}%
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-slate-400 uppercase mb-1 tracking-wider">
              Low Stock Alerts
            </p>
            <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-500 mt-1">
            {String(lowStockItems.length).padStart(2, '0')} Items
          </p>
          <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-bold underline cursor-pointer">
            {lowStockItems.length > 0 ? 'Restock required now' : 'All stock levels healthy'}
          </div>
        </div>
      </div>

      {/* Main 2-Column Section from Professional Polish Design */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Table of Recent Sales & Transactions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-800 dark:text-white text-base">
                  Recent Sales & Cyber Transactions
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Latest customer billing and service records
                </p>
              </div>

              {/* Period selector */}
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setPeriod('today')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    period === 'today'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => setPeriod('week')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    period === 'week'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setPeriod('month')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    period === 'month'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  Month
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Ref ID</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Customer / Service</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Method</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Amount</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800/60">
                  {transactions.slice(0, 6).map((tx) => {
                    const isCredit = tx.payment === 'Credit / Debt';
                    const isCancelled = tx.status === 'cancelled';
                    return (
                      <tr
                        key={tx.id}
                        onClick={() => onSelectTransaction(tx)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 font-mono text-slate-400 dark:text-slate-500 text-[11px]">
                          {tx.receipt ? `#${tx.receipt.split('-').slice(-2).join('-')}` : `#POS-${tx.id}`}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-700 dark:text-slate-200">{tx.service}</p>
                          <p className="text-[10px] text-slate-400">{tx.customer} • Qty: {tx.qty}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {tx.payment}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white font-mono">
                          {formatMoney(tx.total)}
                        </td>
                        <td className="px-4 py-3">
                          {isCancelled ? (
                            <span className="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                              VOID
                            </span>
                          ) : isCredit ? (
                            <span className="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                              CREDIT
                            </span>
                          ) : (
                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase">
                              COMPLETE
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                        No transactions recorded yet. Click "New Sale" to start billing.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Sales Trend (Last 14 Days) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Sales Trend (Last 14 Days)</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hover over bars to inspect daily revenue</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>Cash Basis</span>
              </div>
            </div>

            <div className="h-44 flex items-end justify-between gap-1.5 sm:gap-3 pt-4 border-b border-slate-100 dark:border-slate-800">
              {chartData.data.map((item, idx) => {
                const heightPercent = Math.max(8, Math.round((item.sales / chartData.max) * 100));
                const isToday = idx === chartData.data.length - 1;
                return (
                  <div key={item.date} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="relative w-full flex justify-center">
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                        <div className="bg-slate-900 text-white text-[11px] font-bold py-1 px-2 rounded-lg shadow-xl whitespace-nowrap">
                          {item.date}: {formatMoney(item.sales)}
                        </div>
                        <div className="w-2 h-1 bg-slate-900 rotate-45 -mt-0.5" />
                      </div>

                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 group-hover:brightness-110 ${
                          isToday
                            ? 'bg-blue-600 shadow-md shadow-blue-500/20'
                            : 'bg-slate-200 dark:bg-slate-800 hover:bg-blue-400'
                        }`}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                      {item.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Inventory Health & Dark Target Card */}
        <div className="space-y-6">
          {/* Inventory Health */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h2 className="font-bold text-slate-800 dark:text-white text-sm mb-4">
              Inventory Health
            </h2>
            <div className="space-y-4">
              {inventoryHealthItems.map((inv) => (
                <div key={inv.name}>
                  <div className="flex justify-between text-[10px] mb-1.5">
                    <span className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[150px]">
                      {inv.name}
                    </span>
                    <span className={`font-bold ${inv.isLow ? 'text-rose-500' : 'text-slate-800 dark:text-slate-200'}`}>
                      {inv.remaining} {inv.unit} Remaining
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${inv.percent}%` }}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        inv.percent <= 20
                          ? 'bg-rose-500'
                          : inv.percent <= 50
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>
              ))}

              {inventoryHealthItems.length === 0 && (
                <p className="text-xs text-slate-400">No inventory registered yet.</p>
              )}
            </div>
          </div>

          {/* Top Service Card (Signature #1E293B Dark Container) */}
          <div className="bg-[#1E293B] p-5 rounded-xl border border-slate-700/60 shadow-xl text-white">
            <h2 className="font-bold text-white text-sm mb-4">Top Service This Week</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400 shrink-0">
                <Printer className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white font-bold text-sm truncate">{topServiceData.name}</p>
                <p className="text-slate-400 text-[10px] mt-0.5">
                  {topServiceData.count} Transactions | {formatMoney(topServiceData.revenue)}
                </p>
              </div>
            </div>

            <button
              onClick={() => onQuickServiceSelect(topServiceData.name)}
              className="w-full bg-white text-slate-900 py-2 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Run Target Sale +
            </button>
          </div>

          {/* Fast Express Catalogue */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <h2 className="font-bold text-slate-800 dark:text-white text-sm mb-3">
              Fast Express Checkout
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {popularServices.slice(0, 4).map((srv) => {
                const Icon = srv.icon;
                return (
                  <button
                    key={srv.name}
                    onClick={() => onQuickServiceSelect(srv.name)}
                    className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:border-blue-200 transition-all text-left group"
                  >
                    <div className="w-7 h-7 rounded bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs mb-1.5 group-hover:scale-105 transition-transform">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                      {srv.label}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold">{srv.price}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
