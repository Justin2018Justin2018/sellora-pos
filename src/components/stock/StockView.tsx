import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Boxes,
  Plus,
  AlertTriangle,
  Search,
  PackagePlus,
  Trash2,
  TrendingDown,
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  History,
  X
} from 'lucide-react';
import { StockItem } from '../../types/pos';

export const StockView: React.FC = () => {
  const {
    stock,
    stockRemaining,
    stockSoldUsed,
    lowStockItems,
    outOfStockItems,
    addStockBatch,
    addNewStockItem,
    recordWastage,
    profile,
    formatMoney,
    hasRole,
    addToast,
    auditLog,
  } = usePOS();

  const [filterMode, setFilterMode] = useState<'all' | 'low' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyItemName, setHistoryItemName] = useState<string | null>(null);

  // Restock Form
  const [restockItemName, setRestockItemName] = useState('');
  const [restockQty, setRestockQty] = useState<number>(50);
  const [restockCost, setRestockCost] = useState<number>(0);
  const [restockNotes, setRestockNotes] = useState('');

  // Wastage Form
  const [wasteItemName, setWasteItemName] = useState('');
  const [wasteQty, setWasteQty] = useState<number>(1);
  const [wasteReason, setWasteReason] = useState('Paper Jam / Misprint');

  // New Item Form
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('pcs');
  const [newItemOpening, setNewItemOpening] = useState<number>(100);
  const [newItemCost, setNewItemCost] = useState<number>(1);
  const [newItemReorder, setNewItemReorder] = useState<number>(20);

  // Filtered Stock items
  const displayedStock = useMemo(() => {
    return stock.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (q && !item.name.toLowerCase().includes(q)) return false;

      const remaining = stockRemaining(item);
      const threshold = item.reorderLevel ?? profile.lowStockThresholdDefault;

      if (filterMode === 'out') return remaining <= 0;
      if (filterMode === 'low') return remaining > 0 && remaining <= threshold;
      return true;
    });
  }, [stock, searchQuery, filterMode, stockRemaining, profile.lowStockThresholdDefault]);

  // Inventory stats
  const stats = useMemo(() => {
    let totalItems = stock.length;
    let totalStockUnits = 0;
    let totalValuation = 0;

    stock.forEach((item) => {
      const rem = stockRemaining(item);
      totalStockUnits += rem;
      totalValuation += rem * (item.costPerUnit || 1);
    });

    return {
      totalItems,
      totalStockUnits,
      totalValuation,
      lowCount: lowStockItems.length,
      outCount: outOfStockItems.length,
    };
  }, [stock, stockRemaining, lowStockItems, outOfStockItems]);

  // Filters the shared activity log down to entries mentioning this
  // specific item - reuses data already recorded by addStock/recordWastage
  // (see logAudit calls in POSContext), no new data model needed.
  const itemHistory = useMemo(() => {
    if (!historyItemName) return [];
    const needle = historyItemName.trim().toUpperCase();
    return auditLog.filter((entry) => entry.details.toUpperCase().includes(needle)).slice(0, 50);
  }, [auditLog, historyItemName]);

  // Handle Restock Submit
  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockItemName || restockQty <= 0) {
      addToast({ type: 'error', title: 'Invalid Restock', message: 'Select an item and enter valid quantity.' });
      return;
    }
    addStockBatch(restockItemName, restockQty, restockCost, restockNotes);
    setRestockQty(50);
    setRestockCost(0);
    setRestockNotes('');
  };

  // Handle Wastage Submit
  const handleWastageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!wasteItemName || wasteQty <= 0) {
      addToast({ type: 'error', title: 'Invalid Wastage', message: 'Select item and enter wastage quantity.' });
      return;
    }
    recordWastage(wasteItemName, wasteQty, wasteReason);
    setWasteQty(1);
    setWasteReason('Paper Jam / Misprint');
  };

  // Handle New Stock Item Submit
  const handleNewItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      addToast({ type: 'error', title: 'Name Required' });
      return;
    }
    addNewStockItem({
      name: newItemName.trim().toUpperCase(),
      unit: newItemUnit.trim() || 'pcs',
      openingStock: newItemOpening,
      costPerUnit: newItemCost,
      reorderLevel: newItemReorder,
    });
    setNewItemName('');
    setNewItemOpening(100);
    setNewItemCost(1);
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Item Name', 'Unit', 'Opening Stock', 'Added', 'Used/Sold', 'Remaining', 'Cost/Unit', 'Total Valuation', 'Status'];
    const rows = stock.map((s) => {
      const rem = stockRemaining(s);
      const threshold = s.reorderLevel ?? profile.lowStockThresholdDefault;
      const status = rem <= 0 ? 'Out of Stock' : rem <= threshold ? 'Low Stock' : 'Optimal';
      return [
        `"${s.name}"`,
        s.unit,
        s.openingStock,
        s.stockAdded,
        stockSoldUsed(s.name),
        rem,
        s.costPerUnit || 0,
        rem * (s.costPerUnit || 0),
        status,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sellora_Inventory_${new Date().toISOString().slice(0, 10)}.csv`);
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
              <Boxes className="w-3.5 h-3.5" />
              <span>Real-time Inventory Tracking</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              📦 Raw Materials & Stock Control
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-blue-100 max-w-xl">
              Automatic deductions on every print, copy, lamination, and binding. Track reams, sheets, cartridges, and pouches effortlessly.
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Total Inventory Value</span>
          <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {formatMoney(stats.totalValuation)}
          </h4>
          <span className="text-xs text-slate-500">{stats.totalStockUnits} raw units remaining</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Stock Items Tracked</span>
          <h4 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {stats.totalItems} Items
          </h4>
          <span className="text-xs text-slate-500">Auto-deducted on billing</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Low Stock Warnings</span>
          <h4 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {stats.lowCount} Items
          </h4>
          <span className="text-xs text-amber-700 dark:text-amber-300 font-semibold">Below reorder levels</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold text-slate-400 uppercase">Out of Stock</span>
          <h4 className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {stats.outCount} Items
          </h4>
          <span className="text-xs text-rose-700 dark:text-rose-300 font-semibold">Zero units remaining</span>
        </div>
      </div>

      {/* Forms Section: Restock & Log Wastage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Restock Form */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-emerald-600" />
            <span>Restock Existing Stock Item</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Add purchased stock batches (reams, sheets, pouches, or ink).
          </p>

          <form onSubmit={handleRestockSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Item to Restock</label>
              <select
                value={restockItemName}
                onChange={(e) => setRestockItemName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              >
                <option value="">Select stock item...</option>
                {stock.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} (Current: {stockRemaining(s)} {s.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Quantity Added</label>
                <input
                  type="number"
                  min="1"
                  value={restockQty}
                  onChange={(e) => setRestockQty(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cost / Unit (Optional KES)</label>
                <input
                  type="number"
                  min="0"
                  value={restockCost}
                  onChange={(e) => setRestockCost(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Supplier / Notes</label>
              <input
                type="text"
                value={restockNotes}
                onChange={(e) => setRestockNotes(e.target.value)}
                placeholder="e.g. Purchased 5 reams from River Road"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-transform active:scale-98"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Add Stock Batch</span>
            </button>
          </form>
        </div>

        {/* Log Wastage / Damage Form */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <span>Record Paper Jam / Wastage</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Deducts wasted or jammed paper without recording a sale.
          </p>

          <form onSubmit={handleWastageSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Wasted Material</label>
              <select
                value={wasteItemName}
                onChange={(e) => setWasteItemName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              >
                <option value="">Select wasted item...</option>
                {stock.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Quantity Damaged</label>
                <input
                  type="number"
                  min="1"
                  value={wasteQty}
                  onChange={(e) => setWasteQty(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Reason</label>
                <select
                  value={wasteReason}
                  onChange={(e) => setWasteReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                >
                  <option value="Paper Jam / Misprint">Paper Jam / Misprint</option>
                  <option value="Toner Streaks / Smudge">Toner Streaks / Smudge</option>
                  <option value="Water / Spill Damage">Water / Spill Damage</option>
                  <option value="Damaged Pouch / Wrinkle">Damaged Pouch / Wrinkle</option>
                  <option value="Expired / Defective">Expired / Defective</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-transform active:scale-98"
            >
              <TrendingDown className="w-4 h-4" />
              <span>Log Wastage & Deduct Stock</span>
            </button>
          </form>
        </div>
      </div>

      {/* Main Inventory Ledger Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Current Stock Balances</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Calculated as: (Opening + Added) - Sold/Used</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Chips */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterMode === 'all'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All ({stock.length})
              </button>
              <button
                onClick={() => setFilterMode('low')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterMode === 'low'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Low Alert ({lowStockItems.length})
              </button>
              <button
                onClick={() => setFilterMode('out')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterMode === 'out'
                    ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Out of Stock ({outOfStockItems.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search item..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Raw Material / Stock Item</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3 text-right">Opening</th>
                <th className="py-3 px-3 text-right">Added</th>
                <th className="py-3 px-3 text-right">Used / Sold</th>
                <th className="py-3 px-3 text-center">Remaining Balance</th>
                <th className="py-3 px-3 text-right">Unit Valuation</th>
                <th className="py-3 px-3 text-right">Stock Value</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {displayedStock.map((item) => {
                const rem = stockRemaining(item);
                const threshold = item.reorderLevel ?? profile.lowStockThresholdDefault;
                const isOut = rem <= 0;
                const isLow = rem > 0 && rem <= threshold;
                const itemValuation = rem * (item.costPerUnit || 1);

                return (
                  <tr key={item.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{item.name}</td>
                    <td className="py-3 px-3 text-slate-500 font-mono">{item.unit}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-400">{item.openingStock}</td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">+{item.stockAdded}</td>
                    <td className="py-3 px-3 text-right font-mono text-rose-600 dark:text-rose-400">-{stockSoldUsed(item.name)}</td>
                    <td className="py-3 px-3 text-center font-mono font-black text-sm">
                      <span className={isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900 dark:text-white'}>
                        {rem}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">{formatMoney(item.costPerUnit || 1)}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">{formatMoney(itemValuation)}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isOut
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                            : isLow
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                        }`}
                      >
                        {isOut ? (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Out</span>
                          </>
                        ) : isLow ? (
                          <>
                            <AlertTriangle className="w-3 h-3" />
                            <span>Reorder (&lt;{threshold})</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Optimal</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setHistoryItemName(item.name)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        title={`View stock history for ${item.name}`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>History</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register New Stock Item Form */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
          Register New Raw Material / Item
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Add an entirely new consumable to track (e.g. Glossy Sticker Paper, Thermal 80mm roll, Binding Spiral 14mm).
        </p>

        <form onSubmit={handleNewItemSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Item Name</label>
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="e.g. THERMAL ROLL 80MM"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Unit</label>
            <input
              type="text"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              placeholder="e.g. rolls, sheets"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Opening Stock</label>
            <input
              type="number"
              min="0"
              value={newItemOpening}
              onChange={(e) => setNewItemOpening(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cost Per Unit (KES)</label>
            <input
              type="number"
              min="0"
              value={newItemCost}
              onChange={(e) => setNewItemCost(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Item</span>
            </button>
          </div>
        </form>
      </div>

      {/* Per-item Stock History Modal */}
      {historyItemName && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600" />
                  <span>Stock History</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{historyItemName}</p>
              </div>
              <button
                onClick={() => setHistoryItemName(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-2 flex-1">
              {itemHistory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  No restock, wastage, or adjustment history recorded for this item yet.
                </p>
              ) : (
                itemHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{entry.details}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {entry.staff} &middot;{' '}
                      {new Date(entry.time).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
