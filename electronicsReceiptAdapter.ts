import { ElectronicsSale, Transaction } from '../types/pos';

/**
 * Electronics sales are recorded in a different, flatter shape
 * (ElectronicsSale) than every other sale in the app (Transaction), which
 * is why they never had a receipt - the shared receipt system only knows
 * how to render a Transaction. Rather than duplicate that whole system
 * (3 print formats, barcode, WhatsApp share, PDF/HTML export) for one
 * more shape, this adapts an ElectronicsSale into a single-line-item
 * Transaction so it can reuse everything that already works.
 */
export function electronicsSaleToTransaction(sale: ElectronicsSale): Transaction {
  const lineDescription = [sale.brand, sale.product].filter(Boolean).join(' ') || sale.product;

  return {
    id: sale.id,
    receipt: sale.receipt,
    date: sale.date,
    customer: sale.customer || 'Walk-in Customer',
    phone: sale.phone,
    service: lineDescription,
    category: sale.category || 'Electronics',
    services: [
      {
        service: lineDescription,
        qty: sale.qty,
        price: sale.sell,
        material: sale.buy,
        total: sale.total,
        materialTotal: sale.cost,
      },
    ],
    qty: sale.qty,
    price: sale.sell,
    subtotal: sale.sell * sale.qty,
    discount: sale.discount || 0,
    total: sale.total,
    material: sale.buy,
    materialTotal: sale.cost,
    paid: sale.paid,
    change: sale.change,
    profit: sale.profit,
    payment: sale.payment,
    staff: sale.staff,
    status: 'completed',
    notes: [
      sale.serial ? `Serial/IMEI: ${sale.serial}` : '',
      sale.warranty ? `Warranty: ${sale.warranty}` : '',
    ]
      .filter(Boolean)
      .join(' | '),
  };
}
