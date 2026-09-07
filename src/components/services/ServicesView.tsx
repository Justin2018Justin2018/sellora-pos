import React, { useState, useMemo } from 'react';
import { usePOS } from '../../context/POSContext';
import {
  Wrench,
  Search,
  Plus,
  Trash2,
  Edit2,
  DollarSign,
  TrendingUp,
  Boxes,
  CheckCircle2,
  Tag,
  MapPin,
  Layers,
  AlertTriangle,
  Building2,
  Wallet,
  Sparkles,
  X
} from 'lucide-react';
import { ServiceItem, StockItem } from '../../types/pos';

const STORAGE_LOCATIONS = [
  'Main Cyber Counter',
  'Back Store / Bulk Storage',
  'Stationery Display Shelf',
  'Laminating & Finishing Desk',
  'Photo Studio Counter',
  'Branch 2 (Reuben Stage Counter)',
  'Hardware Workshop',
  'Other (Custom Location)',
];

const CASH_SOURCES = [
  'Front Cash Drawer / Cash Float',
  'M-Pesa Till / Float Account',
  'Petty Cash Kitty',
  'Branch 2 Cash Till',
  'Other Cash Account',
];

export const ServicesView: React.FC = () => {
  const {
    services,
    stock,
    shops,
    stockRemaining,
    addService,
    updateService,
    deleteService,
    formatMoney,
    hasRole,
    addToast,
  } = usePOS();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDeductFilter, setSelectedDeductFilter] = useState<string>('all');

  // New Service Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Printing & Copy');
  const [newPrice, setNewPrice] = useState<number>(50);
  const [newMaterial, setNewMaterial] = useState<number>(1);
  
  // Where to deduct from state
  const [newDeductSource, setNewDeductSource] = useState<'stock' | 'petty_cash' | 'labor'>('stock');
  const [newDeductLocation, setNewDeductLocation] = useState<string>('Main Cyber Counter');
  const [newCustomLocation, setNewCustomLocation] = useState<string>('');
  const [newStockItem, setNewStockItem] = useState<string>(stock[0]?.name || 'PHOTOCOPY PAPER');
  const [newStockQty, setNewStockQty] = useState<number>(1);

  // Edit Service State
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [editCategory, setEditCategory] = useState<string>('Printing & Copy');
  const [editPrice, setEditPrice] = useState<number>(50);
  const [editMaterial, setEditMaterial] = useState<number>(1);
  const [editDeductSource, setEditDeductSource] = useState<'stock' | 'petty_cash' | 'labor'>('stock');
  const [editDeductLocation, setEditDeductLocation] = useState<string>('Main Cyber Counter');
  const [editCustomLocation, setEditCustomLocation] = useState<string>('');
  const [editStockItem, setEditStockItem] = useState<string>(stock[0]?.name || 'PHOTOCOPY PAPER');
  const [editStockQty, setEditStockQty] = useState<number>(1);

  // Available categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return ['all', ...Array.from(set)];
  }, [services]);

  // Combined list of location options including active shop locations
  const availableLocations = useMemo(() => {
    const list = [...STORAGE_LOCATIONS];
    if (shops && shops.length > 0) {
      shops.forEach((sh) => {
        const branchLabel = `${sh.name} (${sh.location})`;
        if (!list.includes(branchLabel)) {
          list.unshift(branchLabel);
        }
      });
    }
    return list;
  }, [shops]);

  // Quick lookup for remaining stock
  const getRemainingStock = (itemName?: string): number | null => {
    if (!itemName) return null;
    const target = stock.find((s) => s.name.toUpperCase() === itemName.trim().toUpperCase());
    if (!target) return null;
    return stockRemaining(target);
  };

  const getStockItemUnit = (itemName?: string): string => {
    if (!itemName) return 'units';
    const target = stock.find((s) => s.name.toUpperCase() === itemName.trim().toUpperCase());
    return target?.unit || 'pieces';
  };

  const getStockItemCost = (itemName?: string): number => {
    if (!itemName) return 0;
    const target = stock.find((s) => s.name.toUpperCase() === itemName.trim().toUpperCase());
    return target?.costPrice || 0;
  };

  // Filtered services
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      if (q && !s.name.toLowerCase().includes(q) && !(s.stockItem || '').toLowerCase().includes(q) && !(s.deductLocation || '').toLowerCase().includes(q)) {
        return false;
      }
      if (selectedCategory !== 'all' && s.category !== selectedCategory) {
        return false;
      }
      if (selectedDeductFilter !== 'all') {
        if (selectedDeductFilter === 'stock' && !s.deductStock) return false;
        if (selectedDeductFilter === 'petty_cash' && s.deductSource !== 'petty_cash') return false;
        if (selectedDeductFilter === 'labor' && (s.deductStock || s.deductSource === 'petty_cash')) return false;
        if (selectedDeductFilter.startsWith('loc:')) {
          const locTarget = selectedDeductFilter.replace('loc:', '');
          if ((s.deductLocation || '') !== locTarget) return false;
        }
      }
      return true;
    });
  }, [services, searchQuery, selectedCategory, selectedDeductFilter]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = services.length;
    const stockLinked = services.filter((s) => s.deductStock && s.stockItem).length;
    const cashLinked = services.filter((s) => s.deductSource === 'petty_cash').length;
    const laborOnly = total - stockLinked - cashLinked;
    return { total, stockLinked, cashLinked, laborOnly };
  }, [services]);

  const handleCreateService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newPrice < 0) {
      addToast({ type: 'error', title: 'Invalid Service Information', message: 'Please provide a valid service name and selling price.' });
      return;
    }

    const isStock = newDeductSource === 'stock';
    const isCash = newDeductSource === 'petty_cash';
    const resolvedLocation = newDeductLocation === 'Other (Custom Location)'
      ? (newCustomLocation.trim() || 'Custom Location')
      : newDeductLocation;

    const newServiceItem: ServiceItem = {
      name: newName.trim().toUpperCase(),
      category: newCategory,
      price: newPrice,
      material: newMaterial,
      deductStock: isStock,
      deductSource: newDeductSource,
      deductLocation: isStock || isCash ? resolvedLocation : 'Digital / Service Counter',
      deductFrom: isStock ? newStockItem : isCash ? (resolvedLocation || 'Cash Drawer') : 'None (Labor Only)',
      stockItem: isStock ? newStockItem : undefined,
      stockQty: isStock ? Number(newStockQty) || 1 : undefined,
    };

    const success = addService(newServiceItem);
    if (success) {
      setNewName('');
      setNewPrice(50);
      setNewMaterial(1);
      setNewCustomLocation('');
    }
  };

  const handleOpenEdit = (srv: ServiceItem) => {
    setEditingService(srv);
    setEditCategory(srv.category || 'Printing & Copy');
    setEditPrice(srv.price);
    setEditMaterial(srv.material);

    const source: 'stock' | 'petty_cash' | 'labor' = srv.deductSource
      ? srv.deductSource
      : srv.deductStock
      ? 'stock'
      : 'labor';
    setEditDeductSource(source);

    const existingLoc = srv.deductLocation || 'Main Cyber Counter';
    if (availableLocations.includes(existingLoc)) {
      setEditDeductLocation(existingLoc);
      setEditCustomLocation('');
    } else {
      setEditDeductLocation('Other (Custom Location)');
      setEditCustomLocation(existingLoc);
    }

    setEditStockItem(srv.stockItem || stock[0]?.name || 'PHOTOCOPY PAPER');
    setEditStockQty(srv.stockQty || 1);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    const isStock = editDeductSource === 'stock';
    const isCash = editDeductSource === 'petty_cash';
    const resolvedLocation = editDeductLocation === 'Other (Custom Location)'
      ? (editCustomLocation.trim() || 'Custom Location')
      : editDeductLocation;

    const updated: ServiceItem = {
      ...editingService,
      category: editCategory,
      price: editPrice,
      material: editMaterial,
      deductStock: isStock,
      deductSource: editDeductSource,
      deductLocation: isStock || isCash ? resolvedLocation : 'Digital / Service Counter',
      deductFrom: isStock ? editStockItem : isCash ? (resolvedLocation || 'Cash Drawer') : 'None (Labor Only)',
      stockItem: isStock ? editStockItem : undefined,
      stockQty: isStock ? Number(editStockQty) || 1 : undefined,
    };

    updateService(editingService.name, updated);
    setEditingService(null);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-3xl bg-slate-900 text-white p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 mb-3">
              <Wrench className="w-3.5 h-3.5" />
              <span>Services, Rate Card & Deduction Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              🛠️ Services & Rate Card Catalog
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Set standard prices, material costs, and precisely configure <strong>where to deduct from</strong>—link 
              sales directly to physical inventory shelves, cash drawer outlays, or 100% margin digital labor.
            </p>
          </div>

          {/* KPI Snapshot Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Services</span>
              <span className="text-lg font-black text-white">{stats.total}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-blue-400 block">Stock-Deducted</span>
              <span className="text-lg font-black text-blue-400">{stats.stockLinked}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-amber-400 block">Cash Outlays</span>
              <span className="text-lg font-black text-amber-400">{stats.cashLinked}</span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block">Labor Only</span>
              <span className="text-lg font-black text-emerald-400">{stats.laborOnly}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add New Service Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>Add New Service to Rate Card</span>
          </h3>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Configure price, margins & deduction destination
          </span>
        </div>

        <form onSubmit={handleCreateService} className="space-y-5">
          {/* Basic Service Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label htmlFor="serviceNameInput" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Service Name *
              </label>
              <input
                id="serviceNameInput"
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. K.R.A PIN REGISTRATION"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="serviceCategorySelect" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Category
              </label>
              <select
                id="serviceCategorySelect"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="Printing & Copy">Printing & Copy</option>
                <option value="Document Services">Document Services</option>
                <option value="Government & E-Services">Government & E-Services</option>
                <option value="Cyber & Online">Cyber & Online</option>
                <option value="Photography">Photography</option>
                <option value="Printing & Finishing">Printing & Finishing</option>
                <option value="Stationery">Stationery</option>
                <option value="Education Services">Education Services</option>
                <option value="Media & Phone">Media & Phone</option>
                <option value="Technical Repairs">Technical Repairs</option>
                <option value="Other Service">Other Service</option>
              </select>
            </div>

            <div>
              <label htmlFor="servicePriceInput" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Selling Price (KES) *
              </label>
              <input
                id="servicePriceInput"
                type="number"
                min="0"
                required
                value={newPrice}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="serviceMaterialInput" className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Material Cost / Unit (KES)
              </label>
              <input
                id="serviceMaterialInput"
                type="number"
                min="0"
                value={newMaterial}
                onChange={(e) => setNewMaterial(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* DEDUCTION CONFIGURATION: "Select Where to Deduct From" */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-3">
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Select Where to Deduct From
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Specify whether this service consumes inventory materials, disburses direct cash, or requires zero stock.
                </p>
              </div>

              {/* Instant Margin Preview */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <span className="text-slate-400 font-medium">Projected Margin:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {newPrice > 0 ? Math.round(((newPrice - newMaterial) / newPrice) * 100) : 100}%
                </span>
                <span className="text-slate-400 font-mono">
                  (+{formatMoney(Math.max(0, newPrice - newMaterial))})
                </span>
              </div>
            </div>

            {/* Mode Selector Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                id="deductSourceStockBtn"
                onClick={() => {
                  setNewDeductSource('stock');
                  const cost = getStockItemCost(newStockItem);
                  if (cost > 0) setNewMaterial(cost);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  newDeductSource === 'stock'
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Boxes className={`w-4 h-4 ${newDeductSource === 'stock' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Physical Stock Inventory</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Deduct consumables (paper, pouches, envelopes, toner) from specific shop shelf.
                </p>
              </button>

              <button
                type="button"
                id="deductSourceCashBtn"
                onClick={() => setNewDeductSource('petty_cash')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  newDeductSource === 'petty_cash'
                    ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 ring-2 ring-amber-500/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className={`w-4 h-4 ${newDeductSource === 'petty_cash' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Cash Drawer / Float</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Disburse direct cash outlay per sale (e.g. eCitizen or official portal search fees).
                </p>
              </button>

              <button
                type="button"
                id="deductSourceLaborBtn"
                onClick={() => {
                  setNewDeductSource('labor');
                  setNewMaterial(0);
                }}
                className={`p-3 rounded-xl border text-left transition-all ${
                  newDeductSource === 'labor'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/30'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className={`w-4 h-4 ${newDeductSource === 'labor' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">Labor / Digital Only</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Zero stock or cash used (typing, phone flashing, wifi, consultation). 100% margin.
                </p>
              </button>
            </div>

            {/* If Stock Inventory is selected: Location + Stock Item + Qty */}
            {newDeductSource === 'stock' && (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* Location / Shelf Dropdown */}
                <div className="sm:col-span-4">
                  <label htmlFor="newDeductLocationSelect" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-blue-500" />
                    <span>Deduct From Location / Shelf *</span>
                  </label>
                  <select
                    id="newDeductLocationSelect"
                    value={newDeductLocation}
                    onChange={(e) => setNewDeductLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  {newDeductLocation === 'Other (Custom Location)' && (
                    <input
                      type="text"
                      placeholder="Type custom location/room..."
                      value={newCustomLocation}
                      onChange={(e) => setNewCustomLocation(e.target.value)}
                      className="mt-1.5 w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                    />
                  )}
                </div>

                {/* Stock Item Dropdown */}
                <div className="sm:col-span-5">
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="newStockItemSelect" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Boxes className="w-3 h-3 text-blue-500" />
                      <span>Stock Material to Deduct *</span>
                    </label>
                    {getRemainingStock(newStockItem) !== null && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        Avail: {getRemainingStock(newStockItem)} {getStockItemUnit(newStockItem)}
                      </span>
                    )}
                  </div>
                  <select
                    id="newStockItemSelect"
                    value={newStockItem}
                    onChange={(e) => {
                      const selected = e.target.value;
                      setNewStockItem(selected);
                      const cost = getStockItemCost(selected);
                      if (cost > 0) setNewMaterial(cost);
                    }}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {stock.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.unit}) — KES {s.costPrice || 0} cost
                      </option>
                    ))}
                  </select>
                </div>

                {/* Qty Used per Sale */}
                <div className="sm:col-span-3">
                  <label htmlFor="newStockQtyInput" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Qty Deducted / Sale
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      id="newStockQtyInput"
                      type="number"
                      step="0.05"
                      min="0.01"
                      value={newStockQty}
                      onChange={(e) => setNewStockQty(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-center focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setNewStockQty(0.25)}
                        title="Quarter Sheet (Passport)"
                        className="px-1.5 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-blue-100 text-slate-700 dark:text-slate-300 rounded-lg"
                      >
                        ¼
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewStockQty(0.5)}
                        title="Half Sheet"
                        className="px-1.5 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-blue-100 text-slate-700 dark:text-slate-300 rounded-lg"
                      >
                        ½
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewStockQty(1)}
                        title="Full Unit"
                        className="px-1.5 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 hover:bg-blue-100 text-slate-700 dark:text-slate-300 rounded-lg"
                      >
                        1
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If Cash Outlay is selected */}
            {newDeductSource === 'petty_cash' && (
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label htmlFor="newCashSourceSelect" className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-amber-500" />
                    <span>Deduct From Cash Drawer / Account *</span>
                  </label>
                  <select
                    id="newCashSourceSelect"
                    value={newDeductLocation}
                    onChange={(e) => setNewDeductLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {CASH_SOURCES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Disbursement Outflow Amount (KES)
                  </label>
                  <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 font-semibold">
                    Linked to Material Cost: {formatMoney(newMaterial)} per transaction
                  </div>
                </div>
              </div>
            )}

            {/* If Labor Only is selected */}
            {newDeductSource === 'labor' && (
              <div className="pt-1 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Zero physical inventory or cash is deducted. Full transaction price accounts directly to service profit.</span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              id="addServiceSubmitBtn"
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-all focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              <span>Save Service to Rate Card</span>
            </button>
          </div>
        </form>
      </div>

      {/* Active Rate Card Catalog Table */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Rate Card Catalog</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Showing {filteredServices.length} of {services.length} services with live inventory deduction links
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Category */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === 'all' ? 'All Categories' : c}
                </option>
              ))}
            </select>

            {/* Filter by Where to Deduct From */}
            <select
              value={selectedDeductFilter}
              onChange={(e) => setSelectedDeductFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            >
              <option value="all">All Deduction Types</option>
              <option value="stock">📦 Deducts Stock Material</option>
              <option value="petty_cash">💵 Cash Outlay / Disbursement</option>
              <option value="labor">⚡ Labor / Zero Stock</option>
              <option disabled>──────────</option>
              <option value="loc:Main Cyber Counter">📍 Main Cyber Counter</option>
              <option value="loc:Stationery Display Shelf">📍 Stationery Display Shelf</option>
              <option value="loc:Laminating & Finishing Desk">📍 Laminating & Finishing Desk</option>
              <option value="loc:Photo Studio Counter">📍 Photo Studio Counter</option>
              <option value="loc:Back Store / Bulk Storage">📍 Back Store / Bulk</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search service, stock item..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                <th className="py-3 px-3">Service Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Selling Price</th>
                <th className="py-3 px-3 text-right">Material Cost</th>
                <th className="py-3 px-3 text-right">Unit Profit</th>
                <th className="py-3 px-3">Where to Deduct From & Stock Link</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredServices.map((srv) => {
                const profit = srv.price - srv.material;
                const margin = srv.price > 0 ? Math.round((profit / srv.price) * 100) : 100;
                const remaining = getRemainingStock(srv.stockItem);
                const isOutOfStock = remaining !== null && remaining <= 0;
                const isLowStock = remaining !== null && remaining > 0 && remaining <= 10;

                return (
                  <tr key={srv.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-900 dark:text-white block">{srv.name}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {srv.category || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-slate-900 dark:text-white">
                      {formatMoney(srv.price)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-slate-500">
                      {formatMoney(srv.material)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 block">
                        +{formatMoney(profit)}
                      </span>
                      <span className="text-[10px] text-slate-400">({margin}%)</span>
                    </td>
                    
                    {/* "Where to Deduct From" display badge */}
                    <td className="py-3 px-3">
                      {srv.deductStock && srv.stockItem ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                              <MapPin className="w-2.5 h-2.5" />
                              {srv.deductLocation || 'Main Cyber Counter'}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px]">
                              {srv.stockQty || 1} × {srv.stockItem}
                            </span>
                          </div>

                          {/* Live stock remaining status indicator */}
                          {remaining !== null && (
                            <div className="flex items-center gap-1 text-[10px]">
                              {isOutOfStock ? (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-bold">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Out of stock (0 {getStockItemUnit(srv.stockItem)})
                                </span>
                              ) : isLowStock ? (
                                <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                                  Low stock: {remaining} {getStockItemUnit(srv.stockItem)} left
                                </span>
                              ) : (
                                <span className="text-slate-400">
                                  Avail: {remaining} {getStockItemUnit(srv.stockItem)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : srv.deductSource === 'petty_cash' ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                          <Wallet className="w-3 h-3" />
                          <span>{srv.deductLocation || 'Cash Drawer'} ({formatMoney(srv.material)})</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Labor Only (Zero Stock)</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right">
                      {hasRole('admin') && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(srv)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Service & Deduction Link"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete service "${srv.name}" from Rate Card?`)) {
                                deleteService(srv.name);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Delete Service"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredServices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                    No services matching current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Service Modal with "Where to Deduct From" Configuration */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Configure Service</span>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Edit: {editingService.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingService(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Category, Price, Material */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="Printing & Copy">Printing & Copy</option>
                    <option value="Document Services">Document Services</option>
                    <option value="Government & E-Services">Government & E-Services</option>
                    <option value="Cyber & Online">Cyber & Online</option>
                    <option value="Photography">Photography</option>
                    <option value="Printing & Finishing">Printing & Finishing</option>
                    <option value="Stationery">Stationery</option>
                    <option value="Education Services">Education Services</option>
                    <option value="Media & Phone">Media & Phone</option>
                    <option value="Technical Repairs">Technical Repairs</option>
                    <option value="Other Service">Other Service</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Selling Price (KES)</label>
                  <input
                    type="number"
                    min="0"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Material Cost (KES)</label>
                  <input
                    type="number"
                    min="0"
                    value={editMaterial}
                    onChange={(e) => setEditMaterial(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  />
                </div>
              </div>

              {/* Deduction Destination Config */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white block">
                  Where to Deduct From:
                </span>

                {/* Radio Buttons for Source Mode */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditDeductSource('stock');
                      const cost = getStockItemCost(editStockItem);
                      if (cost > 0) setEditMaterial(cost);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      editDeductSource === 'stock'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    📦 Stock Inventory
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditDeductSource('petty_cash')}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      editDeductSource === 'petty_cash'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    💵 Cash Drawer
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditDeductSource('labor');
                      setEditMaterial(0);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                      editDeductSource === 'labor'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    ⚡ Labor Only
                  </button>
                </div>

                {/* Stock Controls */}
                {editDeductSource === 'stock' && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                        Deduct From Location / Shelf
                      </label>
                      <select
                        value={editDeductLocation}
                        onChange={(e) => setEditDeductLocation(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                      >
                        {availableLocations.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                      {editDeductLocation === 'Other (Custom Location)' && (
                        <input
                          type="text"
                          placeholder="Type custom location..."
                          value={editCustomLocation}
                          onChange={(e) => setEditCustomLocation(e.target.value)}
                          className="mt-1.5 w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Stock Material to Deduct
                        </label>
                        <select
                          value={editStockItem}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEditStockItem(val);
                            const cost = getStockItemCost(val);
                            if (cost > 0) setEditMaterial(cost);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        >
                          {stock.map((s) => (
                            <option key={s.name} value={s.name}>
                              {s.name} ({s.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Qty Used Per Sale
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.01"
                          value={editStockQty}
                          onChange={(e) => setEditStockQty(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Cash Outflow Controls */}
                {editDeductSource === 'petty_cash' && (
                  <div className="pt-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Cash Source
                    </label>
                    <select
                      value={editDeductLocation}
                      onChange={(e) => setEditDeductLocation(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold"
                    >
                      {CASH_SOURCES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Labor Only Controls */}
                {editDeductSource === 'labor' && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 pt-1 font-medium">
                    ✓ Labor-only service: No stock or cash will be deducted upon sale.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
