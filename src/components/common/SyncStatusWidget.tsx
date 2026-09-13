import React, { useEffect, useState, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { startConnectivityMonitor, recheckConnectivityNow, getCurrentConnectivity, ConnectivityStatus } from '../../services/connectivity';
import { getSyncCounts, getLastSuccessfulSync } from '../../services/offlineDb';
import { processSyncQueue } from '../../services/syncEngine';

/**
 * A small, collapsible status indicator - never a full-screen blocker.
 * The connectivity detection here is fully live today. The sync counts
 * will read 0/0/0/0 until Stage B wires real offline writes into the
 * queue (see syncEngine.ts) - that's expected, not a bug, at this stage.
 */
export const SyncStatusWidget: React.FC = () => {
  const [status, setStatus] = useState<ConnectivityStatus>('checking');
  const [counts, setCounts] = useState({ pending: 0, syncing: 0, failed: 0, synced: 0 });
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refreshCounts = useCallback(async () => {
    const [c, last] = await Promise.all([getSyncCounts(), getLastSuccessfulSync()]);
    setCounts(c);
    setLastSync(last);
  }, []);

  useEffect(() => {
    let wasOffline = false;
    let autoSyncTimer: ReturnType<typeof setInterval> | null = null;

    const stop = startConnectivityMonitor((s) => {
      setStatus((prevStatus) => {
        // Reconnected after being offline - sync automatically, no
        // manual action or page refresh required.
        if (s === 'online' && (prevStatus === 'offline' || wasOffline)) {
          processSyncQueue().finally(refreshCounts);
        }
        wasOffline = s === 'offline';
        return s;
      });
    });

    refreshCounts();
    const countsInterval = setInterval(refreshCounts, 15000);
    // Also periodically nudge the queue while online, in case something
    // was queued after the last reconnect event (e.g. a sale made while
    // already online, whose immediate sync attempt failed).
    autoSyncTimer = setInterval(() => {
      if (getCurrentConnectivity() === 'online') {
        processSyncQueue().finally(refreshCounts);
      }
    }, 60000);

    return () => {
      stop();
      clearInterval(countsInterval);
      if (autoSyncTimer) clearInterval(autoSyncTimer);
    };
  }, [refreshCounts]);

  const handleSyncNow = async () => {
    setSyncing(true);
    await recheckConnectivityNow();
    await processSyncQueue();
    await refreshCounts();
    setSyncing(false);
  };

  const hasPendingWork = counts.pending + counts.syncing + counts.failed > 0;

  const badge = (() => {
    if (status === 'offline') return { icon: WifiOff, label: 'OFFLINE — Working locally', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-900' };
    if (status === 'checking') return { icon: RefreshCw, label: 'Checking connection…', color: 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700' };
    if (counts.failed > 0) return { icon: AlertTriangle, label: 'SYNC ERROR — Some data pending', color: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-900' };
    if (hasPendingWork) return { icon: RefreshCw, label: 'SYNCING — Uploading data', color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-900' };
    return { icon: Wifi, label: 'ONLINE — Synced', color: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900' };
  })();

  const Icon = badge.icon;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)]">
      <div className={`rounded-2xl border shadow-lg backdrop-blur-sm ${badge.color} transition-all`}>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold w-full"
        >
          <Icon className={`w-3.5 h-3.5 shrink-0 ${status === 'checking' || syncing ? 'animate-spin' : ''}`} />
          <span className="whitespace-nowrap">{badge.label}</span>
          {expanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronUp className="w-3 h-3 ml-auto" />}
        </button>

        {expanded && (
          <div className="px-3.5 pb-3 pt-1 border-t border-current/10 space-y-1.5 text-[11px] font-medium">
            <div className="flex justify-between gap-6">
              <span className="opacity-70">Last successful sync:</span>
              <span>{lastSync ? new Date(lastSync).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never yet'}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="opacity-70">Pending:</span>
              <span>{counts.pending}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="opacity-70">Syncing:</span>
              <span>{counts.syncing}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="opacity-70">Failed:</span>
              <span>{counts.failed}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="opacity-70">Synced:</span>
              <span>{counts.synced}</span>
            </div>
            <button
              onClick={handleSyncNow}
              disabled={syncing || status === 'offline'}
              className="w-full mt-2 py-1.5 rounded-lg bg-current/10 hover:bg-current/20 disabled:opacity-50 font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              <span>SYNC NOW</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
