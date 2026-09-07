import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Fuel,
  TrendingUp,
  Receipt,
  User,
  Phone,
  Printer,
  Share2,
  Trash2,
  DollarSign,
  Building,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { GasTransaction, PaymentMethod } from '../../types/pos';
import { DeleteTransactionModal } from '../common/DeleteTransactionModal';

interface GasViewProps {
  onOpenGasReceipt: (gas: GasTransaction) => void;
}

export const GasView: React.FC<GasViewProps> = ({ onOpenGasReceipt }) => {
  const {
    profile,
    gasTransactions,
    recordGasRefill,
    deleteGasRefill,
    hasRole,
    formatMoney,
  } = usePOS();

  // Form State
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [gasBrand, setGasBrand] = useState('Total Gas');
  const [gasSize, setGasSize] = useState<'3 KG' | '6 KG' | '13 KG' | '22 KG' | 'Other'>('6 KG');
  const [qty, setQty] = useState<number>(1);
  const [price, setPrice] = useState<number>(950);
  const [cost, setCost] = useState<number>(780);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [gasToDelete, setGasToDelete] = useState<GasTransaction | null>(null);

  // Auto price suggestions based on cylinder size
  const handleSizeChange = (size: '3 KG' | '6 KG' | '13 KG' | '22 KG' | 'Other') => {
    setGasSize(size);
    if (size === '3 KG') {
      setPrice(550);
      setCost(420);
    } else if (size === '6 KG') {
      setPrice(950);
      setCost(780);
    } else if (size === '13 KG') {
      setPrice(2600);
      setCost(2150);
    } else if (size === '22 KG') {
      setPrice(4400);
      setCost(3700);
    }
  };

  // Calculations
  const totalSales = Number(price || 0) * Number(qty || 1);
  const totalCost = Number(cost || 0) * Number(qty || 1);
  const totalProfit = totalSales - totalCost;

  // Gas KPI stats
  const stats = useMemo(() => {
    const totalRevenue = gasTransactions.reduce((sum, g) => sum + g.total, 0);
    const totalRefillCost = gasTransactions.reduce((sum, g) => sum + g.cost * g.qty, 0);
    const totalProfit = totalRevenue - totalRefillCost;
    const cylindersCount = gasTransactions.reduce((sum, g) => sum + g.qty, 0);
    return { totalRevenue, totalProfit, cylindersCount };
  }, [gasTransactions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0 || price <= 0) {
      alert('Please enter valid gas quantity and refill price.');
      return;
    }

    const saved = recordGasRefill({
      customer: customerName.trim() || 'Walk-in Customer',
      phone: customerPhone.trim(),
      brand: gasBrand.trim() || 'Unspecified Brand',
      size: gasSize,
      qty,
      price,
      cost,
      total: totalSales,
      profit: totalProfit,
      paid: paymentMethod === 'Credit / Debt' ? 0 : totalSales,
      outstanding: paymentMethod === 'Credit / Debt' ? totalSales : 0,
      payment: paymentMethod,
    });

    if (saved) {
      onOpenGasReceipt(saved);
    }

    // Reset customer name & phone
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white mb-2">
              <Fuel className="w-3.5 h-3.5" />
              <span>Independent Revenue & Profit Stream</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              ⛽ Gas Refill & Sales Station
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-amber-100 max-w-xl">
              Gas cylinder sales, refills, and refill costs are tracked independently from Cyber services to ensure pristine profit accounting.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-right">
              <span className="text-[10px] uppercase font-bold text-amber-200">Total Cylinders Refilled</span>
              <p className="text-xl font-black">{stats.cylindersCount} Units</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Gas Sales Volume</span>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatMoney(stats.totalRevenue)}
          </h4>
          <span className="text-xs text-slate-500">{gasTransactions.length} transactions</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Gas Profit</span>
          <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(stats.totalProfit)}
          </h4>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Net profit after refill costs</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Cylinders Dispensed</span>
          <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats.cylindersCount}
          </h4>
          <span className="text-xs text-slate-500">3KG, 6KG, 13KG & 22KG</span>
        </div>
      </div>

      {/* Gas Record Form */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4">
          Record Gas Cylinder Refill
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Phone / WhatsApp</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="07xxxxxxxx"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Gas Brand</label>
              <input
                type="text"
                value={gasBrand}
                onChange={(e) => setGasBrand(e.target.value)}
                placeholder="e.g. Total, K-Gas, ProGas"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cylinder Size</label>
              <select
                value={gasSize}
                onChange={(e) => handleSizeChange(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              >
                <option value="3 KG">3 KG Cylinder</option>
                <option value="6 KG">6 KG Cylinder</option>
                <option value="13 KG">13 KG Cylinder</option>
                <option value="22 KG">22 KG Cylinder</option>
                <option value="Other">Other Size</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Refill Selling Price (KES)</label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Refill Cost (Wholesale KES)</label>
              <input
                type="number"
                min="0"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
              >
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Credit / Debt">Credit / Debt</option>
              </select>
            </div>
          </div>

          {/* Real-time Calculation Display */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Total Sales Charge:</span>
              <p className="text-base font-black text-slate-900 dark:text-white font-mono">{formatMoney(totalSales)}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Wholesale Purchase Cost:</span>
              <p className="text-base font-bold text-slate-900 dark:text-white font-mono">{formatMoney(totalCost)}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Net Gas Profit:</span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">+{formatMoney(totalProfit)}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-extrabold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/25 transition-transform active:scale-95"
            >
              <Fuel className="w-4 h-4" />
              <span>Record Gas Refill ({formatMoney(totalSales)})</span>
            </button>
          </div>
        </form>
      </div>

      {/* Gas Ledger History Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Gas Refill Transactions</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Receipt</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Brand & Size</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th className="py-3 px-3 text-right">Selling Total</th>
                <th className="py-3 px-3 text-right">Profit</th>
                <th className="py-3 px-3">Payment</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {gasTransactions.map((gas) => (
                <tr key={gas.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{gas.receipt}</td>
                  <td className="py-3 px-3 text-slate-500">{new Date(gas.date).toLocaleDateString()}</td>
                  <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                    {gas.customer}
                    {gas.phone && <span className="block text-[11px] text-slate-400">{gas.phone}</span>}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{gas.brand}</span>
                    <span className="text-[11px] text-amber-600 block">{gas.size}</span>
                  </td>
                  <td className="py-3 px-3 text-center font-bold">{gas.qty}</td>
                  <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                    {formatMoney(gas.total)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(gas.profit)}
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        gas.payment === 'Credit / Debt'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {gas.payment}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenGasReceipt(gas)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-[11px]"
                        title="Print receipt"
                      >
                        Receipt
                      </button>
                      <button
                        onClick={() => setGasToDelete(gas)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        title="Delete record (Requires password)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {gasTransactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No gas refill records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password-Protected Delete Gas Transaction Modal */}
      <DeleteTransactionModal
        isOpen={!!gasToDelete}
        transaction={gasToDelete}
        transactionType="gas"
        onClose={() => setGasToDelete(null)}
      />
    </div>
  );
};
