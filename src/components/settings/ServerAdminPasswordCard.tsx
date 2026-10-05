import React, { useCallback, useEffect, useState } from 'react';
import { Lock, ShieldCheck, ShieldAlert } from 'lucide-react';
import { usePOS } from '../../context/POSContext';
import {
  isSupabaseConfigured,
  hasSupabaseSession,
  getShopAdminSecretStatus,
  setShopAdminSecretRemote,
} from '../../services/supabase';

/**
 * Sets the SERVER-verified administrator password used to delete synced sales (see supabase-schema-v6).
 * Only the shop owner can set it (enforced by the database). The password is sent over TLS to Postgres, stored there as a
 * bcrypt hash and is never kept in this browser.
 */
export const ServerAdminPasswordCard: React.FC = () => {
  const { currentShop, addToast } = usePOS();
  const currentShopId = currentShop.id;
  const [state, setState] = useState<'loading' | 'unavailable' | 'signed_out' | 'ready'>('loading');
  const [configured, setConfigured] = useState(false);
  const [detail, setDetail] = useState('');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) { setState('unavailable'); return; }
    if (!(await hasSupabaseSession())) { setState('signed_out'); return; }
    const res = await getShopAdminSecretStatus(currentShopId);
    if (res.status === 'ok') { setConfigured(!!res.configured); setState('ready'); return; }
    setDetail(res.status === 'not_deployed' ? 'Database update v6 has not been applied yet.' : res.message || res.status);
    setState('unavailable');
  }, [currentShopId]);

  useEffect(() => { refresh(); }, [refresh]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (next.trim().length < 6) { addToast({ type: 'error', title: 'Password Too Short', message: 'Use at least 6 characters.' }); return; }
    if (next !== confirm) { addToast({ type: 'error', title: 'Passwords Do Not Match' }); return; }
    setBusy(true);
    const res = await setShopAdminSecretRemote(currentShopId, next, configured ? current : undefined);
    setBusy(false);
    const messages: Record<string, string> = {
      invalid: 'The current server admin password is incorrect.',
      locked: 'Too many wrong attempts. Try again in 15 minutes.',
      forbidden: 'Only the shop owner can set the server admin password.',
      weak: 'Use at least 6 characters.',
      not_deployed: 'Database update v6 has not been applied yet.',
      offline: 'No connection to the server.',
    };
    if (res.status === 'ok') {
      setCurrent(''); setNext(''); setConfirm('');
      addToast({ type: 'success', title: 'Server Admin Password Saved' });
      refresh();
    } else {
      addToast({ type: 'error', title: 'Not Saved', message: messages[res.status] || res.message || 'The server rejected the change.' });
    }
  };

  const input = 'w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono';
  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 mb-2">
        {configured && state === 'ready'
          ? <ShieldCheck className="w-4 h-4 text-emerald-600" />
          : <ShieldAlert className="w-4 h-4 text-amber-600" />}
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Server Admin Password (cloud sales)</h3>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
        Verified by the database, not by this device. Needed to delete sales that have synced to the cloud. Separate from the
        device password above, which only protects records that never left this device.
      </p>

      {state === 'loading' && <p className="text-xs text-slate-400">Checking…</p>}
      {state === 'unavailable' && (
        <p className="text-xs text-slate-500">Cloud authorization is not available{detail ? `: ${detail}` : ' (cloud is not configured).'}</p>
      )}
      {state === 'signed_out' && (
        <p className="text-xs text-amber-700 dark:text-amber-400">Sign in to the cloud account to manage the server admin password.</p>
      )}
      {state === 'ready' && (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            Status: {configured ? 'set' : 'NOT SET - synced sales cannot be deleted until the owner sets it'}
          </p>
          {configured && (
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current server admin password" className={input} autoComplete="current-password" />
          )}
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="New password (min 6 characters)" className={input} autoComplete="new-password" />
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password" className={input} autoComplete="new-password" />
          <button
            type="submit"
            disabled={busy || !next.trim() || !confirm.trim() || (configured && !current.trim())}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-rose-600 dark:hover:bg-rose-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{busy ? 'Saving…' : configured ? 'Change Server Admin Password' : 'Set Server Admin Password'}</span>
          </button>
        </form>
      )}
    </div>
  );
};
