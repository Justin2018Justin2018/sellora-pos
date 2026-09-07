import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Phone,
  User,
  MapPin,
  FileCheck,
  CreditCard,
  Coins,
  Send,
  Sparkles,
  AlertCircle,
  Clock,
  RotateCcw,
  Boxes,
  DollarSign,
  CheckCircle2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PaymentMethod, ServiceLineItem, Transaction } from '../../types/pos';

interface SaleViewProps {
  initialService?: string;
  onSaleCompleted: (tx: Transaction) => void;
}

export const SaleView: React.FC<SaleViewProps> = ({ initialService, onSaleCompleted }) => {
  const {
    services,
    stock,
    stockRemaining,
    recordCyberSale,
    customers,
    formatMoney,
    simulateStkPush,
    addToast,
    profile,
    taxRules,
  } = usePOS();

  // Customer State
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerIdNumber, setCustomerIdNumber] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  // Cart Rows
  const [cartRows, setCartRows] = useState<
    Array<{
      id: string;
      serviceName: string;
      qty: number;
      price: number;
      material: number;
    }>
  >([]);

  // Tax State
  const defaultTaxRule = (taxRules && taxRules.find((r) => r.isDefault && r.active)) || (taxRules && taxRules[0]);
  const [selectedTaxRuleId, setSelectedTaxRuleId] = useState<string>(() => (defaultTaxRule ? defaultTaxRule.id : 'default'));
  const [isTaxExempt, setIsTaxExempt] = useState(false);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [isStkPushing, setIsStkPushing] = useState(false);
  const [mpesaReceiptCode, setMpesaReceiptCode] = useState('');

  // Initialize with initial service or first service
  useEffect(() => {
    if (cartRows.length === 0) {
      const defaultSrv = initialService
        ? services.find((s) => s.name.toUpperCase() === initialService.toUpperCase()) || services[0]
        : services[0];

      if (defaultSrv) {
        setCartRows([
          {
            id: `row_${Date.now()}`,
            serviceName: defaultSrv.name,
            qty: 1,
            price: defaultSrv.price,
            material: defaultSrv.material,
          },
        ]);
      }
    }
  }, [initialService, services]);

  // Update row details
  const updateRow = (id: string, updates: Partial<{ serviceName: string; qty: number; price: number; material: number }>) => {
    setCartRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const updated = { ...row, ...updates };
          if (updates.serviceName) {
            const srv = services.find((s) => s.name === updates.serviceName);
            if (srv) {
              updated.price = srv.price;
              updated.material = srv.material;
            }
          }
          return updated;
        }
        return row;
      })
    );
  };

  const addRow = (serviceName?: string) => {
    const srv = serviceName
      ? services.find((s) => s.name === serviceName) || services[0]
      : services[0];

    if (!srv) return;

    setCartRows((prev) => [
      ...prev,
      {
        id: `row_${Date.now()}_${Math.random()}`,
        serviceName: srv.name,
        qty: 1,
        price: srv.price,
        material: srv.material,
      },
    ]);
  };

  const removeRow = (id: string) => {
    if (cartRows.length <= 1) {
      addToast({ type: 'warning', title: 'At least one service is required' });
      return;
    }
    setCartRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Cart calculations with VAT and Tax rules
  const activeTaxRule = isTaxExempt
    ? null
    : (taxRules && taxRules.find((r) => r.id === selectedTaxRuleId && r.active)) || defaultTaxRule;

  const taxEnabled = Boolean(profile.enableTax && !isTaxExempt && activeTaxRule && activeTaxRule.rate > 0);
  const taxRate = taxEnabled && activeTaxRule ? activeTaxRule.rate : 0;
  const taxMode = activeTaxRule ? activeTaxRule.type : (profile.taxCalculationMode || 'inclusive');
  const taxName = activeTaxRule ? activeTaxRule.name : (profile.taxName || 'VAT');

  const totals = useMemo(() => {
    let subtotal = 0;
    let materialCost = 0;

    cartRows.forEach((row) => {
      const lineTotal = Number(row.price || 0) * Number(row.qty || 1);
      const lineMat = Number(row.material || 0) * Number(row.qty || 1);
      subtotal += lineTotal;
      materialCost += lineMat;
    });

    let total = subtotal;
    let taxAmount = 0;
    let netSubtotal = subtotal;

    if (taxEnabled && taxRate > 0) {
      if (taxMode === 'exclusive') {
        taxAmount = subtotal * (taxRate / 100);
        total = subtotal + taxAmount;
        netSubtotal = subtotal;
      } else {
        // Inclusive
        netSubtotal = subtotal / (1 + taxRate / 100);
        taxAmount = subtotal - netSubtotal;
        total = subtotal;
      }
    }

    const profit = total - materialCost;
    const change = Math.max(0, (amountPaid || 0) - total);

    return {
      subtotal,
      total,
      materialCost,
      profit,
      change,
      taxAmount,
      netSubtotal,
      taxRate,
      taxMode,
      taxName,
    };
  }, [cartRows, amountPaid, taxEnabled, taxRate, taxMode, taxName]);

  // Sync default paid amount when total changes
  useEffect(() => {
    if (paymentMethod !== 'Credit / Debt') {
      setAmountPaid(totals.total);
    }
  }, [totals.total, paymentMethod]);

  // Customer directory selection
  const handleSelectCustomer = (phone: string) => {
    const c = customers.find((cust) => cust.phone === phone);
    if (c) {
      setCustomerName(c.name);
      setCustomerPhone(c.phone);
      if (c.address) setCustomerAddress(c.address);
      if (c.idNumber) setCustomerIdNumber(c.idNumber);
    }
  };

  // Trigger simulated M-Pesa STK Push
  const handleTriggerStkPush = async () => {
    if (!customerPhone) {
      addToast({ type: 'warning', title: 'Phone Required', message: 'Enter customer M-Pesa phone number first.' });
      return;
    }
    setIsStkPushing(true);
    try {
      const res = await simulateStkPush(customerPhone, totals.total, `${profile.name || 'Sellora'} Sale`);
      if (res.success) {
        setPaymentMethod('M-Pesa');
        setAmountPaid(totals.total);
        if (res.mpesaReceipt) setMpesaReceiptCode(res.mpesaReceipt);
        addToast({
          type: 'success',
          title: 'M-Pesa Confirmed!',
          message: `Receipt: ${res.mpesaReceipt}. Payment of ${formatMoney(totals.total)} received.`,
        });
      }
    } catch (e: any) {
      addToast({ type: 'error', title: 'STK Push Failed', message: e.message });
    } finally {
      setIsStkPushing(false);
    }
  };

  // Submit Sale Handler
  const handleCompleteSale = () => {
    if (cartRows.length === 0) {
      addToast({ type: 'error', title: 'Empty Sale', message: 'Add at least one service.' });
      return;
    }

    if (paymentMethod !== 'Credit / Debt' && amountPaid < totals.total) {
      addToast({
        type: 'error',
        title: 'Insufficient Payment',
        message: `Amount paid (${formatMoney(amountPaid)}) is less than total (${formatMoney(totals.total)}).`,
      });
      return;
    }

    // Build line items & verify stock availability
    const lineItems: ServiceLineItem[] = [];
    const stockDeductionMap: Record<string, number> = {};

    for (const row of cartRows) {
      const srv = services.find((s) => s.name === row.serviceName);
      let stockUsed = null;

      if (srv && srv.deductStock && srv.stockItem) {
        const itemKey = srv.stockItem.trim().toUpperCase();
        const requiredQty = (Number(srv.stockQty) || 1) * row.qty;
        stockDeductionMap[itemKey] = (stockDeductionMap[itemKey] || 0) + requiredQty;
        // Note: srv.deductLocation is intentionally not carried onto stockUsed -
        // ServiceLineItem.stockUsed is just { name, qty } for stock-deduction
        // bookkeeping. Location is already available on the service record
        // itself (see ServicesView) wherever it needs to be displayed.
        stockUsed = { name: srv.stockItem, qty: requiredQty };
      }

      lineItems.push({
        service: row.serviceName,
        qty: row.qty,
        price: row.price,
        material: row.material,
        total: row.price * row.qty,
        materialTotal: row.material * row.qty,
        stockUsed,
      });
    }

    // Check inventory levels
    for (const [itemName, required] of Object.entries(stockDeductionMap)) {
      const stockItem = stock.find((s) => s.name.toUpperCase() === itemName);
      if (!stockItem) {
        addToast({
          type: 'error',
          title: 'Stock Item Missing',
          message: `Item "${itemName}" does not exist in inventory.`,
        });
        return;
      }
      const available = stockRemaining(stockItem);
      if (available < required) {
        addToast({
          type: 'error',
          title: 'Out of Stock',
          message: `Not enough ${stockItem.name}. Required: ${required} ${stockItem.unit}, Available: ${available} ${stockItem.unit}.`,
        });
        return;
      }
    }

    // Record sale
    const serviceSummary = lineItems.map((li) => `${li.service} × ${li.qty}`).join(', ');
    const stockUsedList = lineItems.map((li) => li.stockUsed).filter(Boolean) as Array<{ name: string; qty: number }>;

    const savedTx = recordCyberSale({
      customer: customerName.trim() || 'Walk-in Customer',
      phone: customerPhone.trim(),
      idNumber: customerIdNumber.trim(),
      address: customerAddress.trim(),
      service: serviceSummary,
      services: lineItems,
      qty: lineItems.reduce((acc, l) => acc + l.qty, 0),
      price: totals.subtotal,
      subtotal: totals.subtotal,
      total: totals.total,
      material: totals.materialCost,
      materialTotal: totals.materialCost,
      taxRate: totals.taxRate,
      taxAmount: Number(totals.taxAmount.toFixed(2)),
      taxMode: totals.taxMode as 'inclusive' | 'exclusive',
      taxName: totals.taxName,
      paid: paymentMethod === 'Credit / Debt' ? 0 : amountPaid,
      change: paymentMethod === 'Credit / Debt' ? 0 : totals.change,
      profit: totals.profit,
      payment: paymentMethod,
      stockUsed: stockUsedList,
    });

    // Confetti celebration
    try {
      confetti({
        particleCount: 75,
        spread: 70,
        origin: { y: 0.65 },
      });
    } catch (e) {}

    // Reset form
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setCustomerIdNumber('');
    setCustomerAddress('');
    setPaymentMethod('Cash');
    setCartRows([
      {
        id: `row_${Date.now()}`,
        serviceName: services[0]?.name || 'PRINTING',
        qty: 1,
        price: services[0]?.price || 10,
        material: services[0]?.material || 1,
      },
    ]);

    // Open receipt modal
    onSaleCompleted(savedTx);
  };

  const handleClear = () => {
    setCustomerName('Walk-in Customer');
    setCustomerPhone('');
    setCustomerIdNumber('');
    setCustomerAddress('');
    setPaymentMethod('Cash');
    setCartRows([
      {
        id: `row_${Date.now()}`,
        serviceName: services[0]?.name || 'PRINTING',
        qty: 1,
        price: services[0]?.price || 10,
        material: services[0]?.material || 1,
      },
    ]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Customer & Service Cart */}
      <div className="lg:col-span-8 space-y-6">
        {/* Customer Information Card */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <User className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Customer Details</h3>
            </div>

            {/* Quick Customer Picker */}
            <select
              onChange={(e) => handleSelectCustomer(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-700 dark:text-slate-300"
            >
              <option value="">Select Existing Customer...</option>
              {customers.map((c) => (
                <option key={c.phone} value={c.phone}>
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Customer Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Mary Wanjiku"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Phone / WhatsApp
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="07xxxxxxxx"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                ID / Document No.
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerIdNumber}
                  onChange={(e) => setCustomerIdNumber(e.target.value)}
                  placeholder="e.g. 12345678"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Location / Address
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="e.g. Reuben Stage"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Service Cart Card */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Services & Merchandise to Bill</span>
                <span className="text-xs font-normal text-slate-400">({cartRows.length} items)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Add multiple services to bill on one single customer receipt.</p>
            </div>

            <button
              onClick={() => addRow()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Service</span>
            </button>
          </div>

          {/* Cart Table */}
          <div className="space-y-3">
            {cartRows.map((row, idx) => {
              const lineTotal = Number(row.price || 0) * Number(row.qty || 1);
              const lineProfit = lineTotal - Number(row.material || 0) * Number(row.qty || 1);
              const srv = services.find((s) => s.name === row.serviceName);

              return (
                <div
                  key={row.id}
                  className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    {/* Service Picker */}
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Service #{idx + 1}
                      </label>
                      <select
                        value={row.serviceName}
                        onChange={(e) => updateRow(row.id, { serviceName: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                      >
                        {services.map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name} ({formatMoney(s.price)})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Quantity / Copies
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={row.qty}
                        onChange={(e) => updateRow(row.id, { qty: Math.max(1, Number(e.target.value)) })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center"
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Unit Price
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={row.price}
                        onChange={(e) => updateRow(row.id, { price: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                      />
                    </div>

                    {/* Material Cost */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        Material Cost / Unit
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={row.material}
                        onChange={(e) => updateRow(row.id, { material: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                      />
                    </div>

                    {/* Deduction Source Indicator */}
                    <div className="sm:col-span-12 flex flex-wrap items-center gap-2 pt-0.5">
                      {srv && srv.deductStock && srv.stockItem ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800/40">
                          <Boxes className="w-3 h-3" />
                          Deducts {(Number(srv.stockQty) || 1) * row.qty} {srv.stockItem} from {srv.deductLocation || 'Main Cyber Counter'}
                        </span>
                      ) : srv && srv.deductSource === 'petty_cash' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/40">
                          <DollarSign className="w-3 h-3" />
                          Disbursement: {formatMoney(row.material * row.qty)} from {srv.deductLocation || 'Cash Drawer'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Labor Only (Zero Stock Used)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Line Total & Remove */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-700">
                    <div className="text-right">
                      <span className="block text-xs font-black text-slate-900 dark:text-white">
                        {formatMoney(lineTotal)}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                        +{formatMoney(lineProfit)} profit
                      </span>
                    </div>

                    <button
                      onClick={() => removeRow(row.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="Remove row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Service Add Chips */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium mr-1">Quick Add:</span>
            {['PRINTING', 'PHOTOCOPY B & W', 'PASSPORT', 'LAMINATION', 'A 4 ENVELOPE'].map((name) => (
              <button
                key={name}
                onClick={() => addRow(name)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 text-slate-700 dark:text-slate-300 hover:text-blue-600 transition-colors border border-slate-200 dark:border-slate-700"
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Checkout & Payment Summary */}
      <div className="lg:col-span-4 space-y-6">
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 sticky top-36">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4">
            Payment & Checkout
          </h3>

          {/* Payment Method Selector */}
          <div className="space-y-2 mb-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Cash', 'M-Pesa', 'Card', 'Bank', 'Credit / Debt'] as PaymentMethod[]).map((method) => {
                const isSelected = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/25'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </div>

          {/* M-Pesa STK Push Trigger (Shown when M-Pesa is selected) */}
          {paymentMethod === 'M-Pesa' && (
            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Daraja STK Push</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 font-bold uppercase">
                  Ready
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed mb-3">
                Send payment request prompt directly to customer's mobile phone:
              </p>
              <button
                type="button"
                onClick={handleTriggerStkPush}
                disabled={isStkPushing}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50"
              >
                {isStkPushing ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                    <span>Prompting Customer's Phone...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send STK Prompt ({formatMoney(totals.total)})</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Amount Paid Input */}
          <div className="space-y-2 mb-5">
            <div className="flex justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Amount Received
              </label>
              <span className="text-xs text-slate-400 font-mono">Total: {formatMoney(totals.total)}</span>
            </div>
            <input
              type="number"
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 text-base font-black rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          {/* Tax / VAT Rule Selector */}
          {profile.enableTax && (
            <div className="mb-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Tax / VAT Rule
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <input
                    type="checkbox"
                    checked={isTaxExempt}
                    onChange={(e) => setIsTaxExempt(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Tax Exempt</span>
                </label>
              </div>

              {!isTaxExempt && taxRules && taxRules.length > 0 && (
                <select
                  value={selectedTaxRuleId}
                  onChange={(e) => setSelectedTaxRuleId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
                >
                  {taxRules
                    .filter((r) => r.active)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.rate}% - {r.type})
                      </option>
                    ))}
                </select>
              )}
            </div>
          )}

          {/* Calculations Summary Card */}
          <div className="space-y-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs mb-6">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatMoney(totals.subtotal)}</span>
            </div>
            {totals.taxAmount > 0 && (
              <>
                {totals.taxMode === 'inclusive' && (
                  <div className="flex justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                    <span>Net Subtotal (Excl. Tax):</span>
                    <span className="font-mono">{formatMoney(totals.netSubtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                  <span>
                    {totals.taxName} ({totals.taxRate}% {totals.taxMode === 'inclusive' ? 'Incl.' : 'Added'}):
                  </span>
                  <span className="font-mono font-bold">{formatMoney(totals.taxAmount)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Material Cost (Deduction):</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatMoney(totals.materialCost)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Realized Profit:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">+{formatMoney(totals.profit)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
              <span>Change Due:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{formatMoney(totals.change)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-sm font-black text-slate-900 dark:text-white">
              <span>TOTAL CHARGE:</span>
              <span className="font-mono text-base text-blue-600 dark:text-blue-400">{formatMoney(totals.total)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleCompleteSale}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl text-sm font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl shadow-blue-600/30 transition-transform active:scale-98"
            >
              <FileCheck className="w-5 h-5" />
              <span>Complete Sale & Issue Receipt</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear Order</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
