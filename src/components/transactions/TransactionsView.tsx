import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  ReceiptText,
  Search,
  Printer,
  Share2,
  Trash2,
  Ban,
  FileSpreadsheet,
  Coins,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar
} from 'lucide-react';
import { Transaction } from '../../types/pos';
import { DeleteTransactionModal } from '../common/DeleteTransactionModal';
import { generalSaleToTransaction } from '../../utils/generalSaleAdapter';
import { getRevenueStreams } from '../../data/reportStreams';

interface TransactionsViewProps {
  onOpenReceipt: (tx: Transaction) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ onOpenReceipt }) => {
  const {
    businessMode,
    transactions,
    generalSales,
    deleteTransaction,
    cancelTransaction,
    formatMoney,
    hasRole,
    profile,
  } = usePOS();

  // Cyber is the only mode that sells through the service ledger. Every other
  // business type sells through the product POS, so read its sales instead of
  // showing an empty cyber ledger.
  const isServiceMode = businessMode === 'cyber';
  const wording = useMemo(() => {
    const general = getRevenueStreams(businessMode).find((st) => st.key === 'general');
    return {
      title: isServiceMode ? 'Sales & Transaction History' : `${general?.tabLabel || 'Sales'} History`,
      unit: isServiceMode ? 'sales' : general?.unitLabel || 'sales',
      costLabel: isServiceMode ? 'Material Cost Deducted' : 'Cost of Goods Sold',
    };
  }, [businessMode, isServiceMode]);

  const sourceTransactions = useMemo(
    () => (isServiceMode ? transactions : generalSales.map(generalSaleToTransaction)),
    [isServiceMode, transactions, generalSales]
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);

  // Filtered transactions
  const filtered = useMemo(() => {
    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);

    return sourceTransactions.filter((t) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      if (
        q &&
        ![t.receipt, t.customer, t.service, t.phone, t.staff].some((v) =>
          String(v || '').toLowerCase().includes(q)
        )
      ) {
        return false;
      }

      // Payment filter
      if (paymentFilter !== 'all' && t.payment !== paymentFilter) return false;

      // Period filter
      if (periodFilter === 'today' && t.date.slice(0, 10) !== todayKey) return false;
      if (periodFilter === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (new Date(t.date) < weekAgo) return false;
      }
      if (periodFilter === 'month') {
        if (t.date.slice(0, 7) !== now.toISOString().slice(0, 7)) return false;
      }

      return true;
    });
  }, [sourceTransactions, searchQuery, paymentFilter, periodFilter]);

  // Aggregate stats
  const totals = useMemo(() => {
    let sales = 0;
    let material = 0;
    let profit = 0;

    filtered.forEach((t) => {
      if (t.status === 'cancelled') return;
      sales += Number(t.total || 0);
      material += Number(t.materialTotal || 0);
      profit += Number(t.profit || 0);
    });

    return { sales, material, profit };
  }, [filtered]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Receipt',
      'Date',
      'Customer',
      'Phone',
      isServiceMode ? 'Services' : 'Items',
      'Total (KES)',
      isServiceMode ? 'Material Cost (KES)' : 'Cost of Goods (KES)',
      'Profit (KES)',
      'Payment Method',
      'Status',
      'Staff',
    ];

    const rows = filtered.map((t) => [
      t.receipt,
      t.date,
      `"${t.customer}"`,
      `"${t.phone || ''}"`,
      `"${t.service}"`,
      t.total,
      t.materialTotal,
      t.profit,
      t.payment,
      t.status || 'completed',
      `"${t.staff}"`,
    ].join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `Transactions_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-blue-200 border border-white/20 mb-2">
              <ReceiptText className="w-3.5 h-3.5" />
              <span>Audit Trail & Sales Ledger</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              📋 {wording.title}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
              Inspect past orders, reprint customer invoices, resend WhatsApp receipts, and verify cashier audit logs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filtered KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Filtered Sales Volume</span>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatMoney(totals.sales)}
          </h4>
          <span className="text-xs text-slate-500">{filtered.length} matched {wording.unit}</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">{wording.costLabel}</span>
          <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {formatMoney(totals.material)}
          </h4>
          <span className="text-xs text-slate-500">Cost of goods sold</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Realized Net Profit</span>
          <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            +{formatMoney(totals.profit)}
          </h4>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">After materials</span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Transaction Logs</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Click any row to view & reprint receipt</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Period Filter */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
              <button
                onClick={() => setPeriodFilter('today')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  periodFilter === 'today'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setPeriodFilter('week')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  periodFilter === 'week'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setPeriodFilter('month')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  periodFilter === 'month'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                This Month
              </button>
              <button
                onClick={() => setPeriodFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  periodFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All
              </button>
            </div>

            {/* Payment Filter */}
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Payments</option>
              <option value="Cash">Cash</option>
              <option value="M-Pesa">M-Pesa</option>
              <option value="Card">Card</option>
              <option value="Bank">Bank</option>
              <option value="Credit / Debt">Credit / Debt</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search receipt, customer..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Receipt No</th>
                <th className="py-3 px-3">Date & Time</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Services / Items</th>
                <th className="py-3 px-3 text-right">Total (KES)</th>
                <th className="py-3 px-3 text-right">Material</th>
                <th className="py-3 px-3 text-right">Profit</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Cashier</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((t) => {
                const isCancelled = t.status === 'cancelled';
                return (
                  <tr
                    key={t.id}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                      isCancelled ? 'opacity-50 bg-rose-50/30 dark:bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{t.receipt}</td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(t.date).toLocaleDateString()} {new Date(t.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 dark:text-white">{t.customer}</span>
                      {t.phone && <span className="block text-[11px] text-slate-400">{t.phone}</span>}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">{t.service}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                      {formatMoney(t.total)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">{formatMoney(t.materialTotal)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatMoney(t.profit)}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.payment === 'Credit / Debt'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {t.payment}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isCancelled
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        }`}
                      >
                        {isCancelled ? 'Voided' : 'Completed'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{t.staff}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onOpenReceipt(t)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 font-bold text-[11px]"
                          title="Open Receipt"
                        >
                          Receipt
                        </button>
                        {isServiceMode && hasRole('admin') && !isCancelled && (
                          <button
                            onClick={() => {
                              const reason = prompt('Reason for voiding/cancelling transaction?');
                              if (reason) cancelTransaction(t.id, reason);
                            }}
                            className="p-1 text-slate-400 hover:text-amber-600 rounded-lg"
                            title="Void Transaction"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setTransactionToDelete(t)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          title="Delete Transaction (Requires Password)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No transactions found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password-Protected Delete Transaction Modal */}
      <DeleteTransactionModal
        isOpen={!!transactionToDelete}
        transaction={transactionToDelete}
        transactionType={isServiceMode ? 'cyber' : 'general'}
        onClose={() => setTransactionToDelete(null)}
      />
    </div>
  );
};
