import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  CreditCard,
  Search,
  Plus,
  Trash2,
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  Send,
  Calendar
} from 'lucide-react';
import { DebtRecord } from '../../types/pos';

export const DebtsView: React.FC = () => {
  const {
    debts,
    addDebt,
    recordDebtPayment,
    deleteDebt,
    profile,
    formatMoney,
    hasRole,
    addToast,
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'cleared'>('all');

  // Record New Debt Form State
  const [debtorName, setDebtorName] = useState('');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [debtItems, setDebtItems] = useState('Photocopy & Printing on credit');
  const [debtAmount, setDebtAmount] = useState<number>(100);
  const [debtDueDate, setDebtDueDate] = useState('');
  const [debtNotes, setDebtNotes] = useState('');

  // Payment Modal State
  const [payingDebt, setPayingDebt] = useState<DebtRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'M-Pesa'>('Cash');

  // Debt KPI calculations
  const stats = useMemo(() => {
    let totalOriginal = 0;
    let totalRecovered = 0;
    let totalOutstanding = 0;
    let activeDebtors = 0;

    debts.forEach((d) => {
      const remaining = Math.max(0, d.original - d.paid);
      totalOriginal += d.original;
      totalRecovered += d.paid;
      totalOutstanding += remaining;
      if (remaining > 0) activeDebtors++;
    });

    return { totalOriginal, totalRecovered, totalOutstanding, activeDebtors };
  }, [debts]);

  // Filtered debts
  const displayedDebts = useMemo(() => {
    return debts.filter((d) => {
      const q = searchQuery.toLowerCase().trim();
      if (q && ![d.name, d.phone, d.service, d.reason].some((v) => String(v || '').toLowerCase().includes(q))) {
        return false;
      }
      const remaining = Math.max(0, d.original - d.paid);
      if (statusFilter === 'unpaid') return remaining > 0;
      if (statusFilter === 'cleared') return remaining <= 0;
      return true;
    });
  }, [debts, searchQuery, statusFilter]);

  // Handle New Debt Record
  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debtorName.trim() || debtAmount <= 0) {
      addToast({ type: 'error', title: 'Invalid Debt Details', message: 'Name and amount are required.' });
      return;
    }

    addDebt({
      name: debtorName.trim(),
      phone: debtorPhone.trim(),
      service: debtItems.trim() || 'Credit Service',
      reason: debtNotes.trim() || 'Customer Credit Agreement',
      original: debtAmount,
      qty: 1,
      date: new Date().toISOString().slice(0, 10),
      kind: 'cyber',
    });

    setDebtorName('');
    setDebtorPhone('');
    setDebtAmount(100);
    setDebtNotes('');
    setDebtDueDate('');
  };

  // Handle Payment Submit
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDebt || paymentAmount <= 0) return;

    recordDebtPayment(payingDebt.id, paymentAmount);
    setPayingDebt(null);
    setPaymentAmount(0);
  };

  // WhatsApp reminder message
  const handleSendReminder = (d: DebtRecord) => {
    const remaining = Math.max(0, d.original - d.paid);
    let phone = (d.phone || '').replace(/\D/g, '');
    if (phone.startsWith('0')) phone = '254' + phone.slice(1);
    if (phone.startsWith('7') && phone.length === 9) phone = '254' + phone;

    const msg =
      `Habari ${d.name},\n\n` +
      `This is a polite reminder from *${profile.name}* regarding your outstanding balance of *${formatMoney(remaining)}* for ${d.service || d.reason}.\n\n` +
      `Kindly arrange payment via M-Pesa to *${profile.phone}* at your earliest convenience.\n\n` +
      `Asante sana for your continued support!`;

    const encoded = encodeURIComponent(msg);
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-800 via-orange-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-amber-200 border border-white/20 mb-2">
              <CreditCard className="w-3.5 h-3.5" />
              <span>Cash Flow & Debt Protection</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              💳 Customer Debt Register & Installments
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-amber-100 max-w-xl">
              Track credit sales, record partial installment payments, and send instant polite WhatsApp reminders with 1 click.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/10 border border-white/20 text-right">
            <span className="text-[10px] uppercase font-bold text-amber-300">Total Uncollected</span>
            <p className="text-2xl font-black">{formatMoney(stats.totalOutstanding)}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Uncollected Outstanding</span>
          <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {formatMoney(stats.totalOutstanding)}
          </h4>
          <span className="text-xs text-slate-500">{stats.activeDebtors} active debtors</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Debt Recovered</span>
          <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(stats.totalRecovered)}
          </h4>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Collected installments</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Credit Extended</span>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatMoney(stats.totalOriginal)}
          </h4>
          <span className="text-xs text-slate-500">{debts.length} total debt records</span>
        </div>
      </div>

      {/* Record New Credit/Debt Form */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-600" />
          <span>Record New Credit / Customer Debt</span>
        </h3>

        <form onSubmit={handleAddDebt} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Debtor Name</label>
              <input
                type="text"
                value={debtorName}
                onChange={(e) => setDebtorName(e.target.value)}
                placeholder="e.g. John Omondi"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Phone / WhatsApp</label>
              <input
                type="text"
                value={debtorPhone}
                onChange={(e) => setDebtorPhone(e.target.value)}
                placeholder="07xxxxxxxx"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Amount Owed (KES)</label>
              <input
                type="number"
                min="1"
                value={debtAmount}
                onChange={(e) => setDebtAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Due Date</label>
              <input
                type="date"
                value={debtDueDate}
                onChange={(e) => setDebtDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Services / Items Provided</label>
              <input
                type="text"
                value={debtItems}
                onChange={(e) => setDebtItems(e.target.value)}
                placeholder="e.g. 50 A4 Copies, 1 Spiral Binding"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Notes / Agreed Payment Terms</label>
              <input
                type="text"
                value={debtNotes}
                onChange={(e) => setDebtNotes(e.target.value)}
                placeholder="e.g. Promised to pay end month via M-Pesa"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Record Debt Entry</span>
            </button>
          </div>
        </form>
      </div>

      {/* Debts Register Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Debtor Ledger</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage balances and collect installments</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('unpaid')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'unpaid'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Outstanding ({stats.activeDebtors})
              </button>
              <button
                onClick={() => setStatusFilter('cleared')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  statusFilter === 'cleared'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Fully Paid
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search debtor..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Items / Services</th>
                <th className="py-3 px-3 text-right">Original Debt</th>
                <th className="py-3 px-3 text-right">Amount Paid</th>
                <th className="py-3 px-3 text-right">Remaining Balance</th>
                <th className="py-3 px-3">Due Date</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedDebts.map((d) => {
                const remaining = Math.max(0, d.original - d.paid);
                const isCleared = remaining <= 0;

                return (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3 text-slate-500">{new Date(d.date).toLocaleDateString()}</td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 dark:text-white">{d.name}</span>
                      {d.phone && <span className="block text-[11px] text-slate-400">{d.phone}</span>}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">{d.service || d.reason}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">{formatMoney(d.original)}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatMoney(d.paid)}</td>
                    <td className="py-3 px-3 text-right font-mono font-black text-sm">
                      <span className={isCleared ? 'text-slate-400 line-through' : 'text-amber-600 dark:text-amber-400'}>
                        {formatMoney(remaining)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{d.date}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isCleared
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                        }`}
                      >
                        {isCleared ? 'Cleared' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!isCleared && (
                          <>
                            <button
                              onClick={() => {
                                setPayingDebt(d);
                                setPaymentAmount(remaining);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                            >
                              Pay
                            </button>
                            <button
                              onClick={() => handleSendReminder(d)}
                              className="p-1 text-slate-500 hover:text-emerald-600 rounded-lg"
                              title="Send WhatsApp Reminder"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {hasRole('admin') && (
                          <button
                            onClick={() => {
                              if (confirm(`Delete debt record for ${d.name}?`)) {
                                deleteDebt(d.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                            title="Delete Debt"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {displayedDebts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No debts match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Debt Installment Modal */}
      {payingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
              Record Debt Payment
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Debtor: <strong className="text-slate-900 dark:text-white">{payingDebt.customer}</strong> • Remaining:{' '}
              <strong className="text-amber-600 font-mono">
                {formatMoney(Math.max(0, payingDebt.original - payingDebt.paid))}
              </strong>
            </p>

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Payment Amount (KES)</label>
                <input
                  type="number"
                  min="1"
                  max={Math.max(0, payingDebt.original - payingDebt.paid)}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-base font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                >
                  <option value="Cash">Cash</option>
                  <option value="M-Pesa">M-Pesa</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setPayingDebt(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                >
                  Confirm Payment ({formatMoney(paymentAmount)})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
