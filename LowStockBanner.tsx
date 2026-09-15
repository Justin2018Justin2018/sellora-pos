import React from 'react';
import { usePOS } from '../../context/POSContext';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface LowStockBannerProps {
  onNavigateToStock: () => void;
}

export const LowStockBanner: React.FC<LowStockBannerProps> = ({ onNavigateToStock }) => {
  const { lowStockItems, outOfStockItems, stockRemaining, profile } = usePOS();

  const allAlerts = [...outOfStockItems, ...lowStockItems];

  if (allAlerts.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <span>Low Inventory Alert ({allAlerts.length} items need attention)</span>
            </h3>
            <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5 leading-relaxed">
              {allAlerts.slice(0, 3).map((item, idx) => {
                const rem = stockRemaining(item);
                const isOut = rem <= 0;
                return (
                  <span key={item.name}>
                    {idx > 0 && ' • '}
                    <strong className={isOut ? 'text-rose-600 dark:text-rose-400 font-bold' : 'font-semibold'}>
                      {item.name}: {rem} {item.unit}
                    </strong>
                    {isOut ? ' (Out of stock)' : ` (Reorder at ${item.reorderLevel ?? profile.lowStockThresholdDefault})`}
                  </span>
                );
              })}
              {allAlerts.length > 3 && ` and ${allAlerts.length - 3} more...`}
            </p>
          </div>
        </div>

        <button
          onClick={onNavigateToStock}
          className="inline-flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-transform active:scale-95 shrink-0"
        >
          <span>Restock Inventory</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
