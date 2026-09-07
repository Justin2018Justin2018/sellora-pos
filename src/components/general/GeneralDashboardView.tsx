import React, { useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  TrendingUp,
  ShoppingCart,
  Boxes,
  Users,
  CreditCard,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  DollarSign,
  PackageCheck,
  Building2,
  Sparkles
} from 'lucide-react';

interface GeneralDashboardViewProps {
  onNavigateTab: (tab: string) => void;
}

export const GeneralDashboardView: React.FC<GeneralDashboardViewProps> = ({ onNavigateTab }) => {
  const {
    businessMode,
    generalProducts,
    generalSales,
    generalPurchases,
    generalSuppliers,
    expenses,
    debts,
    customers,
    formatMoney,
  } = usePOS();

  const businessConfig = useMemo(() => {
    switch (businessMode) {
      case 'cyber':
        return {
          title: 'Cyber & Printing Services Dashboard',
          subtitle: 'Manage printing papers, laminating pouches, spiral binding, and digital accessories.',
          badge: 'Cyber & Services Active',
          gradient: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-700',
          btnBg: 'bg-white text-blue-900 hover:bg-blue-50',
          btnIcon: 'text-blue-600',
        };
      case 'gas':
        return {
          title: 'Gas Station & Fuel Hub Dashboard',
          subtitle: 'Manage LPG gas refills, super petrol, lubricants, and station burner accessories.',
          badge: 'Gas & Fuel Station Active',
          gradient: 'bg-gradient-to-r from-amber-600 via-orange-600 to-yellow-700',
          btnBg: 'bg-white text-amber-900 hover:bg-amber-50',
          btnIcon: 'text-amber-600',
        };
      case 'electronics':
        return {
          title: 'Electronics & Tech Hub Dashboard',
          subtitle: 'Manage smartphones, chargers, power banks, audio gear, and tech accessories.',
          badge: 'Electronics Hub Active',
          gradient: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-700',
          btnBg: 'bg-white text-purple-900 hover:bg-purple-50',
          btnIcon: 'text-purple-600',
        };
      default:
        return {
          title: 'General Retail Shop Dashboard',
          subtitle: 'Real-time retail inventory, automated stock deduction, profit tracking, and customer credit management.',
          badge: 'General Retail POS Active',
          gradient: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700',
          btnBg: 'bg-white text-emerald-900 hover:bg-emerald-50',
          btnIcon: 'text-emerald-600',
        };
    }
  }, [businessMode]);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Calculate Today's Sales & Profit
  const todaySalesList = useMemo(() => {
    return generalSales.filter((s) => s.date.slice(0, 10) === todayStr && s.status !== 'cancelled');
  }, [generalSales, todayStr]);

  const todaySalesTotal = todaySalesList.reduce((sum, s) => sum + s.total, 0);
  const todayProfitTotal = todaySalesList.reduce((sum, s) => sum + (s.profit || 0), 0);

  // Monthly Sales & Profit
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const monthlySalesList = useMemo(() => {
    return generalSales.filter((s) => s.date.slice(0, 7) === currentMonthPrefix && s.status !== 'cancelled');
  }, [generalSales, currentMonthPrefix]);

  const monthlySalesTotal = monthlySalesList.reduce((sum, s) => sum + s.total, 0);
  const monthlyProfitTotal = monthlySalesList.reduce((sum, s) => sum + (s.profit || 0), 0);

  // Expenses total
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Net Profit (Monthly profit - expenses or total profit - expenses)
  const netProfit = monthlyProfitTotal - totalExpenses;

  // Stock Value
  const totalStockValue = generalProducts.reduce((sum, p) => sum + (p.quantity * p.buyingPrice), 0);

  // Low stock items
  const lowStockItems = generalProducts.filter((p) => p.quantity <= p.minStock);

  // Outstanding Debts
  const outstandingDebts = debts
    .filter((d) => (d.original - d.paid) > 0)
    .reduce((sum, d) => sum + (d.original - d.paid), 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className={`${businessConfig.gradient} rounded-2xl p-6 text-white shadow-xl relative overflow-hidden`}>
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold mb-2 backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{businessConfig.badge}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {businessConfig.title}
            </h1>
            <p className="text-white/90 text-xs sm:text-sm mt-1 max-w-xl">
              {businessConfig.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateTab('sale')}
              className={`px-5 py-2.5 rounded-xl ${businessConfig.btnBg} font-bold text-sm shadow-lg flex items-center gap-2 transition-transform active:scale-95`}
            >
              <ShoppingCart className={`w-4 h-4 ${businessConfig.btnIcon}`} />
              <span>New Sale</span>
            </button>
          </div>
        </div>
      </div>

      {/* Low Stock Alert Bar */}
      {lowStockItems.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 rounded-xl">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold">
                Low Stock Warning: {lowStockItems.length} Product{lowStockItems.length === 1 ? '' : 's'} Reached Minimum Level!
              </h4>
              <p className="text-xs opacity-90">
                Items like <span className="font-semibold">{lowStockItems.slice(0, 3).map(p => p.name).join(', ')}</span> need restocking urgently.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('stock')}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shrink-0 transition-colors"
          >
            View Stock
          </button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Sales */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Today's Sales
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {formatMoney(todaySalesTotal)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-bold text-emerald-600">{todaySalesList.length}</span> transactions today
            </p>
          </div>
        </div>

        {/* Today's Profit */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Today's Profit
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {formatMoney(todayProfitTotal)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Gross profit earned today
            </p>
          </div>
        </div>

        {/* Stock Inventory Value */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Stock Value (Buying)
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {formatMoney(totalStockValue)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="font-bold text-purple-600">{generalProducts.length}</span> active catalog items
            </p>
          </div>
        </div>

        {/* Outstanding Debts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Customer Debts
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              {formatMoney(outstandingDebts)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Outstanding credit balance
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Monthly Sales</span>
            <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">{formatMoney(monthlySalesTotal)}</h4>
          </div>
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Total Expenses</span>
            <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">{formatMoney(totalExpenses)}</h4>
          </div>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase">Estimated Net Profit</span>
            <h4 className="text-xl font-black text-emerald-600 mt-1">{formatMoney(netProfit)}</h4>
          </div>
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Cards */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          Quick Retail Operations
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigateTab('sale')}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-emerald-50/50 transition-all text-left group"
          >
            <ShoppingCart className="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform" />
            <h5 className="font-bold text-sm text-slate-900 dark:text-white">New Sale</h5>
            <p className="text-xs text-slate-500 mt-0.5">Fast retail checkout</p>
          </button>

          <button
            onClick={() => onNavigateTab('general_products')}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-blue-50/50 transition-all text-left group"
          >
            <PackageCheck className="w-6 h-6 text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
            <h5 className="font-bold text-sm text-slate-900 dark:text-white">Products</h5>
            <p className="text-xs text-slate-500 mt-0.5">Manage item catalog</p>
          </button>

          <button
            onClick={() => onNavigateTab('general_purchases')}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-purple-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-purple-50/50 transition-all text-left group"
          >
            <Boxes className="w-6 h-6 text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
            <h5 className="font-bold text-sm text-slate-900 dark:text-white">Stock Purchases</h5>
            <p className="text-xs text-slate-500 mt-0.5">Restock from suppliers</p>
          </button>

          <button
            onClick={() => onNavigateTab('general_suppliers')}
            className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-amber-50/50 transition-all text-left group"
          >
            <Building2 className="w-6 h-6 text-amber-600 mb-2 group-hover:scale-110 transition-transform" />
            <h5 className="font-bold text-sm text-slate-900 dark:text-white">Suppliers</h5>
            <p className="text-xs text-slate-500 mt-0.5">Distributor directory</p>
          </button>
        </div>
      </div>
    </div>
  );
};
