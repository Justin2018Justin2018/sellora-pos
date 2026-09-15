import Dexie, { Table } from 'dexie';

/**
 * ------------------------------------------------------------------
 * Offline-first local database (IndexedDB via Dexie)
 * ------------------------------------------------------------------
 * This is STAGE A of the offline-first rollout: the local storage layer
 * and sync queue plumbing exist here, independently testable, but are
 * NOT YET wired into the live sale/stock/debt/expense creation flows in
 * POSContext.tsx. That's a deliberate, separate step (Stage B) done one
 * entity at a time with real testing after each - see the accompanying
 * report for why.
 *
 * Every record carries the fields the offline spec requires: a
 * device-generated UUID (localId), created/updated timestamps, a
 * sync_status, the device that created it, and the shop it belongs to
 * (shopId is what Supabase RLS checks - never trust a business_id sent
 * from the client without this same shop-scoping being enforced
 * server-side too, which it already is via the existing RLS policies).
 * ------------------------------------------------------------------
 */

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';
export type SyncOperation = 'CREATE' | 'UPDATE' | 'DELETE';

interface SyncMeta {
  /** Device-generated UUID. This is the identity of the record everywhere - local and server. */
  localId: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  deviceId: string;
  userId?: string;
  shopId: string;
}

/** A completed sale, stored immediately on creation regardless of connectivity. */
export interface OfflineSale extends SyncMeta {
  receipt: string;
  /** The full sale record shape already used elsewhere in the app (Transaction/GeneralSale/etc). Kept flexible so this layer doesn't need to know every business type's exact shape. */
  payload: Record<string, unknown>;
}

/**
 * A stock change, stored as a MOVEMENT (delta), not a final quantity.
 * This is what makes multi-device stock safe: two devices each applying
 * "-5" and "-10" merge correctly; two devices each overwriting "final
 * stock = 85" would silently clobber each other.
 */
export interface OfflineStockMovement extends SyncMeta {
  itemName: string;
  quantityDelta: number;
  reason: 'SALE' | 'RESTOCK' | 'WASTAGE' | 'ADJUSTMENT' | 'RETURN';
  relatedSaleLocalId?: string;
  notes?: string;
}

export interface OfflineDebt extends SyncMeta {
  payload: Record<string, unknown>;
}

export interface OfflineDebtPayment extends SyncMeta {
  debtLocalId: string;
  amount: number;
  payload: Record<string, unknown>;
}

export interface OfflineExpense extends SyncMeta {
  payload: Record<string, unknown>;
}

export interface OfflineCustomer extends SyncMeta {
  payload: Record<string, unknown>;
}

/**
 * The sync queue. Every offline-created record also gets a queue entry
 * describing the work still to do. Processed with exponential backoff
 * (see syncEngine.ts) so a flaky connection doesn't hammer Supabase.
 */
export interface SyncQueueEntry {
  id?: number;
  entityType: 'sale' | 'stockMovement' | 'debt' | 'debtPayment' | 'expense' | 'customer';
  entityLocalId: string;
  operation: SyncOperation;
  createdAt: string;
  attempts: number;
  lastAttemptAt?: string;
  /** When this entry becomes eligible to retry again (exponential backoff). */
  nextAttemptAt: string;
  errorMessage?: string;
  status: SyncStatus;
}

interface MetaEntry {
  key: string;
  value: string;
}

class SelloraOfflineDb extends Dexie {
  sales!: Table<OfflineSale, string>;
  stockMovements!: Table<OfflineStockMovement, string>;
  debts!: Table<OfflineDebt, string>;
  debtPayments!: Table<OfflineDebtPayment, string>;
  expenses!: Table<OfflineExpense, string>;
  customers!: Table<OfflineCustomer, string>;
  syncQueue!: Table<SyncQueueEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('sellora_offline_db');
    this.version(1).stores({
      sales: 'localId, shopId, syncStatus, createdAt, receipt',
      stockMovements: 'localId, shopId, syncStatus, createdAt, itemName',
      debts: 'localId, shopId, syncStatus, createdAt',
      debtPayments: 'localId, shopId, syncStatus, createdAt, debtLocalId',
      expenses: 'localId, shopId, syncStatus, createdAt',
      customers: 'localId, shopId, syncStatus, createdAt',
      syncQueue: '++id, entityType, entityLocalId, status, createdAt, nextAttemptAt',
      meta: 'key',
    });
  }
}

export const offlineDb = new SelloraOfflineDb();

/** One UUID per browser/device install, persisted forever - used to tag every record with where it was created. */
export const getDeviceId = async (): Promise<string> => {
  const existing = await offlineDb.meta.get('deviceId');
  if (existing) return existing.value;
  const id = crypto.randomUUID();
  await offlineDb.meta.put({ key: 'deviceId', value: id });
  return id;
};

export const generateLocalId = (): string => crypto.randomUUID();

export const getLastSuccessfulSync = async (): Promise<string | null> => {
  const entry = await offlineDb.meta.get('lastSuccessfulSync');
  return entry?.value ?? null;
};

export const setLastSuccessfulSync = async (iso: string): Promise<void> => {
  await offlineDb.meta.put({ key: 'lastSuccessfulSync', value: iso });
};

/** Counts for the sync status panel - pending/syncing/failed/synced across every entity table. */
export const getSyncCounts = async (): Promise<{
  pending: number;
  syncing: number;
  failed: number;
  synced: number;
}> => {
  const tables = [offlineDb.sales, offlineDb.stockMovements, offlineDb.debts, offlineDb.debtPayments, offlineDb.expenses, offlineDb.customers];
  const counts = { pending: 0, syncing: 0, failed: 0, synced: 0 };
  for (const table of tables) {
    const [pending, syncing, failed, synced] = await Promise.all([
      table.where('syncStatus').equals('pending').count(),
      table.where('syncStatus').equals('syncing').count(),
      table.where('syncStatus').equals('failed').count(),
      table.where('syncStatus').equals('synced').count(),
    ]);
    counts.pending += pending;
    counts.syncing += syncing;
    counts.failed += failed;
    counts.synced += synced;
  }
  return counts;
};
