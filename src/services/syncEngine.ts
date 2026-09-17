import { getSupabase, isSupabaseConfigured } from './supabase';
import {
  offlineDb,
  SyncQueueEntry,
  setLastSuccessfulSync,
} from './offlineDb';

/**
 * ------------------------------------------------------------------
 * Sync engine: processes the offline queue with exponential backoff.
 * ------------------------------------------------------------------
 * Sales now push for real: pos_transactions.id was migrated to a
 * UUID-compatible text column with a payload JSONB field (see the
 * pos_transactions_uuid_and_payload migration), so an offline-created
 * sale can be upserted by its localId safely and idempotently -
 * re-sending the same sale twice just re-upserts the same row, never
 * creates a duplicate.
 *
 * Debts, expenses, and customers also push for real - their tables
 * already used text/UUID primary keys.
 *
 * Stock movements are intentionally NOT pushed yet - there is no
 * `stock_movements` table in Supabase (stock is still a running
 * quantity), and moving to a movements-based model is a separate,
 * deliberate migration (needed for safe multi-device stock per the
 * offline spec) that hasn't been done yet.
 * ------------------------------------------------------------------
 */

const BACKOFF_SCHEDULE_MS = [30_000, 120_000, 300_000, 900_000, 1_800_000]; // 30s, 2m, 5m, 15m, 30m

const nextBackoffDelay = (attempts: number): number =>
  BACKOFF_SCHEDULE_MS[Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1)];

const ENTITIES_READY_TO_SYNC: SyncQueueEntry['entityType'][] = ['sale', 'debt', 'debtPayment', 'expense', 'customer'];

async function pushSale(localId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');
  const record = await offlineDb.sales.get(localId);
  if (!record) return;

  const p = record.payload as Record<string, any>;
  // Upsert by the client-generated UUID (id) - re-sending the same sale
  // twice (e.g. after a dropped connection mid-sync) just re-upserts the
  // same row, it can never create a duplicate. Rich, evolving fields
  // (discount, line items, profit, etc.) live in `payload`; the columns
  // below are just for fast reporting/filtering.
  const { error } = await client.from('pos_transactions').upsert({
    id: localId,
    shop_id: record.shopId,
    receipt: record.receipt,
    date: p.date || record.createdAt,
    customer: p.customer || 'Walk-in Customer',
    service: p.service || p.category || 'Sale',
    qty: p.qty ?? 1,
    unit_price: p.price ?? 0,
    total: p.total ?? 0,
    payment: p.payment || 'Cash',
    status: p.status || 'completed',
    staff: p.staff || record.userId || 'Unknown',
    notes: p.notes || null,
    material_cost: p.materialTotal ?? p.material ?? 0,
    payload: p,
    device_id: record.deviceId,
    synced_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// Every push below sets shop_id explicitly from the offline record's own
// SyncMeta.shopId, exactly like pushSale does - never from ...payload. A
// spread payload might be missing shop_id, might carry a stale one from
// before a business switch, or (once this layer is wired into the live
// create flows) might simply not be trusted to self-report which business
// it belongs to. shopId on the offline record is set once, at creation
// time, from the actual signed-in tenant - see offlineDb.ts.

async function pushDebt(localId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');
  const record = await offlineDb.debts.get(localId);
  if (!record) return;
  const { error } = await client.from('pos_debts').upsert({ ...record.payload, id: localId, shop_id: record.shopId });
  if (error) throw error;
}

async function pushExpense(localId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');
  const record = await offlineDb.expenses.get(localId);
  if (!record) return;
  const { error } = await client.from('pos_expenses').upsert({ ...record.payload, id: localId, shop_id: record.shopId });
  if (error) throw error;
}

async function pushCustomer(localId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');
  const record = await offlineDb.customers.get(localId);
  if (!record) return;
  const { error } = await client.from('pos_customers').upsert({ ...record.payload, id: localId, shop_id: record.shopId });
  if (error) throw error;
}

/**
 * Processes every due queue entry once. Safe to call repeatedly (e.g. on
 * an interval, on reconnect, or via the manual Sync Now button) - each
 * call only touches entries whose backoff window has actually elapsed.
 */
export async function processSyncQueue(): Promise<{ succeeded: number; failed: number; skipped: number }> {
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  if (!isSupabaseConfigured()) {
    return { succeeded, failed, skipped };
  }

  const now = new Date().toISOString();
  const dueEntries = await offlineDb.syncQueue
    .where('status')
    .anyOf('pending', 'failed')
    .filter((entry) => entry.nextAttemptAt <= now)
    .toArray();

  for (const entry of dueEntries) {
    if (!ENTITIES_READY_TO_SYNC.includes(entry.entityType)) {
      skipped++;
      continue;
    }

    await offlineDb.syncQueue.update(entry.id!, { status: 'syncing', lastAttemptAt: now });

    try {
      switch (entry.entityType) {
        case 'sale':
          await pushSale(entry.entityLocalId);
          await offlineDb.sales.update(entry.entityLocalId, { syncStatus: 'synced' });
          break;
        case 'debt':
          await pushDebt(entry.entityLocalId);
          await offlineDb.debts.update(entry.entityLocalId, { syncStatus: 'synced' });
          break;
        case 'expense':
          await pushExpense(entry.entityLocalId);
          await offlineDb.expenses.update(entry.entityLocalId, { syncStatus: 'synced' });
          break;
        case 'customer':
          await pushCustomer(entry.entityLocalId);
          await offlineDb.customers.update(entry.entityLocalId, { syncStatus: 'synced' });
          break;
        default:
          break;
      }

      await offlineDb.syncQueue.update(entry.id!, { status: 'synced' });
      succeeded++;
    } catch (err) {
      const attempts = entry.attempts + 1;
      const delay = nextBackoffDelay(attempts);
      const nextAttemptAt = new Date(Date.now() + delay).toISOString();
      await offlineDb.syncQueue.update(entry.id!, {
        status: 'failed',
        attempts,
        nextAttemptAt,
        errorMessage: err instanceof Error ? err.message : 'Unknown sync error',
      });
      failed++;
    }
  }

  if (succeeded > 0) {
    await setLastSuccessfulSync(new Date().toISOString());
  }

  return { succeeded, failed, skipped };
}

/** Enqueues a piece of offline work. Called by the entity-specific "create while offline" helpers (Stage B). */
export async function enqueueSync(
  entityType: SyncQueueEntry['entityType'],
  entityLocalId: string,
  operation: SyncQueueEntry['operation']
): Promise<void> {
  await offlineDb.syncQueue.add({
    entityType,
    entityLocalId,
    operation,
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
    status: 'pending',
  });
}
