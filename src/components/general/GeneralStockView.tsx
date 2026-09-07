import React, { useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import { Boxes, AlertTriangle, Package, TrendingUp } from 'lucide-react';

export const GeneralStockView: React.FC = () => {
  const { generalProducts, formatMoney } = usePOS();

  const lowStockList = useMemo(() => {
    return generalProducts.filter((p) => p.quantity <= p.minStock);
  }, [generalProducts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            General Shop Stock & Inventory
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Monitor real-time stock balances, valuations, and low-stock thresholds.
          </p>
        </div>
      </div>

      {lowStockList.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-2xl p-4 text-rose-900 dark:text-rose-200">
          <div className="flex items-center gap-2 font-bold text-sm mb-1">
            <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse" />
            <span>{lowStockList.length} Items Require Immediate Restocking</span>
          </div>
          <p className="text-xs opacity-90">
            Stock quantities for these items have dropped at or below their reorder levels.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Unit</th>
                <th className="py-3 px-4">Buying Price</th>
                <th className="py-3 px-4">Selling Price</th>
                <th className="py-3 px-4">In Stock Qty</th>
                <th className="py-3 px-4">Total Buying Value</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
              {generalProducts.map((p) => {
                const isLow = p.quantity <= p.minStock;
                const totalVal = p.quantity * p.buyingPrice;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{p.name}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{p.category}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">{p.unit}</td>
                    <td className="py-3.5 px-4 font-medium">{formatMoney(p.buyingPrice)}</td>
                    <td className="py-3.5 px-4 font-medium text-emerald-600">{formatMoney(p.sellingPrice)}</td>
                    <td className="py-3.5 px-4 font-black">{p.quantity}</td>
                    <td className="py-3.5 px-4 font-semibold">{formatMoney(totalVal)}</td>
                    <td className="py-3.5 px-4">
                      {isLow ? (
                        <span className="px-2.5 py-1 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 text-xs font-bold">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                          Healthy
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
