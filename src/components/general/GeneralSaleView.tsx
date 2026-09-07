import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  CreditCard,
  Banknote,
  Smartphone,
  Tag,
  AlertTriangle,
  X
} from 'lucide-react';
import { GeneralProduct, PaymentMethod, Transaction } from '../../types/pos';
import { executeReceiptPrint, openReceiptInNewTab, generateBarcodeSvg } from '../../utils/printReceipt';

export const GeneralSaleView: React.FC = () => {
  const {
    generalProducts,
    recordGeneralSale,
    formatMoney,
    addToast,
    profile,
    taxRules,
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<Array<{ product: GeneralProduct; qty: number }>>([]);
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [completedSale, setCompletedSale] = useState<any | null>(null);

  // Tax State
  const defaultTaxRule = (taxRules && taxRules.find((r) => r.isDefault && r.active)) || (taxRules && taxRules[0]);
  const [selectedTaxRuleId, setSelectedTaxRuleId] = useState<string>(() => (defaultTaxRule ? defaultTaxRule.id : 'default'));
  const [isTaxExempt, setIsTaxExempt] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [modalFormat, setModalFormat] = useState<'80' | '58' | 'A4'>(
    profile.receiptFormat === '58mm' ? '58' : profile.receiptFormat === 'a4' ? 'A4' : '80'
  );

  const convertSaleToTx = (sale: any): Transaction => {
    const items = sale.items || [];
    return {
      id: sale.id || `TX-${Date.now()}`,
      receipt: sale.receipt,
      service: items.map((i: any) => i.productName || i.name).join(', ') || 'Retail Sale',
      category: 'Retail',
      qty: items.reduce((s: number, i: any) => s + (i.qty || 1), 0) || 1,
      price: sale.total,
      subtotal: sale.subtotal || sale.total,
      material: 0,
      materialTotal: 0,
      profit: sale.profit || 0,
      total: sale.total,
      taxRate: sale.taxRate,
      taxAmount: sale.taxAmount,
      taxMode: sale.taxMode,
      taxName: sale.taxName,
      customer: sale.customer,
      phone: sale.phone,
      payment: sale.payment,
      paid: sale.paid,
      change: sale.change,
      date: sale.date || new Date().toISOString(),
      staff: sale.staff || 'Cashier',
      services: items.map((i: any) => ({
        service: i.productName || i.name,
        qty: i.qty,
        price: i.unitPrice || i.price,
        total: (i.qty || 1) * (i.unitPrice || i.price || 0),
      })),
    };
  };

  // Filtered products for catalog grid / search
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return generalProducts.filter(p => p.active !== false);
    return generalProducts.filter(
      (p) =>
        p.active !== false &&
        [p.name, p.sku, p.barcode, p.category].some((v) =>
          String(v || '').toLowerCase().includes(q)
        )
    );
  }, [generalProducts, searchQuery]);

  // Add product to cart
  const addToCart = (product: GeneralProduct) => {
    if (product.quantity <= 0) {
      addToast({ type: 'warning', title: 'Out of Stock', message: `${product.name} is currently out of stock.` });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.qty + 1 > product.quantity) {
          addToast({ type: 'warning', title: 'Max Stock Reached', message: `Only ${product.quantity} units available.` });
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.qty + delta;
            if (newQty > item.product.quantity) {
              addToast({ type: 'warning', title: 'Max Stock Reached', message: `Only ${item.product.quantity} units available.` });
              return item;
            }
            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter((item) => item.qty > 0);
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.sellingPrice * item.qty, 0);
  }, [cart]);

  const activeTaxRule = isTaxExempt
    ? null
    : (taxRules && taxRules.find((r) => r.id === selectedTaxRuleId && r.active)) || defaultTaxRule;

  const taxEnabled = Boolean(profile.enableTax && !isTaxExempt && activeTaxRule && activeTaxRule.rate > 0);
  const taxRate = taxEnabled && activeTaxRule ? activeTaxRule.rate : 0;
  const taxMode = activeTaxRule ? activeTaxRule.type : (profile.taxCalculationMode || 'inclusive');
  const taxName = activeTaxRule ? activeTaxRule.name : (profile.taxName || 'VAT');

  const baseAfterDiscount = Math.max(0, subtotal - (discount || 0));

  const { finalTotal, taxAmount, netSubtotal } = useMemo(() => {
    if (!taxEnabled || taxRate <= 0) {
      return {
        finalTotal: baseAfterDiscount,
        taxAmount: 0,
        netSubtotal: baseAfterDiscount,
      };
    }

    if (taxMode === 'exclusive') {
      const tax = baseAfterDiscount * (taxRate / 100);
      return {
        finalTotal: baseAfterDiscount + tax,
        taxAmount: tax,
        netSubtotal: baseAfterDiscount,
      };
    } else {
      // Inclusive
      const net = baseAfterDiscount / (1 + taxRate / 100);
      const tax = baseAfterDiscount - net;
      return {
        finalTotal: baseAfterDiscount,
        taxAmount: tax,
        netSubtotal: net,
      };
    }
  }, [baseAfterDiscount, taxEnabled, taxRate, taxMode]);

  const effectivePaid = amountPaid >= finalTotal ? amountPaid : finalTotal;
  const changeDue = Math.max(0, effectivePaid - finalTotal);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      addToast({ type: 'error', title: 'Empty Cart', message: 'Add at least one product to bill.' });
      return;
    }

    const saleItems = cart.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      qty: item.qty,
      unitPrice: item.product.sellingPrice,
      buyingPrice: item.product.buyingPrice,
      total: item.product.sellingPrice * item.qty,
      profit: (item.product.sellingPrice - item.product.buyingPrice) * item.qty,
    }));

    const totalProfit = saleItems.reduce((sum, i) => sum + i.profit, 0);

    const saleRecord = recordGeneralSale({
      customer: customerName.trim() || 'Walk-in Customer',
      phone: customerPhone.trim(),
      items: saleItems,
      subtotal,
      discount: discount || 0,
      total: finalTotal,
      taxRate: taxEnabled ? taxRate : 0,
      taxAmount: Number(taxAmount.toFixed(2)),
      taxMode,
      taxName,
      paid: effectivePaid,
      change: changeDue,
      profit: totalProfit,
      payment: paymentMethod,
      staff: 'Current Cashier',
    });

    if (saleRecord) {
      setCompletedSale(saleRecord);
      setIsReceiptModalOpen(true);
      setCart([]);
      setDiscount(0);
      setAmountPaid(0);
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      addToast({ type: 'success', title: 'Sale Completed', message: `Receipt ${saleRecord.receipt} generated successfully.` });

      if (profile.autoPrintReceipt) {
        const tx = convertSaleToTx(saleRecord);
        executeReceiptPrint({
          transaction: tx,
          profile,
          format: modalFormat,
          formatMoney,
        });
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-140px)]">
      {/* Left: Product Catalog & Search (Cols 7) */}
      <div className="lg:col-span-7 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search retail stock by name or barcode..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredProducts.map((p) => {
              const isOut = p.quantity <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={isOut}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all group ${
                    isOut
                      ? 'bg-slate-100 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-emerald-500 hover:shadow-md cursor-pointer'
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                      {p.category}
                    </span>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-2 group-hover:text-emerald-600 transition-colors">
                      {p.name}
                    </h4>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      {formatMoney(p.sellingPrice)}
                    </span>
                    <span className={`text-xs font-bold ${p.quantity <= p.minStock ? 'text-rose-600' : 'text-slate-500'}`}>
                      {p.quantity} {p.unit}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right: Cart & Checkout (Cols 5) */}
      <div className="lg:col-span-5 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Current Cart</h3>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
            {cart.reduce((sum, i) => sum + i.qty, 0)} Items
          </span>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-64 mb-4">
          {cart.map((item) => (
            <div
              key={item.product.id}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                  {item.product.name}
                </h5>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                  {formatMoney(item.product.sellingPrice)} × {item.qty} = {formatMoney(item.product.sellingPrice * item.qty)}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => updateCartQty(item.product.id, -1)}
                  className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold hover:bg-slate-300 transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center text-xs font-bold text-slate-900 dark:text-white">
                  {item.qty}
                </span>
                <button
                  onClick={() => updateCartQty(item.product.id, 1)}
                  className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold hover:bg-slate-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeFromCart(item.product.id)}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition-colors ml-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-semibold">Your cart is empty. Click products to add.</p>
            </div>
          )}
        </div>

        {/* Checkout Form & Totals */}
        <form onSubmit={handleCheckout} className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Customer Name</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Phone Number</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="0712345678"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Discount (KSh)</label>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-bold"
              >
                <option value="Cash">Cash</option>
                <option value="M-Pesa">M-Pesa</option>
                <option value="Card">Card</option>
                <option value="Bank">Bank</option>
                <option value="Credit / Debt">Credit / Debt</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Amount Tendered (KSh)</label>
            <input
              type="number"
              min="0"
              value={amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              placeholder={String(finalTotal)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-emerald-600 font-bold"
            />
          </div>

          {/* Tax / VAT Rule Selector */}
          {profile.enableTax && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Tax / VAT Rule
                </span>
                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-500 font-medium">
                  <input
                    type="checkbox"
                    checked={isTaxExempt}
                    onChange={(e) => setIsTaxExempt(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Exempt</span>
                </label>
              </div>

              {!isTaxExempt && taxRules && taxRules.length > 0 && (
                <select
                  value={selectedTaxRuleId}
                  onChange={(e) => setSelectedTaxRuleId(e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
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

          {/* Bill Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 space-y-1 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-rose-500">
                <span>Discount</span>
                <span>-{formatMoney(discount)}</span>
              </div>
            )}
            {taxAmount > 0 && (
              <>
                {taxMode === 'inclusive' && (
                  <div className="flex justify-between text-slate-400 text-[10px]">
                    <span>Net Amount (Excl. Tax)</span>
                    <span>{formatMoney(netSubtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                  <span>
                    {taxName} ({taxRate}%{taxMode === 'inclusive' ? ' Incl.' : ' Added'})
                  </span>
                  <span>{formatMoney(taxAmount)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-black text-slate-900 dark:text-white text-base pt-1 border-t border-slate-200 dark:border-slate-700">
              <span>Total Due</span>
              <span className="text-emerald-600">{formatMoney(finalTotal)}</span>
            </div>
            {changeDue > 0 && (
              <div className="flex justify-between font-bold text-blue-600 pt-0.5">
                <span>Change Due</span>
                <span>{formatMoney(changeDue)}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-xl font-black text-white shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95 ${
              cart.length === 0
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Complete Sale & Print Receipt</span>
          </button>
        </form>
      </div>

      {/* Receipt Modal */}
      {isReceiptModalOpen && completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="text-center pb-4 border-b border-dashed border-slate-300 dark:border-slate-800">
              <h3 className="font-black text-lg uppercase tracking-tight">{profile.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{profile.address || 'Nairobi, Kenya'}</p>
              <p className="text-xs text-slate-500">Tel: {profile.phone}</p>
            </div>

            <div className="py-4 space-y-2 text-xs border-b border-dashed border-slate-300 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">Receipt No:</span>
                <span className="font-mono font-bold">{completedSale.receipt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{new Date(completedSale.date).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold">{completedSale.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cashier:</span>
                <span>{completedSale.staff}</span>
              </div>
            </div>

            <div className="py-4 space-y-2 border-b border-dashed border-slate-300 dark:border-slate-800 max-h-48 overflow-y-auto">
              {completedSale.items.map((i: any, idx: number) => (
                <div key={idx} className="flex justify-between text-xs">
                  <div>
                    <span className="font-bold">{i.productName}</span>
                    <div className="text-[10px] text-slate-400">{i.qty} × {formatMoney(i.unitPrice)}</div>
                  </div>
                  <span className="font-bold">{formatMoney(i.total)}</span>
                </div>
              ))}
            </div>

            <div className="py-4 space-y-1.5 text-xs">
              <div className="flex justify-between font-black text-sm pt-1">
                <span>TOTAL:</span>
                <span className="text-emerald-600">{formatMoney(completedSale.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment ({completedSale.payment}):</span>
                <span>{formatMoney(completedSale.paid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Change:</span>
                <span>{formatMoney(completedSale.change)}</span>
              </div>
            </div>

            <div className="py-2 flex justify-center scale-95" dangerouslySetInnerHTML={{ __html: generateBarcodeSvg(completedSale.receipt, 200, 30) }} />

            {/* Format Selector Pills */}
            <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-dashed border-slate-300 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 mr-1">FORMAT:</span>
              {(['80', '58', 'A4'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setModalFormat(fmt)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    modalFormat === fmt
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {fmt === '80' ? '80mm' : fmt === '58' ? '58mm' : 'A4'}
                </button>
              ))}
            </div>

            <div className="text-center pt-3 border-t border-dashed border-slate-300 dark:border-slate-800">
              <p className="text-xs font-semibold italic text-slate-600 dark:text-slate-400">
                {profile.receiptFooter || 'Thank you for your business. Welcome again!'}
              </p>
              <button
                onClick={() => {
                  const tx = convertSaleToTx(completedSale);
                  addToast({
                    type: 'info',
                    title: '🖨️ Printing Receipt...',
                    message: `Sending sale receipt #${completedSale.receipt} to printer (${modalFormat})...`,
                  });
                  executeReceiptPrint({
                    transaction: tx,
                    profile,
                    format: modalFormat,
                    formatMoney,
                  });
                }}
                className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Print Receipt ({modalFormat === '80' ? '80mm Thermal' : modalFormat === '58' ? '58mm Thermal' : 'A4 Invoice'})</span>
              </button>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    const tx = convertSaleToTx(completedSale);
                    openReceiptInNewTab({
                      transaction: tx,
                      profile,
                      format: modalFormat,
                      formatMoney,
                    });
                  }}
                  className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  Open in Tab
                </button>
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
