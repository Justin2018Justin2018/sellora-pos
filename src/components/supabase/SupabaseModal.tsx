import React, { useState, useEffect } from 'react';
import {
  isSupabaseConfigured,
  testSupabaseConnection,
  getSupabaseProjectDisplay,
  fetchTransactionsFromSupabase,
  syncTransactionToSupabase,
  syncStockToSupabase,
  getCurrentSupabaseUser,
  signInShopAccount,
  signUpShopAccount,
  signOutSupabaseUser
} from '../../services/supabase';
// Pull the SQL straight from the real migration files instead of hand-copying
// a snippet in here - a hand-copied snippet is exactly how this modal ended
// up shipping the old "allow anon all" policies after the security fix
// migration had already replaced them everywhere else.
import baseSchemaSql from '@/supabase-schema.sql?raw';
import securityFixSql from '@/supabase-schema-v2-security-fix.sql?raw';
import { usePOS } from '../../context/POSContext';
import { useAuth } from '../../context/AuthContext';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  X,
  UploadCloud,
  DownloadCloud,
  Sparkles
} from 'lucide-react';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Matches AuthGate's slugify exactly - a shop_id claimed here must land in
// the same id space as one claimed through the main sign-up screen. Never
// derive this id from a local UI concept like the till/branch selector
// (see the business-isolation audit for what that bug looked like).
const slugifyShopName = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || `shop-${Date.now()}`;
};

export const SupabaseModal: React.FC<SupabaseModalProps> = ({ isOpen, onClose }) => {
  const { transactions, stock, profile, addToast } = usePOS();
  // The REAL tenant id (shop_members.shop_id, checked by every RLS policy).
  // Deliberately NOT `currentShop` from usePOS() - that's a local
  // branch/till selector (defaults to the literal string "shop_main" for
  // every install) and is a completely different concept that happens to
  // share the word "shop". Using it here used to mean every Supabase call
  // in this modal ran against the wrong id and was silently rejected by
  // RLS for any real tenant. See the business-isolation audit.
  const { shopId: authShopId } = useAuth();

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testResult, setTestResult] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    tableReady?: boolean;
  }>({
    tested: false,
    success: false,
    message: '',
  });
  const [copiedSchema, setCopiedSchema] = useState(false);

  // --- Auth state ---
  // Cloud sync now requires a real signed-in Supabase user, because the
  // database's Row Level Security policies only grant access to
  // `authenticated` users who are members of the current shop. Without
  // this, the anon key alone (visible in the browser bundle) could no
  // longer read or write any data - which is the point.
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isConfigured = isSupabaseConfigured();
  const projectHost = getSupabaseProjectDisplay();
  const isSignedIn = Boolean(authUserId);

  useEffect(() => {
    if (isOpen && isConfigured) {
      getCurrentSupabaseUser().then((user) => {
        setAuthUserId(user?.id ?? null);
        setAuthChecked(true);
      });
    }
  }, [isOpen, isConfigured]);

  useEffect(() => {
    if (isOpen && isConfigured && isSignedIn && !testResult.tested) {
      handleTestConnection();
    }
  }, [isOpen, isConfigured, isSignedIn]);

  const handleAuthSubmit = async () => {
    if (!authEmail || !authPassword) {
      setAuthError('Enter an email and password.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      // This modal should normally be unreachable while signed out - the
      // app-level AuthGate already requires sign-in (and a claimed shop)
      // before POSProvider/this modal ever mount. If it's somehow reached
      // anyway (e.g. a session expiring mid-session), signing up here MUST
      // still claim a real, unique tenant id - never the till/branch
      // selector, which is the same literal default for every install and
      // is a completely different concept from a shop_id.
      const result =
        authMode === 'signup'
          ? await signUpShopAccount(authEmail, authPassword, slugifyShopName(profile.name))
          : await signInShopAccount(authEmail, authPassword);

      if (!result.success) {
        setAuthError(result.message);
        return;
      }
      const user = await getCurrentSupabaseUser();
      setAuthUserId(user?.id ?? null);
      if (user) {
        addToast({ type: 'success', title: 'Signed in', message: result.message });
      } else {
        addToast({ type: 'success', title: 'Check your email', message: result.message });
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutSupabaseUser();
    setAuthUserId(null);
    setTestResult({ tested: false, success: false, message: '' });
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const res = await testSupabaseConnection();
      setTestResult({
        tested: true,
        success: res.success,
        message: res.message,
        tableReady: res.tableReady,
      });
      if (res.success) {
        addToast({
          type: 'success',
          title: 'Supabase Connected',
          message: res.message,
        });
      } else {
        addToast({
          type: 'warning',
          title: 'Supabase Notice',
          message: res.message,
        });
      }
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncAllToCloud = async () => {
    if (!isConfigured) {
      addToast({
        type: 'error',
        title: 'Supabase Not Configured',
        message: 'Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sync.',
      });
      return;
    }
    if (!isSignedIn || !authShopId) {
      addToast({
        type: 'error',
        title: 'Sign In Required',
        message: 'Sign in to your shop account before syncing to the cloud.',
      });
      return;
    }

    setIsSyncing(true);
    try {
      // Sync stock
      await syncStockToSupabase(stock, authShopId);
      // Sync last 50 transactions
      let syncedCount = 0;
      for (const tx of transactions.slice(0, 50)) {
        const ok = await syncTransactionToSupabase(tx, authShopId);
        if (ok) syncedCount++;
      }

      addToast({
        type: 'success',
        title: 'Cloud Sync Complete',
        message: `Pushed ${syncedCount} sales records and ${stock.length} inventory items to Supabase.`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Sync Error',
        message: err?.message || 'Failed to sync all records to Supabase.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Both files, concatenated in the order they must be run: the base
  // schema first, then the security-fix migration that locks it down to
  // authenticated, shop-scoped access. Sourced directly from the real
  // .sql files (see imports above) so this can't drift out of sync with
  // them again.
  const sqlSchemaSnippet = `${baseSchemaSql.trim()}\n\n${securityFixSql.trim()}`;

  const handleCopySchema = () => {
    navigator.clipboard.writeText(sqlSchemaSnippet);
    setCopiedSchema(true);
    addToast({
      type: 'info',
      title: 'SQL Schema Copied',
      message: 'Paste into Supabase SQL Editor and click Run (includes the security-fix migration).',
    });
    setTimeout(() => setCopiedSchema(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>Supabase PostgreSQL Cloud</span>
                {isConfigured ? (
                  <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    ONLINE
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    STANDALONE / LOCAL
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Persistent relational storage & multi-branch synchronization
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status Box */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Supabase Project Target
              </span>
              <span className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                {projectHost}
              </span>
            </div>

            {testResult.tested && (
              <div
                className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${
                  testResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                )}
                <div>
                  <p className="font-semibold">{testResult.message}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Pinging Supabase...' : 'Test Connection'}</span>
              </button>

              <button
                onClick={handleSyncAllToCloud}
                disabled={isSyncing || !isConfigured || !isSignedIn}
                className="flex-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors shadow-xs disabled:opacity-50"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${isSyncing ? 'animate-bounce' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Data to Cloud'}</span>
              </button>
            </div>
          </div>

          {/* Account sign-in gate - required for cloud sync now that RLS
              only trusts an authenticated, shop-linked user rather than
              the public anon key. */}
          {isConfigured && authChecked && !isSignedIn && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Sign in to sync this shop's data
                </p>
                <div className="flex text-[11px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setAuthMode('signin')}
                    className={`px-2 py-1 font-semibold ${authMode === 'signin' ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => setAuthMode('signup')}
                    className={`px-2 py-1 font-semibold ${authMode === 'signup' ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-500'}`}
                  >
                    Create Account
                  </button>
                </div>
              </div>

              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@yourshop.com"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />

              {authError && (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">{authError}</p>
              )}

              <button
                onClick={handleAuthSubmit}
                disabled={authBusy}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white disabled:opacity-50"
              >
                {authBusy ? 'Please wait...' : authMode === 'signup' ? 'Create Account & Link Shop' : 'Sign In'}
              </button>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Your shop's cloud data is now only accessible to accounts linked to it -
                run <span className="font-mono">supabase-schema-v2-security-fix.sql</span> in
                your Supabase project first if you haven't already.
              </p>
            </div>
          )}

          {isConfigured && isSignedIn && (
            <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Signed in - cloud sync unlocked for this shop
              </p>
              <button
                onClick={handleSignOut}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                Sign out
              </button>
            </div>
          )}

          {/* Quick Setup Instructions */}
          {!isConfigured && (
            <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs space-y-2 text-slate-700 dark:text-slate-300">
              <p className="font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Connect your Supabase Project in 2 Steps:</span>
              </p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                <li>
                  Open your <strong>Supabase Dashboard</strong> &gt; <strong>Project Settings</strong> &gt; <strong>API</strong>.
                </li>
                <li>
                  Provide the environment variables:
                  <div className="mt-1 font-mono text-[11px] bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800 select-all">
                    VITE_SUPABASE_URL=https://xyzcompany.supabase.co<br />
                    VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* SQL Schema Copy Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                PostgreSQL Schema Migration Script
              </label>
              <button
                onClick={handleCopySchema}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSchema ? 'Copied!' : 'Copy SQL Script'}</span>
              </button>
            </div>

            <pre className="text-[11px] font-mono bg-slate-950 text-slate-300 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {sqlSchemaSnippet}
            </pre>
            <p className="text-[10px] text-slate-400">
              Paste into your Supabase SQL Editor and click <strong>RUN</strong>. This creates all POS tables <em>and</em> applies the security-fix migration
              (shop-scoped, authenticated-only access) - copy-pasting only part of this script will leave your database open to the public anon key.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Encrypted RLS & Local Fallback Protected</span>
          </span>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
