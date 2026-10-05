import { GasTransaction, Transaction } from '../types/pos';

/** Adapts a gas refill into a single-line Transaction so the shared receipt system (print/PDF/share) can render it. */
export function gasRefillToTransaction(g: GasTransaction): Transaction {
  const description = `Gas Refill ${g.brand} ${g.size}`.trim();
  const materialTotal = g.cost * g.qty;
  return {
    id: g.id,
    receipt: g.receipt,
    date: g.date,
    customer: g.customer || 'Walk-in Customer',
    phone: g.phone,
    service: description,
    category: 'Gas',
    services: [{ service: description, qty: g.qty, price: g.price, material: g.cost, total: g.total, materialTotal }],
    qty: g.qty,
    price: g.price,
    subtotal: g.total,
    discount: 0,
    total: g.total,
    material: g.cost,
    materialTotal,
    paid: g.paid,
    change: 0,
    profit: g.profit,
    payment: g.payment,
    staff: g.staff,
    shopId: g.shopId,
    status: 'completed',
  };
}
