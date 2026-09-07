import React, { useState } from 'react';
import { usePOS } from '../../context/POSContext';
import { Truck, Plus, Boxes, CheckCircle2, X } from 'lucide-react';

export const GeneralPurchasesView: React.FC = () => {
  const {
    generalProducts,
    generalSuppliers,
    generalPurchases,
    recordGeneralPurchase,
    formatMoney,
    addToast
  } = usePOS();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(generalProducts[0]?.id || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState(generalSuppliers[0]?.id || '');
  const [qty, setQty] = useState<number>(10);
  const [buyingPrice, setBuyingPrice] = useState<number>(0);

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const found = generalProducts.find((p) => p.id === prodId);
    if (found) {
      setBuyingPrice(found.buyingPrice);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const product = generalProducts.find((p) => p.id === selectedProductId);
    const supplier = generalSuppliers.find((s) => s.id === selectedSupplierId);

    if (!product) {
      addToast({ type: 'error', title: 'Select Product', message: 'Choose a valid product to restock.' });
      return;
    }

    recordGeneralPurchase({
      supplierId: supplier?.id || 'sup_default',
      supplierName: supplier?.name || 'General Supplier',
      productId: product.id,
      productName: product.name,
      qty: Number(qty),
      buyingPrice: Number(buyingPrice),
      totalCost: Number(qty) * Number(buyingPrice),
      staff: 'Current Staff',
    });

    addToast({ type: 'success', title: 'Stock Purchase Recorded', message: `Added ${qty} units of ${product.name}.` });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            Stock Purchases & Restocking
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Record stock arrivals from suppliers and update inventory levels and buying costs.
          </p>
        </div>

        <button
          onClick={() => {
            if (generalProducts.length > 0) handleProductChange(generalProducts[0].id);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm shadow-md flex items-center gap-2 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Record Stock Purchase</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Qty Added</th>
                <th className="py-3 px-4">Buying Price</th>
                <th className="py-3 px-4">Total Cost</th>
                <th className="py-3 px-4">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
              {generalPurchases.map((pur) => (
                <tr key={pur.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                    {new Date(pur.date).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{pur.supplierName}</td>
                  <td className="py-3.5 px-4 font-semibold text-purple-600">{pur.productName}</td>
                  <td className="py-3.5 px-4 font-bold">+{pur.qty}</td>
                  <td className="py-3.5 px-4">{formatMoney(pur.buyingPrice)}</td>
                  <td className="py-3.5 px-4 font-black text-slate-900 dark:text-white">{formatMoney(pur.totalCost)}</td>
                  <td className="py-3.5 px-4 text-xs text-slate-500">{pur.staff}</td>
                </tr>
              ))}

              {generalPurchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">No stock purchases recorded yet</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h3 className="font-bold text-white text-base">Record Stock Purchase</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Supplier</label>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-purple-500"
                >
                  {generalSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Product</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-hidden focus:border-purple-500"
                >
                  {generalProducts.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (In Stock: {p.quantity} {p.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quantity Added *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Buying Price (KSh) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={buyingPrice}
                    onChange={(e) => setBuyingPrice(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 text-xs text-slate-400">
                Total Purchase Cost: <span className="font-black text-white">{formatMoney(qty * buyingPrice)}</span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-sm font-bold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-sm font-bold text-white shadow-lg"
                >
                  Confirm Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
