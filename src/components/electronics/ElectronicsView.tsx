import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Smartphone,
  Barcode,
  Search,
  Plus,
  RotateCcw,
  Printer,
  Trash2,
  TrendingUp,
  ShieldCheck,
  Camera,
  AlertTriangle,
  Package
} from 'lucide-react';
import { ElectronicsProduct } from '../../types/pos';

export const ElectronicsView: React.FC = () => {
  const {
    electronicsProducts,
    electronicsSales,
    electronicsReturns,
    addElectronicsProduct,
    updateElectronicsProduct,
    deleteElectronicsProduct,
    recordElectronicsSale,
    recordElectronicsReturn,
    deleteElectronicsSale,
    hasRole,
    formatMoney,
    addToast,
  } = usePOS();

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Sale State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [saleQty, setSaleQty] = useState<number>(1);
  const [saleCustomer, setSaleCustomer] = useState('Walk-in Customer');
  const [salePhone, setSalePhone] = useState('');
  const [saleSerial, setSaleSerial] = useState('');
  const [saleWarranty, setSaleWarranty] = useState('');
  const [salePayment, setSalePayment] = useState<any>('Cash');
  const [salePaid, setSalePaid] = useState<number>(0);
  const [barcodeInput, setBarcodeInput] = useState('');

  // Add Product Form State
  const [newProdName, setNewProdName] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('');
  const [newProdSupplier, setNewProdSupplier] = useState('');
  const [newProdBuy, setNewProdBuy] = useState<number>(0);
  const [newProdSell, setNewProdSell] = useState<number>(0);
  const [newProdQty, setNewProdQty] = useState<number>(1);
  const [newProdMin, setNewProdMin] = useState<number>(2);
  const [newProdWarranty, setNewProdWarranty] = useState('12 Months');

  // Returns Form State
  const [retReceipt, setRetReceipt] = useState('');
  const [retSerial, setRetSerial] = useState('');
  const [retQty, setRetQty] = useState<number>(1);
  const [retReason, setRetReason] = useState('');

  // Selected product lookup
  const selectedProduct = useMemo(() => {
    return electronicsProducts.find((p) => p.id === selectedProductId) || null;
  }, [electronicsProducts, selectedProductId]);

  // Sale calculations
  const saleTotal = selectedProduct ? Number(selectedProduct.sell || 0) * saleQty : 0;
  const saleCost = selectedProduct ? Number(selectedProduct.buy || 0) * saleQty : 0;
  const saleProfit = saleTotal - saleCost;
  const saleChange = Math.max(0, (salePaid || 0) - saleTotal);

  // Filtered inventory rows
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return electronicsProducts;
    return electronicsProducts.filter((p) =>
      [p.name, p.barcode, p.sku, p.brand, p.category, p.supplier].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }, [electronicsProducts, searchQuery]);

  // Handle barcode quick search
  const handleBarcodeLookup = () => {
    const code = barcodeInput.trim().toUpperCase();
    if (!code) return;
    const match = electronicsProducts.find(
      (p) =>
        (p.barcode && p.barcode.toUpperCase() === code) ||
        (p.sku && p.sku.toUpperCase() === code)
    );
    if (match) {
      setSelectedProductId(match.id);
      if (match.warranty) setSaleWarranty(match.warranty);
      setSalePaid(match.sell);
      addToast({ type: 'success', title: 'Product Scanned', message: `${match.name} selected.` });
    } else {
      addToast({ type: 'warning', title: 'Not Found', message: 'No product matched that barcode/SKU.' });
    }
  };

  // Submit Electronics Sale
  const handleCompleteSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      addToast({ type: 'error', title: 'Select Product', message: 'Choose an electronics product to bill.' });
      return;
    }
    if (saleQty > selectedProduct.qty) {
      addToast({
        type: 'error',
        title: 'Insufficient Inventory',
        message: `Only ${selectedProduct.qty} units available.`,
      });
      return;
    }

    recordElectronicsSale({
      productId: selectedProduct.id,
      product: selectedProduct.name,
      barcode: selectedProduct.barcode,
      sku: selectedProduct.sku,
      brand: selectedProduct.brand,
      category: selectedProduct.category,
      qty: saleQty,
      buy: selectedProduct.buy,
      sell: selectedProduct.sell,
      cost: saleCost,
      total: saleTotal,
      profit: saleProfit,
      customer: saleCustomer.trim() || 'Walk-in Customer',
      phone: salePhone.trim(),
      payment: salePayment,
      paid: salePaid || saleTotal,
      change: saleChange,
      serial: saleSerial.trim(),
      warranty: saleWarranty.trim() || selectedProduct.warranty,
    });

    // Reset sale form
    setSelectedProductId('');
    setSaleQty(1);
    setBarcodeInput('');
    setSaleCustomer('Walk-in Customer');
    setSalePhone('');
    setSaleSerial('');
  };

  // Add Product
  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || newProdSell < 0 || newProdBuy < 0) {
      addToast({ type: 'error', title: 'Invalid Product Information' });
      return;
    }

    addElectronicsProduct({
      name: newProdName.trim(),
      barcode: newProdBarcode.trim(),
      sku: newProdSku.trim(),
      brand: newProdBrand.trim(),
      category: newProdCategory.trim() || 'General Accessories',
      supplier: newProdSupplier.trim(),
      buy: newProdBuy,
      sell: newProdSell,
      qty: newProdQty,
      min: newProdMin,
      warranty: newProdWarranty.trim(),
    });

    // Reset form
    setNewProdName('');
    setNewProdBarcode('');
    setNewProdSku('');
    setNewProdBrand('');
    setNewProdCategory('');
    setNewProdSupplier('');
    setNewProdBuy(0);
    setNewProdSell(0);
    setNewProdQty(1);
  };

  // Process Return
  const handleProcessReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const receiptMatch = electronicsSales.find(
      (s) => s.receipt.toUpperCase() === retReceipt.trim().toUpperCase()
    );

    if (!receiptMatch) {
      addToast({ type: 'error', title: 'Sale Receipt Not Found', message: 'Enter a valid receipt number.' });
      return;
    }

    const returnAmount = receiptMatch.sell * retQty;

    recordElectronicsReturn({
      receipt: receiptMatch.receipt,
      product: receiptMatch.product,
      productId: receiptMatch.productId,
      serial: retSerial.trim() || receiptMatch.serial,
      qty: retQty,
      amount: returnAmount,
      reason: retReason.trim() || 'Customer warranty return',
    });

    setRetReceipt('');
    setRetSerial('');
    setRetQty(1);
    setRetReason('');
  };

  // KPI stats
  const totalStockUnits = electronicsProducts.reduce((acc, p) => acc + p.qty, 0);
  const totalStockValue = electronicsProducts.reduce((acc, p) => acc + p.qty * p.buy, 0);
  const totalPotentialProfit = electronicsProducts.reduce(
    (acc, p) => acc + p.qty * (p.sell - p.buy),
    0
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-950 p-6 sm:p-8 text-white shadow-xl border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/15 text-purple-200 border border-white/20 mb-2">
              <Smartphone className="w-3.5 h-3.5 text-purple-300" />
              <span>Dedicated Electronics & Gadgets POS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              📱 Electronics & Accessories Hub
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-purple-200 max-w-xl">
              Track serial numbers, warranties, barcodes, purchases, customer returns, and sales independently from cyber services.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3.5 rounded-2xl bg-white/10 border border-white/20 text-right">
              <span className="text-[10px] uppercase font-bold text-purple-300">Inventory Value</span>
              <p className="text-xl font-black">{formatMoney(totalStockValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Units in Stock</span>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {totalStockUnits} Units
          </h4>
          <span className="text-xs text-slate-500">{electronicsProducts.length} unique products</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Potential Profit</span>
          <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(totalPotentialProfit)}
          </h4>
          <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">Upon 100% sell-through</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Sales Completed</span>
          <h4 className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">
            {electronicsSales.length}
          </h4>
          <span className="text-xs text-slate-500">{electronicsReturns.length} returns logged</span>
        </div>
      </div>

      {/* Electronics Sale Checkout Form */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span>Record Electronics Customer Sale</span>
        </h3>

        <form onSubmit={handleCompleteSale} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Quick Barcode / SKU Scan input */}
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Scan Barcode / SKU
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeLookup();
                    }
                  }}
                  placeholder="Scan or type barcode..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                />
                <button
                  type="button"
                  onClick={handleBarcodeLookup}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shrink-0"
                >
                  Lookup
                </button>
              </div>
            </div>

            {/* Product Select */}
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Select Product ({electronicsProducts.length} items)
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  const p = electronicsProducts.find((x) => x.id === e.target.value);
                  if (p) {
                    setSaleWarranty(p.warranty || '12 Months');
                    setSalePaid(p.sell);
                  }
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              >
                <option value="">Select electronics product...</option>
                {electronicsProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatMoney(p.sell)}) — In Stock: {p.qty}
                  </option>
                ))}
              </select>
            </div>

            {/* Qty */}
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                max={selectedProduct ? selectedProduct.qty : 999}
                value={saleQty}
                onChange={(e) => setSaleQty(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer Name</label>
              <input
                type="text"
                value={saleCustomer}
                onChange={(e) => setSaleCustomer(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Customer Phone</label>
              <input
                type="text"
                value={salePhone}
                onChange={(e) => setSalePhone(e.target.value)}
                placeholder="07xxxxxxxx"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Serial / IMEI Number</label>
              <input
                type="text"
                value={saleSerial}
                onChange={(e) => setSaleSerial(e.target.value)}
                placeholder="IMEI or serial (optional)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Warranty Period</label>
              <input
                type="text"
                value={saleWarranty}
                onChange={(e) => setSaleWarranty(e.target.value)}
                placeholder="e.g. 12 Months"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/50 text-xs">
            <div>
              <span className="text-slate-500">Total Price:</span>
              <p className="text-base font-black text-slate-900 dark:text-white font-mono">{formatMoney(saleTotal)}</p>
            </div>
            <div>
              <span className="text-slate-500">Purchase Cost:</span>
              <p className="text-base font-bold text-slate-900 dark:text-white font-mono">{formatMoney(saleCost)}</p>
            </div>
            <div>
              <span className="text-slate-500">Net Profit:</span>
              <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">+{formatMoney(saleProfit)}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-extrabold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25 transition-transform active:scale-95"
            >
              <Smartphone className="w-4 h-4" />
              <span>Complete Electronics Sale ({formatMoney(saleTotal)})</span>
            </button>
          </div>
        </form>
      </div>

      {/* Add New Electronics Product */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4">
          Add New Product to Electronics Inventory
        </h3>

        <form onSubmit={handleAddProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Product Name</label>
              <input
                type="text"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                placeholder="e.g. Oraimo 20k Power Bank"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Barcode</label>
              <input
                type="text"
                value={newProdBarcode}
                onChange={(e) => setNewProdBarcode(e.target.value)}
                placeholder="EAN / UPC code"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">SKU / Model</label>
              <input
                type="text"
                value={newProdSku}
                onChange={(e) => setNewProdSku(e.target.value)}
                placeholder="e.g. OR-PB-20K"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Brand</label>
              <input
                type="text"
                value={newProdBrand}
                onChange={(e) => setNewProdBrand(e.target.value)}
                placeholder="e.g. Oraimo, Samsung, Tecno"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Wholesale Cost</label>
              <input
                type="number"
                min="0"
                value={newProdBuy}
                onChange={(e) => setNewProdBuy(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Selling Price</label>
              <input
                type="number"
                min="0"
                value={newProdSell}
                onChange={(e) => setNewProdSell(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Initial Quantity</label>
              <input
                type="number"
                min="0"
                value={newProdQty}
                onChange={(e) => setNewProdQty(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Low Alert Level</label>
              <input
                type="number"
                min="0"
                value={newProdMin}
                onChange={(e) => setNewProdMin(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-center"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Warranty</label>
              <input
                type="text"
                value={newProdWarranty}
                onChange={(e) => setNewProdWarranty(e.target.value)}
                placeholder="12 Months"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Electronics Catalog</span>
            </button>
          </div>
        </form>
      </div>

      {/* Electronics Inventory Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Electronics Catalog & Stock</h3>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, barcode..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Product</th>
                <th className="py-3 px-3">Barcode / SKU</th>
                <th className="py-3 px-3">Brand & Category</th>
                <th className="py-3 px-3 text-right">Wholesale Buy</th>
                <th className="py-3 px-3 text-right">Retail Sell</th>
                <th className="py-3 px-3 text-center">Remaining Stock</th>
                <th className="py-3 px-3">Warranty</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.map((p) => {
                const isLow = p.qty <= p.min;
                const isOut = p.qty <= 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{p.name}</td>
                    <td className="py-3 px-3 font-mono text-slate-500">
                      {p.barcode || p.sku || 'No code'}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {p.brand} {p.category && `• ${p.category}`}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">{formatMoney(p.buy)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatMoney(p.sell)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          isOut
                            ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400'
                            : isLow
                            ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {p.qty} units
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{p.warranty || 'None'}</td>
                    <td className="py-3 px-3 text-right">
                      {hasRole('admin') && (
                        <button
                          onClick={() => {
                            if (confirm(`Remove ${p.name} from catalog?`)) {
                              deleteElectronicsProduct(p.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No products found. Add products using the form above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Returns & Warranty Processing */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-purple-600" />
          <span>Process Customer Warranty Return</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Entering the receipt number will automatically restock the returned quantity back into inventory.
        </p>

        <form onSubmit={handleProcessReturn} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Receipt Number</label>
            <input
              type="text"
              value={retReceipt}
              onChange={(e) => setRetReceipt(e.target.value)}
              placeholder="e.g. EL-000001"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Serial / IMEI</label>
            <input
              type="text"
              value={retSerial}
              onChange={(e) => setRetSerial(e.target.value)}
              placeholder="Serial / IMEI returned"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Return Quantity</label>
            <input
              type="number"
              min="1"
              value={retQty}
              onChange={(e) => setRetQty(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Reason for Return</label>
            <input
              type="text"
              value={retReason}
              onChange={(e) => setRetReason(e.target.value)}
              placeholder="e.g. Factory defect, wrong cable"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div className="sm:col-span-4 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Record Return & Restore Stock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
