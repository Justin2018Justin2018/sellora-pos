import { GeneralSale, Transaction } from '../types/pos';

/**
 * The product POS (restaurant, bar, pharmacy, clothing, shop, guest house,
 * "other") records sales as GeneralSale. Receipts, the transaction ledger and
 * staff audits all speak `Transaction`, so convert rather than duplicating
 * every screen per business type.
 */
export const generalSaleToTransaction = (sale: GeneralSale): Transaction => {
  const items = sale.items || [];
  const cost = items.length
    ? items.reduce((sum, i) => sum + (i.buyingPrice || 0) * (i.qty || 0), 0)
    : Math.max(0, sale.total - (sale.profit || 0));

  return {
    id: sale.id,
    receipt: sale.receipt,
    service: items.map((i) => `${i.qty}x ${i.productName}`).join(', ') || 'Retail Sale',
    category: 'Retail',
    qty: items.reduce((sum, i) => sum + (i.qty || 1), 0) || 1,
    price: sale.total,
    subtotal: sale.subtotal || sale.total,
    discount: sale.discount || 0,
    material: 0,
    materialTotal: cost,
    profit: typeof sale.profit === 'number' ? sale.profit : sale.total - cost,
    total: sale.total,
    taxRate: sale.taxRate,
    taxAmount: sale.taxAmount,
    taxMode: sale.taxMode,
    taxName: sale.taxName,
    customer: sale.customer || 'Walk-in Customer',
    phone: sale.phone,
    payment: sale.payment,
    paid: sale.paid,
    change: sale.change,
    date: sale.date,
    staff: sale.staff || 'Cashier',
    status: sale.status,
    shopId: sale.shopId,
    services: items.map((i) => ({
      service: i.productName,
      qty: i.qty,
      price: i.unitPrice,
      total: i.total,
      material: 0,
      materialTotal: (i.buyingPrice || 0) * (i.qty || 0),
    })),
  } as Transaction;
};
