/**
 * Pure retry / error-classification rules for the offline sync queue.
 * Kept free of Dexie/Supabase imports so it can be unit-tested directly.
 */

export const BACKOFF_SCHEDULE_MS = [30_000, 120_000, 300_000, 900_000, 1_800_000]; // 30s, 2m, 5m, 15m, 30m
/** A queue entry stuck in 'syncing' longer than this (tab closed mid-request) is returned to the queue. */
export const STALE_SYNCING_MS = 2 * 60_000;

export const nextBackoffDelay = (attempts: number): number =>
  BACKOFF_SCHEDULE_MS[Math.max(0, Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1))];

export type SyncErrorKind = 'transient' | 'permanent' | 'blocked';

export interface ClassifiedSyncError {
  kind: SyncErrorKind;
  message: string;
}

interface ErrLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

/**
 * transient  - network / server hiccup: retry with backoff.
 * blocked    - authorisation or subscription refusal (RLS 42501, 401/403): keep the job, retry slowly,
 *              surface to the user; it may succeed after sign-in or renewal.
 * permanent  - the server will never accept this payload as sent (constraint, type or schema error):
 *              stop auto-retrying, keep the job for manual review/retry, show an actionable message.
 */
export function classifySyncError(err: unknown): ClassifiedSyncError {
  const e = (err && typeof err === 'object' ? err : {}) as ErrLike;
  const code = e.code ?? '';
  const raw = e.message || (err instanceof Error ? err.message : '') || 'Unknown sync error';

  if (code === '42501' || e.status === 401 || e.status === 403 || code === 'PGRST301' || /row-level security|jwt expired/i.test(raw)) {
    return { kind: 'blocked', message: `Not authorised to sync this record (${raw}). Sign in again or check the subscription.` };
  }
  if (code.startsWith('23')) {
    return { kind: 'permanent', message: `Rejected by a database constraint (${raw}).` };
  }
  if (code.startsWith('22') || code === '42703' || code === '42P01' || code === 'PGRST204' || code === 'PGRST205') {
    return { kind: 'permanent', message: `Server schema does not match this record (${raw}). Apply the latest SQL migrations.` };
  }
  return { kind: 'transient', message: raw };
}

export interface QueueEntryLike {
  status: string;
  lastAttemptAt?: string;
}

export const isStaleSyncing = (entry: QueueEntryLike, nowMs: number): boolean =>
  entry.status === 'syncing' &&
  (!entry.lastAttemptAt || nowMs - new Date(entry.lastAttemptAt).getTime() > STALE_SYNCING_MS);
