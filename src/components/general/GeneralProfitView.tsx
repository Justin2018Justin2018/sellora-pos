import React, { useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { TrendingUp, DollarSign, Receipt, ShieldCheck } from 'lucide-react';

export const GeneralProfitView: React.FC = () => {
  const { generalSales, expenses, formatMoney } = usePOS();

  const totalSales = useMemo(() => {
    return generalSales
      .filter((s) => s.status !== 'cancelled')
      .reduce((sum, s) => sum + s.total, 0);
  }, [generalSales]);

  const totalGrossProfit = useMemo(() => {
    return generalSales
      .filter((s) => s.status !== 'cancelled')
      .reduce((sum, s) => sum + (s.profit || 0), 0);
  }, [generalSales]);

  const totalCOGS = totalSales - totalGrossProfit;

  const totalExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  const netProfit = totalGrossProfit - totalExpenses;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Profit & Financial Summary</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Detailed breakdown of gross revenue, cost of goods, overhead expenses, and true net earnings.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Gross Sales Revenue</span>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-2">{formatMoney(totalSales)}</h3>
          <p className="text-xs text-slate-500 mt-1">{generalSales.length} total retail transactions</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Cost of Goods Sold (COGS)</span>
          <h3 className="text-2xl font-black text-rose-600 mt-2">{formatMoney(totalCOGS)}</h3>
          <p className="text-xs text-slate-500 mt-1">Total buying cost of sold items</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">Gross Profit</span>
          <h3 className="text-2xl font-black text-blue-600 mt-2">{formatMoney(totalGrossProfit)}</h3>
          <p className="text-xs text-slate-500 mt-1">Selling Price minus Buying Price</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <span className="text-xs font-bold text-slate-400 uppercase">True Net Profit</span>
          <h3 className="text-2xl font-black text-emerald-600 mt-2">{formatMoney(netProfit)}</h3>
          <p className="text-xs text-slate-500 mt-1">Gross Profit minus Expenses</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-base">P&L Accounting Statement</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">Total Gross Sales</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatMoney(totalSales)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">Less Cost of Goods Sold (COGS)</span>
            <span className="font-bold text-rose-600">-{formatMoney(totalCOGS)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-slate-800 dark:text-slate-200">Gross Profit Margin</span>
            <span className="font-bold text-blue-600">{formatMoney(totalGrossProfit)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-600 dark:text-slate-400">Less Total Operating Expenses</span>
            <span className="font-bold text-rose-600">-{formatMoney(totalExpenses)}</span>
          </div>
          <div className="flex justify-between py-3 text-base font-black">
            <span className="text-slate-900 dark:text-white">Net Business Earnings</span>
            <span className="text-emerald-600">{formatMoney(netProfit)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
