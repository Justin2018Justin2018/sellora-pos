import { getSupabase, isSupabaseConfigured } from './supabase';
import {
  offlineDb,
  SyncQueueEntry,
  setLastSuccessfulSync,
} from './offlineDb';
import { nextBackoffDelay, classifySyncError, isStaleSyncing } from './syncPolicy';

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

const ENTITIES_READY_TO_SYNC: SyncQueueEntry['entityType'][] = ['sale', 'debt', 'debtPayment', 'expense', 'customer', 'printJob'];

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

async function pushPrintJob(localId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Supabase not configured');
  const record = await offlineDb.printJobs.get(localId);
  if (!record) return;
  // Upsert by the device-generated id: re-sending can never create a second job row.
  const { error } = await client.from('print_jobs').upsert({ ...record.payload, id: localId, shop_id: record.shopId }, { onConflict: 'id' });
  if (error) throw error;
}

let inFlight: Promise<{ succeeded: number; failed: number; skipped: number }> | null = null;

/**
 * Processes every due queue entry once. Safe to call repeatedly (interval, reconnect, Sync Now,
 * after a sale): overlapping calls share one run, so the same job is never pushed by two loops.
 * Each entry is only marked synced AFTER the server confirms the write.
 */
export function processSyncQueue(): Promise<{ succeeded: number; failed: number; skipped: number }> {
  if (inFlight) return inFlight;
  inFlight = runSyncQueue().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSyncQueue(): Promise<{ succeeded: number; failed: number; skipped: number }> {
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  if (!isSupabaseConfigured()) {
    return { succeeded, failed, skipped };
  }

  // Entries left in 'syncing' by a tab that closed mid-request would otherwise never be picked up again.
  const nowMs = Date.now();
  const stranded = await offlineDb.syncQueue.where('status').equals('syncing').filter((e) => isStaleSyncing(e, nowMs)).toArray();
  for (const e of stranded) {
    await offlineDb.syncQueue.update(e.id!, { status: 'pending', nextAttemptAt: new Date(nowMs).toISOString() });
  }

  const now = new Date().toISOString();
  const dueEntries = await offlineDb.syncQueue
    .where('status')
    .anyOf('pending', 'failed')
    // 'permanent' failures are not auto-retried; they wait for retryFailedEntries() after the cause is fixed.
    .filter((entry) => entry.nextAttemptAt <= now && entry.errorKind !== 'permanent')
    .toArray();

  for (const entry of dueEntries) {
    if (!ENTITIES_READY_TO_SYNC.includes(entry.entityType)) {
      skipped++;
      continue;
    }

    await offlineDb.syncQueue.update(entry.id!, { status: 'syncing', lastAttemptAt: now });

    try {
      if (entry.operation !== 'CREATE') {
        // Only create/upsert is implemented. Never pretend an UPDATE/DELETE reached the server.
        throw Object.assign(new Error(`Unsupported sync operation ${entry.operation} for ${entry.entityType}`), { code: 'PGRST204' });
      }
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
        case 'printJob':
          await pushPrintJob(entry.entityLocalId);
          await offlineDb.printJobs.update(entry.entityLocalId, { syncStatus: 'synced' });
          break;
        default:
          break;
      }

      await offlineDb.syncQueue.update(entry.id!, { status: 'synced', errorMessage: undefined, errorKind: undefined });
      succeeded++;
    } catch (err) {
      const attempts = entry.attempts + 1;
      const classified = classifySyncError(err);
      // 'blocked' (auth/subscription) retries at the slowest cadence; 'permanent' stops auto-retry.
      const delay = classified.kind === 'blocked' ? nextBackoffDelay(99) : nextBackoffDelay(attempts);
      const nextAttemptAt = new Date(Date.now() + delay).toISOString();
      await offlineDb.syncQueue.update(entry.id!, {
        status: 'failed',
        attempts,
        nextAttemptAt,
        errorMessage: classified.message,
        errorKind: classified.kind,
      });
      // Reflect the failure on the record itself so the UI counts it as failed, not pending.
      const table = tableFor(entry.entityType);
      if (table) await table.update(entry.entityLocalId, { syncStatus: 'failed' } as never).catch(() => 0);
      failed++;
    }
  }

  if (succeeded > 0) {
    await setLastSuccessfulSync(new Date().toISOString());
  }

  return { succeeded, failed, skipped };
}

function tableFor(type: SyncQueueEntry['entityType']) {
  switch (type) {
    case 'sale': return offlineDb.sales;
    case 'debt': return offlineDb.debts;
    case 'expense': return offlineDb.expenses;
    case 'customer': return offlineDb.customers;
    case 'printJob': return offlineDb.printJobs;
    default: return null;
  }
}

/** Makes every failed (including permanent) entry eligible again - use after applying a migration or signing in. */
export async function retryFailedEntries(): Promise<number> {
  const failed = await offlineDb.syncQueue.where('status').equals('failed').toArray();
  const nowIso = new Date().toISOString();
  for (const e of failed) {
    await offlineDb.syncQueue.update(e.id!, { status: 'pending', nextAttemptAt: nowIso, errorKind: undefined });
  }
  return failed.length;
}

/**
 * Removes a sale that was deleted locally from the offline store AND the queue so a still-pending
 * job can never "resurrect" it in the cloud. Scoped by shop and receipt. Returns how many local
 * offline sales were removed.
 */
export async function purgeOfflineSaleByReceipt(shopId: string, receipt: string): Promise<number> {
  const rows = await offlineDb.sales.where('shopId').equals(shopId).filter((r) => r.receipt === receipt).toArray();
  for (const r of rows) {
    await offlineDb.syncQueue.where('entityLocalId').equals(r.localId).delete();
    await offlineDb.sales.delete(r.localId);
  }
  return rows.length;
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
