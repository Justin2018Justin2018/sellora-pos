import { getSupabase, isSupabaseConfigured } from './supabase';

/**
 * navigator.onLine only means "this device has an active network
 * interface" - it's true on a wifi network with no actual internet
 * access. This module backs it with a real, lightweight request against
 * Supabase to confirm genuine connectivity, as the offline spec requires.
 */

export type ConnectivityStatus = 'online' | 'offline' | 'checking';

type Listener = (status: ConnectivityStatus) => void;

let listeners: Listener[] = [];
let currentStatus: ConnectivityStatus = 'checking';
let pollTimer: ReturnType<typeof setInterval> | null = null;
let started = false;

const notify = (status: ConnectivityStatus) => {
  currentStatus = status;
  listeners.forEach((l) => l(status));
};

/** A real reachability check against Supabase, not just the browser's network-interface flag. */
export const checkRealConnectivity = async (): Promise<boolean> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return false;
  if (!isSupabaseConfigured()) return typeof navigator === 'undefined' ? true : navigator.onLine;

  const client = getSupabase();
  if (!client) return true;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const { error } = await client
      .from('saas_plans')
      .select('id', { head: true, count: 'exact' })
      .limit(1)
      .abortSignal(controller.signal);
    clearTimeout(timeout);
    return !error;
  } catch {
    return false;
  }
};

const runCheck = async () => {
  notify('checking');
  const ok = await checkRealConnectivity();
  notify(ok ? 'online' : 'offline');
};

/**
 * Starts monitoring connectivity: reacts instantly to the browser's
 * online/offline events, then verifies with a real request (since the
 * browser event alone can be wrong), and re-verifies periodically to
 * catch "connected but no real internet" cases the browser can't see on
 * its own. Call once near app startup; subsequent calls just add a
 * listener without starting duplicate timers.
 */
export const startConnectivityMonitor = (onChange: Listener): (() => void) => {
  listeners.push(onChange);
  onChange(currentStatus);

  if (!started) {
    started = true;
    window.addEventListener('online', runCheck);
    window.addEventListener('offline', () => notify('offline'));
    runCheck();
    pollTimer = setInterval(runCheck, 30000);
  }

  return () => {
    listeners = listeners.filter((l) => l !== onChange);
  };
};

export const getCurrentConnectivity = (): ConnectivityStatus => currentStatus;

/** Force an immediate re-check - used by the manual "Sync Now" button. */
export const recheckConnectivityNow = (): Promise<void> => runCheck();
